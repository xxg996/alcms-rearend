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

    // 情况2: 只设置了VIP要求，没有积分要求
    if (requiredPoints === 0 && requiredVipLevel > 0) {
      const userVipLevel = user.vip_level || 0;

      if (userVipLevel >= requiredVipLevel) {
        // VIP用户免费下载，不消耗次数
        result.canDownload = true;
        result.costInfo = { type: 'vip_free', cost: 0, required_vip_level: requiredVipLevel };
        result.finalDownloadStatus = downloadStatus;
        return result;
      } else {
        result.reason = `需要VIP${requiredVipLevel}等级，当前等级：${userVipLevel}`;
        return result;
      }
    }

    // 情况3: 设置了积分要求（可能同时设置了VIP要求）
    if (requiredPoints > 0) {
      // 如果同时设置了VIP要求，检查用户是否满足VIP等级
      if (requiredVipLevel > 0) {
        const userVipLevel = user.vip_level || 0;
        if (userVipLevel >= requiredVipLevel) {
          // VIP用户免费下载，不消耗次数和积分
          result.canDownload = true;
          result.costInfo = { type: 'vip_free', cost: 0, required_vip_level: requiredVipLevel };
          result.finalDownloadStatus = downloadStatus;
          return result;
        }
      }

      // 需要扣积分，按优先级处理
      if (downloadStatus.canDownload) {
        // 有下载次数，优先使用下载次数，不扣积分
        result.finalDownloadStatus = await consumeDownload(userId);
        result.costInfo = { type: 'download_count', cost: 1 };
        result.canDownload = true;
        return result;
      } else {
        // 没有下载次数，使用积分
        const userPoints = user.points || 0;

        if (userPoints < requiredPoints) {
          result.reason = `积分不足，需要 ${requiredPoints} 积分，当前有 ${userPoints} 积分`;
          return result;
        }

        // 可以使用积分下载
        result.canDownload = true;
        result.costInfo = { type: 'points', cost: requiredPoints };
        result.finalDownloadStatus = downloadStatus;
        return result;
      }
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
    // 如果需要扣积分
    if (costInfo.type === 'points' && costInfo.cost > 0) {
      // 扣除用户积分
      await query(`
        UPDATE users SET points = points - $1 WHERE id = $2
      `, [costInfo.cost, userId]);

      // 记录积分消耗
      await query(`
        INSERT INTO user_points (user_id, points, reason, resource_id, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      `, [userId, -costInfo.cost, `下载文件: ${file.name}`, file.resource_id]);

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
        const authorEarning = Math.floor(costInfo.cost * (1 - platformFeeRate));

        if (authorEarning > 0) {
          // 增加作者积分
          await query(`
            UPDATE users SET points = points + $1 WHERE id = $2
          `, [authorEarning, authorId]);

          // 记录作者收入
          await query(`
            INSERT INTO user_points (user_id, points, reason, resource_id, created_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
          `, [authorId, authorEarning, `文件销售收入: ${file.name}`, file.resource_id]);
        }
      }
    }

    // 记录今日下载记录
    await query(`
      INSERT INTO daily_purchases (user_id, resource_id, file_id, purchase_date, points_cost)
      VALUES ($1, $2, $3, CURRENT_DATE, $4)
      ON CONFLICT (user_id, resource_id, purchase_date) DO UPDATE SET
        points_cost = GREATEST(daily_purchases.points_cost, EXCLUDED.points_cost),
        file_id = COALESCE(daily_purchases.file_id, EXCLUDED.file_id)
    `, [userId, file.resource_id, file.id, costInfo.cost || 0]);

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