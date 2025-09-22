/**
 * 下载鉴权工具类
 * 基于resource_files表的权限配置进行下载鉴权
 */

const { query } = require('../config/database');
const { logger } = require('./logger');
const { checkAndResetDailyDownloads, consumeDownload } = require('./downloadLimitUtils');

/**
 * 检查文件下载权限
 * @param {Object} file - 文件对象
 * @param {number} userId - 用户ID
 * @param {Object} user - 用户信息
 * @returns {Promise<Object>} 鉴权结果
 */
const checkFileDownloadPermission = async (file, userId, user) => {
  const result = {
    canDownload: false,
    costInfo: { type: 'free', cost: 0 },
    reason: '',
    finalDownloadStatus: null
  };

  try {
    // 检查文件是否激活
    if (!file.is_active || file.deleted_at) {
      result.reason = '文件不可用';
      return result;
    }

    // 获取用户的下载状态
    const downloadStatus = await checkAndResetDailyDownloads(userId);

    // 检查今日是否已下载过该文件
    const downloadHistory = await query(`
      SELECT id FROM daily_purchases
      WHERE user_id = $1 AND file_id = $2 AND purchase_date = CURRENT_DATE
    `, [userId, file.id]);

    const hasDownloadedToday = downloadHistory.rows.length > 0;

    // 如果今日已下载过，直接允许
    if (hasDownloadedToday) {
      result.canDownload = true;
      result.costInfo = { type: 'downloaded_today', cost: 0 };
      result.finalDownloadStatus = downloadStatus;
      return result;
    }

    // 检查权限配置
    const requiredPoints = file.required_points || 0;
    const requiredVipLevel = file.required_vip_level || 0;
    const userVipLevel = user.vip_level || 0;
    const userPoints = user.points || 0;

    // 获取用户VIP等级的积分折扣配置
    let vipDiscountRate = 10; // 默认原价(10折)
    if (userVipLevel > 0) {
      const vipConfig = await query(`
        SELECT points_discount_rate FROM vip_levels WHERE level = $1 AND is_active = true
      `, [userVipLevel]);

      if (vipConfig.rows.length > 0) {
        vipDiscountRate = vipConfig.rows[0].points_discount_rate || 10;
      }
    }

    // 情况1: 既没有积分要求也没有VIP要求 - 免费文件
    if (requiredPoints === 0 && requiredVipLevel === 0) {
      // 免费文件，优先使用下载次数
      if (downloadStatus.canDownload) {
        result.finalDownloadStatus = await consumeDownload(userId);
        result.costInfo = { type: 'download_count', cost: 1 };
      } else {
        result.finalDownloadStatus = downloadStatus;
        result.costInfo = { type: 'free', cost: 0 };
      }
      result.canDownload = true;
      return result;
    }

    // 情况2: 同时配置了积分和VIP等级 - VIP等级优先
    if (requiredPoints > 0 && requiredVipLevel > 0) {
      // 检查VIP等级，必须 >= required_vip_level
      if (userVipLevel >= requiredVipLevel) {
        // VIP等级满足，需要扣下载次数
        if (downloadStatus.canDownload) {
          result.finalDownloadStatus = await consumeDownload(userId);
          result.canDownload = true;
          result.costInfo = {
            type: 'vip_download_count',
            cost: 1,
            required_vip_level: requiredVipLevel
          };
          return result;
        } else {
          result.reason = `VIP${requiredVipLevel}用户下载次数不足，当前剩余：${downloadStatus.remaining}`;
          return result;
        }
      } else {
        result.reason = `需要VIP${requiredVipLevel}等级，当前等级：${userVipLevel}`;
        return result;
      }
    }

    // 情况3: 只设置了VIP要求，没有积分要求
    if (requiredPoints === 0 && requiredVipLevel > 0) {
      // 检查VIP等级，必须 >= required_vip_level
      if (userVipLevel >= requiredVipLevel) {
        // VIP等级满足，需要扣下载次数
        if (downloadStatus.canDownload) {
          result.finalDownloadStatus = await consumeDownload(userId);
          result.canDownload = true;
          result.costInfo = {
            type: 'vip_download_count',
            cost: 1,
            required_vip_level: requiredVipLevel
          };
          return result;
        } else {
          result.reason = `VIP${requiredVipLevel}用户下载次数不足，当前剩余：${downloadStatus.remaining}`;
          return result;
        }
      } else {
        result.reason = `需要VIP${requiredVipLevel}等级，当前等级：${userVipLevel}`;
        return result;
      }
    }

    // 情况4: 只设置了积分要求
    if (requiredPoints > 0 && requiredVipLevel === 0) {
      // VIP用户享受折扣
      const discountedPoints = Math.ceil(requiredPoints * vipDiscountRate / 10);

      // 优先使用下载次数
      if (downloadStatus.canDownload) {
        result.finalDownloadStatus = await consumeDownload(userId);
        result.canDownload = true;
        result.costInfo = { type: 'download_count', cost: 1 };
        return result;
      }

      // 下载次数不足，使用积分
      if (userPoints < discountedPoints) {
        const discountInfo = userVipLevel > 0 ?
          `（VIP${userVipLevel}享受${vipDiscountRate}折优惠，原价${requiredPoints}积分）` : '';
        result.reason = `积分不足，需要 ${discountedPoints} 积分${discountInfo}，当前有 ${userPoints} 积分`;
        return result;
      }

      // 可以使用积分下载
      result.canDownload = true;
      result.costInfo = {
        type: userVipLevel > 0 ? 'vip_discounted_points' : 'points',
        cost: discountedPoints,
        originalCost: requiredPoints,
        discountRate: vipDiscountRate,
        vipLevel: userVipLevel
      };
      result.finalDownloadStatus = downloadStatus;
      return result;
    }

    result.reason = '未知的权限配置错误';
    return result;

  } catch (error) {
    logger.error('检查文件下载权限失败:', error);
    result.reason = '权限检查失败';
    return result;
  }
};

/**
 * 执行下载扣费
 * @param {Object} file - 文件对象
 * @param {number} userId - 用户ID
 * @param {Object} costInfo - 费用信息
 * @returns {Promise<boolean>} 扣费是否成功
 */
const executeDownloadPayment = async (file, userId, costInfo) => {
  try {
    // 如果需要扣积分（包括VIP折扣积分）
    if ((costInfo.type === 'points' || costInfo.type === 'vip_discounted_points') && costInfo.cost > 0) {
      // 扣除用户积分
      await query(`
        UPDATE users SET points = points - $1 WHERE id = $2
      `, [costInfo.cost, userId]);

      // 记录积分消耗
      const pointsReason = costInfo.type === 'vip_discounted_points' ?
        `下载文件(VIP${costInfo.vipLevel}享受${costInfo.discountRate}折): ${file.name}` :
        `下载文件: ${file.name}`;

      await query(`
        INSERT INTO user_points (user_id, points, reason, resource_id, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      `, [userId, -costInfo.cost, pointsReason, file.resource_id]);

      // 给文件作者分成（如果不是自己的文件）
      const fileInfo = await query(`
        SELECT r.author_id FROM resources r
        JOIN resource_files rf ON r.id = rf.resource_id
        WHERE rf.id = $1
      `, [file.id]);

      const authorId = fileInfo.rows[0]?.author_id;

      if (authorId && authorId !== userId) {
        // 获取平台分成比例
        const platformFeeRate = 0.10; // TODO: 从系统设置中获取

        // 作者分成基于折扣后的积分计算，然后扣除手续费
        const authorEarning = Math.floor(costInfo.cost * (1 - platformFeeRate));

        if (authorEarning > 0) {
          // 增加作者积分
          await query(`
            UPDATE users SET points = points + $1 WHERE id = $2
          `, [authorEarning, authorId]);

          // 记录作者收入
          const earningReason = costInfo.type === 'vip_discounted_points' ?
            `文件销售收入(VIP折扣后): ${file.name}` :
            `文件销售收入: ${file.name}`;

          await query(`
            INSERT INTO user_points (user_id, points, reason, resource_id, created_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
          `, [authorId, authorEarning, earningReason, file.resource_id]);
        }
      }
    }

    // 记录今日下载记录 - 根据消费类型决定记录的积分成本
    let actualPointsCost = 0;
    if (costInfo.type === 'points' || costInfo.type === 'vip_discounted_points') {
      actualPointsCost = costInfo.cost;
    }
    // 下载次数类型记录为0积分成本

    await query(`
      INSERT INTO daily_purchases (user_id, resource_id, file_id, purchase_date, points_cost)
      VALUES ($1, $2, $3, CURRENT_DATE, $4)
      ON CONFLICT (user_id, resource_id, purchase_date) DO UPDATE SET
        points_cost = GREATEST(daily_purchases.points_cost, EXCLUDED.points_cost),
        file_id = COALESCE(daily_purchases.file_id, EXCLUDED.file_id)
    `, [userId, file.resource_id, file.id, actualPointsCost]);

    return true;

  } catch (error) {
    logger.error('执行下载扣费失败:', error);
    return false;
  }
};


module.exports = {
  checkFileDownloadPermission,
  executeDownloadPayment
};