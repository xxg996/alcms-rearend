/**
 * 完整安装数据库迁移脚本
 * 按模块顺序执行所有功能的迁移
 */

const fs = require('fs');
const path = require('path');
const { query, closePool } = require('../src/config/database');
const { logger } = require('../src/utils/logger');

// 按顺序执行的迁移模块
const MIGRATION_MODULES = [
  '01-core',      // 核心用户权限系统
  '02-cms',       // CMS内容管理系统  
  '03-community', // 社区系统
  '04-vip'        // VIP会员系统
];

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
 * 获取数据库信息
 */
async function getDatabaseInfo() {
  try {
    const versionResult = await query('SELECT version()');
    const dbNameResult = await query('SELECT current_database()');
    const userResult = await query('SELECT current_user');
    
    return {
      version: versionResult[0]?.version || 'Unknown',
      database: dbNameResult[0]?.current_database || 'Unknown',
      user: userResult[0]?.current_user || 'Unknown'
    };
  } catch (error) {
    logger.warn('获取数据库信息失败:', error);
    return {};
  }
}

/**
 * 加载迁移模块
 */
function loadMigrationModule(moduleName) {
  try {
    const modulePath = path.join(__dirname, 'scripts', `${moduleName}.js`);
    if (!fs.existsSync(modulePath)) {
      throw new Error(`迁移模块文件不存在: ${modulePath}`);
    }
    return require(modulePath);
  } catch (error) {
    throw new Error(`加载迁移模块 ${moduleName} 失败: ${error.message}`);
  }
}

/**
 * 执行完整安装
 */
async function runFullInstall() {
  const startTime = Date.now();
  let executedModules = [];
  
  try {
    logger.info('🚀 开始完整数据库安装...');
    logger.info('📝 将安装所有功能模块：核心系统、CMS、社区、VIP系统');
    
    // 检查数据库连接
    logger.info('🔍 检查数据库连接...');
    if (!(await checkDatabaseConnection())) {
      throw new Error('无法连接到数据库，请检查配置');
    }
    logger.info('✅ 数据库连接正常');
    
    // 获取数据库信息
    const dbInfo = await getDatabaseInfo();
    if (dbInfo.version) {
      logger.info(`📊 数据库: ${dbInfo.database} (${dbInfo.user})`);
      logger.info(`📊 PostgreSQL: ${dbInfo.version.split(' ')[1] || 'Unknown'}`);
    }
    
    // 加载迁移模块
    logger.info('📂 加载迁移模块...');
    const moduleMap = {};
    for (const moduleName of MIGRATION_MODULES) {
      moduleMap[moduleName] = loadMigrationModule(moduleName);
      logger.info(`📄 已加载: ${moduleMap[moduleName].name}`);
    }
    logger.info(`✅ 已加载 ${MIGRATION_MODULES.length} 个迁移模块`);
    
    // 开始事务
    logger.info('🔄 开始事务...');
    await query('BEGIN');
    let inTransaction = true;
    
    try {
      // 按顺序执行迁移
      for (let i = 0; i < MIGRATION_MODULES.length; i++) {
        const moduleName = MIGRATION_MODULES[i];
        const module = moduleMap[moduleName];
        
        logger.info(`📦 [${i + 1}/${MIGRATION_MODULES.length}] 正在安装: ${module.name}`);
        
        await module.migrate();
        executedModules.push(moduleName);
        
        // 验证模块安装
        if (module.validate) {
          await module.validate();
        }
        
        logger.info(`✅ ${module.name} 安装完成`);
      }
      
      // 提交事务
      await query('COMMIT');
      inTransaction = false;
      logger.info('✅ 事务已提交');
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`🎉 完整安装成功！`);
      logger.info(`📊 总用时: ${duration}秒`);
      logger.info(`📊 成功安装 ${executedModules.length} 个功能模块`);
      
    } catch (error) {
      if (inTransaction) {
        logger.warn('🔄 安装失败，正在回滚事务...');
        try {
          await query('ROLLBACK');
          logger.info('✅ 事务已回滚，数据库状态已恢复');
        } catch (rollbackError) {
          logger.error('❌ 事务回滚失败:', rollbackError);
        }
      }
      throw error;
    }
    
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.error('❌ 完整安装失败:', error);
    logger.error(`❌ 失败时间: ${duration}秒`);
    if (executedModules.length > 0) {
      logger.info(`📊 已完成模块: ${executedModules.join(', ')}`);
    }
    process.exit(1);
  } finally {
    await closePool();
  }
}

// 如果直接运行此脚本，则执行完整安装
if (require.main === module) {
  runFullInstall();
}

module.exports = {
  runFullInstall,
  MIGRATION_MODULES
};