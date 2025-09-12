/**
 * 统一数据库安装脚本
 * 整合所有数据库迁移功能，支持完整安装和选择性安装
 */

const fs = require('fs');
const path = require('path');
const { query, closePool } = require('../src/config/database');
const { logger } = require('../src/utils/logger');

// 安装模式定义
const INSTALL_MODES = {
  full: {
    name: '完整安装',
    description: '安装所有功能模块（推荐新项目使用）',
    migrations: [
      '001_create_tables.sql',
      '002_insert_default_data.sql',
      '003_create_cms_tables.sql',
      '004_insert_cms_default_data.sql',
      '005_create_community_tables.sql',
      '006_insert_community_default_data.sql',
      '007_add_vip_card_system.sql',
      '008_add_points_checkin_system.sql',
      '009_add_vip_points_permissions.sql'
    ]
  },
  basic: {
    name: '基础安装',
    description: '仅安装核心用户和权限系统',
    migrations: [
      '001_create_tables.sql',
      '002_insert_default_data.sql'
    ]
  },
  cms: {
    name: 'CMS模块',
    description: '安装内容管理系统模块',
    migrations: [
      '003_create_cms_tables.sql',
      '004_insert_cms_default_data.sql'
    ]
  },
  community: {
    name: '社区模块',
    description: '安装社区功能模块',
    migrations: [
      '005_create_community_tables.sql',
      '006_insert_community_default_data.sql'
    ]
  },
  vip: {
    name: 'VIP系统',
    description: '安装VIP和积分系统',
    migrations: [
      '007_add_vip_card_system.sql',
      '008_add_points_checkin_system.sql',
      '009_add_vip_points_permissions.sql'
    ]
  }
};

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
 * 检查迁移文件是否存在
 */
function checkMigrationFiles(migrations) {
  const migrationsDir = path.join(__dirname, 'migrations');
  const missingFiles = [];
  
  for (const filename of migrations) {
    const filePath = path.join(migrationsDir, filename);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(filename);
    }
  }
  
  return missingFiles;
}

/**
 * 执行迁移文件
 */
async function executeMigration(filename) {
  const filePath = path.join(__dirname, 'migrations', filename);
  
  try {
    logger.info(`📄 执行迁移: ${filename}`);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // 分割多个SQL语句并逐个执行
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        await query(statement);
      }
    }
    
    logger.info(`✅ 迁移完成: ${filename}`);
    return true;
  } catch (error) {
    logger.error(`❌ 迁移失败: ${filename}`, error);
    throw error;
  }
}

/**
 * 运行数据库安装
 */
async function runInstall(mode = 'full') {
  try {
    logger.info('🚀 开始数据库安装...');
    
    // 检查安装模式
    if (!INSTALL_MODES[mode]) {
      throw new Error(`未知的安装模式: ${mode}`);
    }
    
    const config = INSTALL_MODES[mode];
    logger.info(`📦 安装模式: ${config.name}`);
    logger.info(`📝 说明: ${config.description}`);
    
    // 检查数据库连接
    logger.info('🔍 检查数据库连接...');
    if (!(await checkDatabaseConnection())) {
      throw new Error('无法连接到数据库，请检查配置');
    }
    logger.info('✅ 数据库连接正常');
    
    // 检查迁移文件
    logger.info('📁 检查迁移文件...');
    const missingFiles = checkMigrationFiles(config.migrations);
    if (missingFiles.length > 0) {
      throw new Error(`缺少迁移文件: ${missingFiles.join(', ')}`);
    }
    logger.info(`✅ 所有迁移文件已找到 (${config.migrations.length}个)`);
    
    // 执行迁移
    logger.info('⚡ 开始执行迁移...');
    for (let i = 0; i < config.migrations.length; i++) {
      const filename = config.migrations[i];
      logger.info(`[${i + 1}/${config.migrations.length}] ${filename}`);
      await executeMigration(filename);
    }
    
    logger.info(`🎉 ${config.name}安装完成！`);
    logger.info(`📊 共执行了 ${config.migrations.length} 个迁移文件`);
    
  } catch (error) {
    logger.error('❌ 数据库安装失败:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
🔧 Alcms 数据库安装工具

用法:
  npm run install         # 完整安装（推荐）
  npm run install:basic   # 基础安装
  npm run install:cms     # 仅CMS模块
  npm run install:community # 仅社区模块  
  npm run install:vip     # 仅VIP系统

安装模式:
`);
  
  Object.entries(INSTALL_MODES).forEach(([key, config]) => {
    console.log(`  ${key.padEnd(12)} - ${config.name}: ${config.description}`);
  });
  
  console.log(`
示例:
  node database/setup.js              # 完整安装
  node database/setup.js basic        # 基础安装
  node database/setup.js cms          # 仅安装CMS模块
`);
}

// 命令行参数处理
if (require.main === module) {
  const args = process.argv.slice(2);
  const mode = args[0] || 'full';
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  runInstall(mode);
}

module.exports = {
  runInstall,
  INSTALL_MODES,
  checkDatabaseConnection,
  executeMigration
};