/**
 * VIP会员系统迁移脚本
 * 包含：VIP等级、卡密系统、积分系统、签到系统
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../../src/config/database');
const { logger } = require('../../src/utils/logger');

/**
 * 执行VIP系统迁移
 */
async function migrateVIPSystem() {
  try {
    logger.info('💎 开始迁移VIP会员系统...');
    
    // 执行VIP卡密系统迁移
    const vipCardSql = fs.readFileSync(
      path.join(__dirname, '../migrations/007_add_vip_card_system.sql'), 
      'utf8'
    );
    await query(vipCardSql);
    logger.info('✅ VIP卡密系统创建完成');
    
    // 执行积分签到系统迁移
    const pointsCheckinSql = fs.readFileSync(
      path.join(__dirname, '../migrations/008_add_points_checkin_system.sql'), 
      'utf8'
    );
    await query(pointsCheckinSql);
    logger.info('✅ 积分签到系统创建完成');
    
    // 执行权限关联迁移
    const permissionsSql = fs.readFileSync(
      path.join(__dirname, '../migrations/009_add_vip_points_permissions.sql'), 
      'utf8'
    );
    await query(permissionsSql);
    logger.info('✅ VIP权限关联完成');
    
    logger.info('🎉 VIP会员系统迁移完成');
    return true;
  } catch (error) {
    logger.error('❌ VIP系统迁移失败:', error);
    throw error;
  }
}

/**
 * 验证VIP系统
 */
async function validateVIPSystem() {
  try {
    const vipLevelCount = await query('SELECT COUNT(*) as count FROM vip_levels');
    const cardKeyCount = await query('SELECT COUNT(*) as count FROM card_keys');
    const pointsRecordCount = await query('SELECT COUNT(*) as count FROM points_records');
    const checkinConfigCount = await query('SELECT COUNT(*) as count FROM checkin_configs');
    
    logger.info(`📊 VIP系统统计: ${vipLevelCount[0].count} VIP等级, ${cardKeyCount[0].count} 卡密, ${pointsRecordCount[0].count} 积分记录, ${checkinConfigCount[0].count} 签到配置`);
    return true;
  } catch (error) {
    logger.warn('⚠️  VIP系统验证失败:', error);
    return false;
  }
}

module.exports = {
  name: 'VIP会员系统',
  description: 'VIP等级、卡密兑换、积分系统、签到奖励',
  migrate: migrateVIPSystem,
  validate: validateVIPSystem,
  dependencies: ['01-core'] // 依赖核心系统
};