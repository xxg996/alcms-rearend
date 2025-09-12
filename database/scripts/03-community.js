/**
 * 社区系统迁移脚本
 * 包含：板块表、帖子表、评论表、互动表及基础数据
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../../src/config/database');
const { logger } = require('../../src/utils/logger');

/**
 * 执行社区系统迁移
 */
async function migrateCommunitySystem() {
  try {
    logger.info('💬 开始迁移社区系统...');
    
    // 执行社区表结构迁移
    const tablesSql = fs.readFileSync(
      path.join(__dirname, '../migrations/005_create_community_tables.sql'), 
      'utf8'
    );
    await query(tablesSql);
    logger.info('✅ 社区表结构创建完成');
    
    // 执行社区默认数据迁移
    const dataSql = fs.readFileSync(
      path.join(__dirname, '../migrations/006_insert_community_default_data.sql'), 
      'utf8'
    );
    await query(dataSql);
    logger.info('✅ 社区默认数据插入完成');
    
    logger.info('🎉 社区系统迁移完成');
    return true;
  } catch (error) {
    logger.error('❌ 社区系统迁移失败:', error);
    throw error;
  }
}

/**
 * 验证社区系统
 */
async function validateCommunitySystem() {
  try {
    const boardCount = await query('SELECT COUNT(*) as count FROM community_boards');
    const postCount = await query('SELECT COUNT(*) as count FROM community_posts');
    const commentCount = await query('SELECT COUNT(*) as count FROM community_comments');
    
    logger.info(`📊 社区数据统计: ${boardCount[0].count} 板块, ${postCount[0].count} 帖子, ${commentCount[0].count} 评论`);
    return true;
  } catch (error) {
    logger.warn('⚠️  社区系统验证失败:', error);
    return false;
  }
}

module.exports = {
  name: '社区系统',
  description: '论坛板块、帖子管理、评论互动',
  migrate: migrateCommunitySystem,
  validate: validateCommunitySystem,
  dependencies: ['01-core'] // 依赖核心系统
};