/**
 * CMS内容管理系统迁移脚本
 * 包含：资源表、分类表、标签表及基础数据
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../../src/config/database');
const { logger } = require('../../src/utils/logger');

/**
 * 执行CMS系统迁移
 */
async function migrateCMSSystem() {
  try {
    logger.info('📄 开始迁移CMS内容管理系统...');
    
    // 执行CMS表结构迁移
    const tablesSql = fs.readFileSync(
      path.join(__dirname, '../migrations/003_create_cms_tables.sql'), 
      'utf8'
    );
    await query(tablesSql);
    logger.info('✅ CMS表结构创建完成');
    
    // 执行CMS默认数据迁移
    const dataSql = fs.readFileSync(
      path.join(__dirname, '../migrations/004_insert_cms_default_data.sql'), 
      'utf8'
    );
    await query(dataSql);
    logger.info('✅ CMS默认数据插入完成');
    
    logger.info('🎉 CMS内容管理系统迁移完成');
    return true;
  } catch (error) {
    logger.error('❌ CMS系统迁移失败:', error);
    throw error;
  }
}

/**
 * 验证CMS系统
 */
async function validateCMSSystem() {
  try {
    const resourceCount = await query('SELECT COUNT(*) as count FROM resources');
    const categoryCount = await query('SELECT COUNT(*) as count FROM categories');
    const tagCount = await query('SELECT COUNT(*) as count FROM tags');
    
    logger.info(`📊 CMS数据统计: ${resourceCount[0].count} 资源, ${categoryCount[0].count} 分类, ${tagCount[0].count} 标签`);
    return true;
  } catch (error) {
    logger.warn('⚠️  CMS系统验证失败:', error);
    return false;
  }
}

module.exports = {
  name: 'CMS内容管理系统',
  description: '资源管理、分类管理、标签系统',
  migrate: migrateCMSSystem,
  validate: validateCMSSystem,
  dependencies: ['01-core'] // 依赖核心系统
};