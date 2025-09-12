/**
 * 核心用户权限系统迁移脚本
 * 包含：用户表、角色表、权限表及基础数据
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../../src/config/database');
const { logger } = require('../../src/utils/logger');

/**
 * 执行核心系统迁移
 */
async function migrateCoreSystem() {
  try {
    logger.info('🔧 开始迁移核心用户权限系统...');
    
    // 执行表结构迁移
    const tablesSql = fs.readFileSync(
      path.join(__dirname, '../migrations/001_create_tables.sql'), 
      'utf8'
    );
    await query(tablesSql);
    logger.info('✅ 核心表结构创建完成');
    
    // 执行默认数据迁移
    const dataSql = fs.readFileSync(
      path.join(__dirname, '../migrations/002_insert_default_data.sql'), 
      'utf8'
    );
    await query(dataSql);
    logger.info('✅ 默认数据插入完成');
    
    logger.info('🎉 核心用户权限系统迁移完成');
    return true;
  } catch (error) {
    logger.error('❌ 核心系统迁移失败:', error);
    throw error;
  }
}

/**
 * 验证核心系统
 */
async function validateCoreSystem() {
  try {
    const userCount = await query('SELECT COUNT(*) as count FROM users');
    const roleCount = await query('SELECT COUNT(*) as count FROM roles');
    const permCount = await query('SELECT COUNT(*) as count FROM permissions');
    
    logger.info(`📊 核心数据统计: ${userCount[0].count} 用户, ${roleCount[0].count} 角色, ${permCount[0].count} 权限`);
    return true;
  } catch (error) {
    logger.warn('⚠️  核心系统验证失败:', error);
    return false;
  }
}

module.exports = {
  name: '核心用户权限系统',
  description: '用户、角色、权限管理基础架构',
  migrate: migrateCoreSystem,
  validate: validateCoreSystem,
  dependencies: [] // 无依赖
};