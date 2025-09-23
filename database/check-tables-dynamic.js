/**
 * 动态数据库表检测脚本
 * 通过解析SQL文件动态获取应该存在的表
 * 已经弃用
 */

const fs = require('fs');
const path = require('path');
const { query, closePool } = require('../src/config/database');
const { logger } = require('../src/utils/logger');

// 迁移文件和模块映射
const MIGRATION_MODULES = {
  core: {
    name: '核心系统',
    files: ['001_create_tables.sql', '002_insert_default_data.sql']
  },
  cms: {
    name: 'CMS内容管理',
    files: ['003_create_cms_tables.sql', '004_insert_cms_default_data.sql']
  },
  community: {
    name: '社区系统',
    files: ['005_create_community_tables.sql', '006_insert_community_default_data.sql']
  },
  vip: {
    name: 'VIP系统',
    files: ['007_add_vip_card_system.sql', '008_add_points_checkin_system.sql', '009_add_vip_points_permissions.sql']
  }
};

// 缓存解析结果
let EXPECTED_TABLES_CACHE = null;

/**
 * 从SQL文件中解析表名
 */
function parseTableNamesFromSQL(sqlContent) {
  const tables = new Set();
  
  // 匹配 CREATE TABLE 语句（支持 IF NOT EXISTS）
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|")?(\w+)(?:`|")?\s*\(/gi;
  let match;
  
  while ((match = createTableRegex.exec(sqlContent)) !== null) {
    const tableName = match[1].toLowerCase();
    // 排除一些系统表或临时表
    if (!tableName.startsWith('temp_') && !tableName.startsWith('tmp_')) {
      tables.add(tableName);
    }
  }
  
  return Array.from(tables);
}

/**
 * 解析迁移文件获取所有表
 */
function parseExpectedTables() {
  if (EXPECTED_TABLES_CACHE) {
    return EXPECTED_TABLES_CACHE;
  }
  
  const migrationsDir = path.join(__dirname, 'migrations');
  const expectedTables = {};
  
  for (const [moduleKey, module] of Object.entries(MIGRATION_MODULES)) {
    const moduleTables = new Set();
    
    for (const filename of module.files) {
      const filePath = path.join(migrationsDir, filename);
      
      try {
        if (fs.existsSync(filePath)) {
          const sqlContent = fs.readFileSync(filePath, 'utf8');
          const tables = parseTableNamesFromSQL(sqlContent);
          tables.forEach(table => moduleTables.add(table));
          logger.debug(`从 ${filename} 解析到 ${tables.length} 个表: ${tables.join(', ')}`);
        } else {
          logger.warn(`迁移文件不存在: ${filename}`);
        }
      } catch (error) {
        logger.error(`解析迁移文件 ${filename} 失败:`, error);
      }
    }
    
    expectedTables[moduleKey] = {
      name: module.name,
      tables: Array.from(moduleTables).sort()
    };
  }
  
  EXPECTED_TABLES_CACHE = expectedTables;
  return expectedTables;
}

/**
 * 获取所有SQL文件中的表（备用方法）
 */
function parseAllMigrationFiles() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const allTables = new Set();
  
  try {
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    logger.info(`📂 发现 ${files.length} 个SQL文件: ${files.join(', ')}`);
    
    for (const filename of files) {
      const filePath = path.join(migrationsDir, filename);
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      const tables = parseTableNamesFromSQL(sqlContent);
      
      logger.debug(`📄 ${filename}: ${tables.join(', ')}`);
      tables.forEach(table => allTables.add(table));
    }
    
    return Array.from(allTables).sort();
  } catch (error) {
    logger.error('解析迁移文件目录失败:', error);
    return [];
  }
}

/**
 * 检查数据库连接
 */
async function checkDatabaseConnection() {
  try {
    await query('SELECT 1');
    return true;
  } catch (error) {
    logger.error('数据库连接失败:', error);
    return false;
  }
}

/**
 * 获取数据库中所有存在的表
 */
async function getExistingTables() {
  try {
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    // 调试信息：显示查询结果的数据结构
    logger.debug('查询结果类型:', typeof result);
    logger.debug('查询结果是否为数组:', Array.isArray(result));
    
    // 确保result是数组，兼容不同的返回格式
    let rows;
    if (Array.isArray(result)) {
      rows = result;
    } else if (result && result.rows && Array.isArray(result.rows)) {
      rows = result.rows;
    } else {
      logger.warn('无法解析查询结果，返回空数组');
      return [];
    }
    
    return rows.map(row => row.table_name);
  } catch (error) {
    logger.error('获取表列表失败:', error);
    throw error;
  }
}

/**
 * 检查表的基本信息
 */
async function getTableInfo(tableName) {
  try {
    // 获取表的记录数
    const countResult = await query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    const countRows = Array.isArray(countResult) ? countResult : (countResult.rows || []);
    const count = parseInt(countRows[0]?.count || 0);
    
    // 获取表的列数
    const columnsResult = await query(`
      SELECT COUNT(*) as count 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
    `, [tableName]);
    const columnsRows = Array.isArray(columnsResult) ? columnsResult : (columnsResult.rows || []);
    const columns = parseInt(columnsRows[0]?.count || 0);
    
    return { count, columns };
  } catch (error) {
    return { count: 0, columns: 0, error: error.message };
  }
}

/**
 * 获取数据库基本信息
 */
async function getDatabaseInfo() {
  try {
    const versionResult = await query('SELECT version()');
    const versionRows = Array.isArray(versionResult) ? versionResult : (versionResult.rows || []);
    
    const dbNameResult = await query('SELECT current_database()');
    const dbNameRows = Array.isArray(dbNameResult) ? dbNameResult : (dbNameResult.rows || []);
    
    const sizeResult = await query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    const sizeRows = Array.isArray(sizeResult) ? sizeResult : (sizeResult.rows || []);
    
    return {
      version: versionRows[0]?.version || 'Unknown',
      database: dbNameRows[0]?.current_database || 'Unknown',
      size: sizeRows[0]?.size || 'Unknown'
    };
  } catch (error) {
    logger.warn('获取数据库信息失败:', error);
    return {};
  }
}

/**
 * 分析安装状态
 */
function analyzeInstallationStatus(existingTables, missingTables, expectedTables) {
  const allTables = Object.values(expectedTables).flatMap(module => module.tables);
  const totalExpected = allTables.length;
  const totalExisting = existingTables.length;
  const totalMissing = missingTables.length;
  
  const completeness = totalExpected > 0 ? ((totalExisting / totalExpected) * 100).toFixed(1) : '0';
  
  let status = 'incomplete';
  let recommendation = '';
  
  if (totalExpected === 0) {
    status = 'no-migrations';
    recommendation = '未找到迁移文件或无法解析表结构';
  } else if (totalMissing === 0) {
    status = 'complete';
    recommendation = '数据库安装完整 ✅';
  } else if (totalExisting === 0) {
    status = 'empty';
    recommendation = '建议运行: npm run install:full';
  } else if (missingTables.some(t => expectedTables.core?.tables?.includes(t))) {
    status = 'core-missing';
    recommendation = '核心系统缺失，建议重新安装: npm run install:full';
  } else {
    status = 'partial';
    const missingModules = [];
    
    Object.entries(expectedTables).forEach(([moduleKey, module]) => {
      const moduleMissing = module.tables.filter(t => missingTables.includes(t));
      if (moduleMissing.length > 0) {
        missingModules.push(module.name);
      }
    });
    
    recommendation = `缺少模块: ${missingModules.join(', ')}。建议运行: npm run install:full`;
  }
  
  return {
    status,
    completeness,
    totalExpected,
    totalExisting,
    totalMissing,
    recommendation
  };
}

/**
 * 主检测函数
 */
async function checkDatabaseTables() {
  const startTime = Date.now();
  
  try {
    logger.info('🔍 开始动态检测数据库表状态...');
    
    // 解析迁移文件获取预期表
    logger.info('📂 解析迁移文件...');
    const expectedTables = parseExpectedTables();
    const allExpectedTables = Object.values(expectedTables).flatMap(module => module.tables);
    
    logger.info(`📊 从迁移文件解析到 ${allExpectedTables.length} 个表`);
    
    // 如果解析失败，使用备用方法
    if (allExpectedTables.length === 0) {
      logger.warn('⚠️ 使用备用方法解析所有SQL文件...');
      const backupTables = parseAllMigrationFiles();
      if (backupTables.length > 0) {
        // 创建一个通用的预期表结构
        expectedTables.all = {
          name: '所有表',
          tables: backupTables
        };
        logger.info(`📊 备用方法找到 ${backupTables.length} 个表`);
      }
    }
    
    // 检查数据库连接
    if (!(await checkDatabaseConnection())) {
      throw new Error('无法连接到数据库，请检查配置');
    }
    
    // 获取数据库信息
    const dbInfo = await getDatabaseInfo();
    logger.info(`📊 数据库: ${dbInfo.database} (${dbInfo.size})`);
    logger.info(`📊 PostgreSQL: ${dbInfo.version?.split(' ')[1] || 'Unknown'}`);
    
    // 获取现有表
    const existingTables = await getExistingTables();
    logger.info(`📊 现有表数量: ${existingTables.length}`);
    
    // 分析缺少的表
    const allExpectedTablesFinal = Object.values(expectedTables).flatMap(module => module.tables);
    const missingTables = allExpectedTablesFinal.filter(table => !existingTables.includes(table));
    const extraTables = existingTables.filter(table => !allExpectedTablesFinal.includes(table));
    
    // 分析安装状态
    const analysis = analyzeInstallationStatus(existingTables, missingTables, expectedTables);
    
    logger.info('');
    logger.info('📋 === 检测结果 ===');
    logger.info(`📊 完整性: ${analysis.completeness}% (${analysis.totalExisting}/${analysis.totalExpected})`);
    logger.info(`📊 状态: ${analysis.status}`);
    logger.info(`💡 建议: ${analysis.recommendation}`);
    logger.info('');
    
    // 按模块显示详细状态
    for (const [moduleKey, module] of Object.entries(expectedTables)) {
      const moduleExisting = module.tables.filter(t => existingTables.includes(t));
      const moduleMissing = module.tables.filter(t => missingTables.includes(t));
      const moduleCompleteness = module.tables.length > 0 ? ((moduleExisting.length / module.tables.length) * 100).toFixed(0) : '0';
      
      const statusIcon = moduleMissing.length === 0 ? '✅' : moduleExisting.length === 0 ? '❌' : '⚠️';
      logger.info(`${statusIcon} ${module.name}: ${moduleCompleteness}% (${moduleExisting.length}/${module.tables.length})`);
      
      if (moduleMissing.length > 0 && moduleMissing.length < 5) {
        logger.info(`   缺少: ${moduleMissing.join(', ')}`);
      } else if (moduleMissing.length >= 5) {
        logger.info(`   缺少: ${moduleMissing.slice(0, 3).join(', ')} 等 ${moduleMissing.length} 个表`);
      }
    }
    
    // 显示额外表
    if (extraTables.length > 0) {
      logger.info('');
      logger.info(`ℹ️ 额外表 (${extraTables.length}个): ${extraTables.join(', ')}`);
    }
    
    // 显示表的详细信息（仅对现有表）
    if (existingTables.length > 0 && existingTables.length <= 20) {
      logger.info('');
      logger.info('📊 === 表详细信息 ===');
      
      for (const tableName of existingTables.sort()) {
        const tableInfo = await getTableInfo(tableName);
        if (tableInfo.error) {
          logger.info(`📄 ${tableName}: 无法获取信息 (${tableInfo.error})`);
        } else {
          logger.info(`📄 ${tableName}: ${tableInfo.count} 行, ${tableInfo.columns} 列`);
        }
      }
    } else if (existingTables.length > 20) {
      logger.info('');
      logger.info(`表太多(${existingTables.length}个)，跳过详细信息显示`);
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info('');
    logger.info(`🎉 动态检测完成，耗时 ${duration} 秒`);
    
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.error('❌ 数据库表检测失败:', error);
    logger.error(`❌ 失败时间: ${duration}秒`);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  checkDatabaseTables();
}

module.exports = {
  checkDatabaseTables,
  parseExpectedTables,
  parseAllMigrationFiles,
  parseTableNamesFromSQL
};