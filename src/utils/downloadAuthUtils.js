/**
 * 下载鉴权工具类
 * 基于resource_files表的权限配置进行下载鉴权
 */

const { query } = require('../config/database');
const { logger } = require('./logger');
const { checkAndResetDailyDownloads, consumeDownload } = require('./downloadLimitUtils');
const SystemSetting = require('../models/SystemSetting');

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
      // 检查用户VIP状态
      const isVip = user.vip_level > 0;

      if (isVip) {
        // VIP用户：优先使用每日下载次数，不足时使用总次数
        if (downloadStatus.canDownload) {
          result.finalDownloadStatus = downloadStatus;
          result.costInfo = { type: 'daily_limit', cost: 1 };
        } else if (user.download_count > 0) {
          // 每日次数用完，使用总次数
          result.finalDownloadStatus = downloadStatus;
          result.costInfo = { type: 'download_count', cost: 1 };
        } else {
          result.reason = `下载次数不足。每日剩余: 0 次，总次数剩余: ${user.download_count || 0} 次`;
          return result;
        }
      } else {
        // 普通用户：只使用总下载次数
        if (user.download_count > 0) {
          result.finalDownloadStatus = downloadStatus;
          result.costInfo = { type: 'download_count', cost: 1 };
        } else {
          result.reason = `下载次数不足，当前剩余: ${user.download_count || 0} 次`;
          return result;
        }
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
          const projectedStatus = {
            ...downloadStatus,
            dailyUsed: downloadStatus.dailyUsed + 1,
            remainingDownloads: Math.max(0, downloadStatus.remainingDownloads - 1),
            canDownload: downloadStatus.remainingDownloads - 1 > 0
          };

          result.finalDownloadStatus = projectedStatus;
          result.canDownload = true;
          result.costInfo = {
            type: 'vip_download_count',
            cost: 1,
            required_vip_level: requiredVipLevel
          };
          return result;
        } else {
          result.reason = `VIP${requiredVipLevel}用户下载次数不足，当前剩余：${downloadStatus.remainingDownloads}`;
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
          const projectedStatus = {
            ...downloadStatus,
            dailyUsed: downloadStatus.dailyUsed + 1,
            remainingDownloads: Math.max(0, downloadStatus.remainingDownloads - 1),
            canDownload: downloadStatus.remainingDownloads - 1 > 0
          };

          result.finalDownloadStatus = projectedStatus;
          result.canDownload = true;
          result.costInfo = {
            type: 'vip_download_count',
            cost: 1,
            required_vip_level: requiredVipLevel
          };
          return result;
        } else {
          result.reason = `VIP${requiredVipLevel}用户下载次数不足，当前剩余：${downloadStatus.remainingDownloads}`;
          return result;
        }
      } else {
        result.reason = `需要VIP${requiredVipLevel}等级，当前等级：${userVipLevel}`;
        return result;
      }
    }

    // 情况4: 只设置了积分要求 - VIP和普通用户都使用积分下载
    if (requiredPoints > 0 && requiredVipLevel === 0) {
      // VIP用户享受折扣
      const discountedPoints = Math.ceil(requiredPoints * vipDiscountRate / 10);

      // 检查用户积分是否足够
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
    // 免费类型，不需要扣费
    if (costInfo.type === 'free' || costInfo.type === 'downloaded_today') {
      // 直接记录下载记录，不扣费
    }
    // 如果需要扣每日下载次数或VIP下载次数
    else if ((costInfo.type === 'daily_limit' || costInfo.type === 'vip_download_count') && costInfo.cost > 0) {
      await consumeDownload(userId);
    }
    // 如果需要扣总下载次数
    else if (costInfo.type === 'download_count' && costInfo.cost > 0) {
      await query(`
        UPDATE users SET download_count = download_count - $1 WHERE id = $2
      `, [costInfo.cost, userId]);
    }

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
        const { fee_rate: platformFeeRate } = await SystemSetting.getResourceSaleFeeConfig();

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

    // 记录今日下载记录 - 根据消费类型决定记录的积分成本和下载次数成本
    let actualPointsCost = 0;
    let downloadCountCost = 0;

    if (costInfo.type === 'points' || costInfo.type === 'vip_discounted_points') {
      actualPointsCost = costInfo.cost;
    } else if (costInfo.type === 'download_count' || costInfo.type === 'daily_limit' || costInfo.type === 'vip_download_count') {
      downloadCountCost = costInfo.cost;
    }

    await query(`
      INSERT INTO daily_purchases (
        user_id, resource_id, file_id, purchase_date, points_cost,
        download_type, cost_type, download_count_cost
      )
      VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7)
      ON CONFLICT (user_id, file_id, purchase_date) DO UPDATE SET
        points_cost = GREATEST(daily_purchases.points_cost, EXCLUDED.points_cost),
        download_count_cost = GREATEST(daily_purchases.download_count_cost, EXCLUDED.download_count_cost),
        cost_type = EXCLUDED.cost_type,
        resource_id = EXCLUDED.resource_id
    `, [userId, file.resource_id, file.id, actualPointsCost, 'normal', costInfo.type, downloadCountCost]);

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
