/**
 * 每日下载限制工具函数
 * 处理用户每日下载次数限制和重置
 */

const { query } = require('../config/database');
const { logger } = require('./logger');

/**
 * 获取中国时区的当前日期字符串 (YYYY-MM-DD)
 * @returns {string} 格式化的日期字符串
 */
function getChinaDateString() {
  const now = new Date();
  const chinaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return chinaTime.toISOString().split('T')[0];
}

function normalizeDateToLocalString(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  const normalized = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return normalized.toISOString().split('T')[0];
}

/**
 * 检查并重置用户的每日下载次数
 * @param {number} userId - 用户ID
 * @returns {Promise<Object>} 用户当前下载状态
 */
async function checkAndResetDailyDownloads(userId) {
  try {
    // 获取用户当前状态
    const userResult = await query(`
      SELECT
        id,
        daily_download_limit,
        daily_downloads_used,
        last_download_reset_date,
        is_vip,
        vip_level
      FROM users
      WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      throw new Error('用户不存在');
    }

    const user = userResult.rows[0];

    // 获取数据库的当前日期来确保一致性
    const dateResult = await query('SELECT CURRENT_DATE as today');
    const today = normalizeDateToLocalString(dateResult.rows[0].today);
    const lastResetDate = normalizeDateToLocalString(user.last_download_reset_date);

    // 日期比较：使用数据库的日期来确保一致性

  // 如果是新的一天，根据VIP状态决定是否重置
  if (lastResetDate !== today) {
    if (user.is_vip && user.vip_level > 0) {
      const { getClient } = require('../config/database');
      const client = await getClient();

      try {
        await client.query('BEGIN');

        // 重置每日使用次数，但不修改下载限制配额
        logger.info(`用户${userId} VIP每日配额重置`, {
          userId,
          date: today
        });

        const resetResult = await client.query(`
          UPDATE users
          SET
            daily_downloads_used = 0,
            last_download_reset_date = $2::date
          WHERE id = $1
          RETURNING last_download_reset_date
        `, [userId, today]);

        const newResetDate = resetResult.rows[0]?.last_download_reset_date;
        logger.info(`用户 ${userId} (VIP) 的每日下载次数已重置`);

        const cleanupResult = await client.query(`
          DELETE FROM daily_purchases
          WHERE user_id = $1 AND purchase_date < $2::date
        `, [userId, today]);

        await client.query('COMMIT');

        const cleanupCount = cleanupResult.rowCount || 0;
        user.daily_downloads_used = 0;
        user.last_download_reset_date = newResetDate || dateResult.rows[0].today;

        if (cleanupCount > 0) {
          logger.info(`清理了 ${cleanupCount} 条过期购买记录`);
        }
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`用户 ${userId} 重置失败:`, error);
        throw error;
      } finally {
        client.release();
      }
    } else {
      const resetResult = await query(
        `UPDATE users
            SET last_download_reset_date = $2::date,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING last_download_reset_date`,
        [userId, today]
      );

      const newResetDate = resetResult.rows[0]?.last_download_reset_date;
      logger.info(`用户 ${userId} (普通) 的每日下载记录已重置`);

      await query(
        `DELETE FROM daily_purchases
          WHERE user_id = $1 AND purchase_date < $2::date`,
        [userId, today]
      );

      user.last_download_reset_date = newResetDate || dateResult.rows[0].today;
    }
  }

    // 获取用户实际的下载限制（VIP用户可能有更高限制）
    const actualLimit = await getUserActualDownloadLimit(userId, user);

    return {
      userId: user.id,
      dailyLimit: actualLimit,
      dailyUsed: user.daily_downloads_used || 0,
      remainingDownloads: Math.max(0, actualLimit - (user.daily_downloads_used || 0)),
      canDownload: (user.daily_downloads_used || 0) < actualLimit
    };

  } catch (error) {
    logger.error('检查每日下载次数失败:', error);
    throw error;
  }
}

/**
 * 获取用户实际的每日下载限制
 * @param {number} userId - 用户ID
 * @param {Object} user - 用户信息
 * @returns {Promise<number>} 实际下载限制
 */
async function getUserActualDownloadLimit(userId, user) {
  try {
    const baseLimit = Number.isFinite(Number(user.daily_download_limit))
      ? Number(user.daily_download_limit)
      : 0;

    // 如果是VIP用户，获取VIP等级的下载限制
    if (user.is_vip && user.vip_level > 0) {
      const vipResult = await query(`
        SELECT daily_download_limit
        FROM vip_levels
        WHERE level = $1 AND is_active = true
      `, [user.vip_level]);

      if (vipResult.rows.length > 0) {
        const vipLimitRaw = vipResult.rows[0].daily_download_limit;
        const vipLimit = Number.isFinite(Number(vipLimitRaw))
          ? Number(vipLimitRaw)
          : baseLimit;
        // 返回VIP限制和普通用户限制中的较大值
        return Math.max(vipLimit, baseLimit);
      }
    }

    // 返回普通用户限制
    return baseLimit;

  } catch (error) {
    logger.error('获取用户下载限制失败:', error);
    // 出错时返回默认限制
    return Number.isFinite(Number(user.daily_download_limit))
      ? Number(user.daily_download_limit)
      : 0;
  }
}

/**
 * 消耗一次每日下载配额（仅适用于VIP用户的每日配额）
 * @param {number} userId - 用户ID
 * @returns {Promise<Object>} 更新后的下载状态
 */
async function consumeDownload(userId) {
  try {
    // 先检查并重置每日下载次数
    const downloadStatus = await checkAndResetDailyDownloads(userId);

    if (!downloadStatus.canDownload) {
      throw new Error(`今日下载次数已用完，限制: ${downloadStatus.dailyLimit}次`);
    }

    // 只增加使用统计，daily_download_limit保持为固定的每日限制总数
    await query(`
      UPDATE users
      SET daily_downloads_used = daily_downloads_used + 1
      WHERE id = $1
    `, [userId]);

    // 返回更新后的状态
    return {
      ...downloadStatus,
      dailyUsed: downloadStatus.dailyUsed + 1,
      remainingDownloads: downloadStatus.dailyLimit - (downloadStatus.dailyUsed + 1),
      canDownload: (downloadStatus.dailyUsed + 1) < downloadStatus.dailyLimit
    };

  } catch (error) {
    logger.error('消耗每日下载配额失败:', error);
    throw error;
  }
}

/**
 * 记录下载行为到下载记录表
 * @param {Object} downloadData - 下载记录数据
 * @returns {Promise<Object>} 下载记录
 */
async function recordDownload(downloadData) {
  const {
    userId,
    resourceId,
    ipAddress,
    userAgent,
    downloadUrl,
    expiresAt,
    isSuccessful = true
  } = downloadData;

  try {
    const result = await query(`
      INSERT INTO download_records (
        user_id,
        resource_id,
        ip_address,
        user_agent,
        download_url,
        expires_at,
        is_successful
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [userId, resourceId, ipAddress, userAgent, downloadUrl, expiresAt, isSuccessful]);

    return result.rows[0];

  } catch (error) {
    logger.error('记录下载行为失败:', error);
    throw error;
  }
}

/**
 * 获取用户今日下载次数（从下载记录表统计）
 * @param {number} userId - 用户ID
 * @returns {Promise<number>} 今日下载次数
 */
async function getTodayDownloadCount(userId) {
  try {
    const result = await query(`
      SELECT COUNT(*) as download_count
      FROM download_records
      WHERE user_id = $1
        AND DATE(downloaded_at) = CURRENT_DATE
        AND is_successful = true
    `, [userId]);

    return parseInt(result.rows[0].download_count) || 0;

  } catch (error) {
    logger.error('获取今日下载次数失败:', error);
    return 0;
  }
}

/**
 * 获取用户今日消耗的下载配额次数（只统计通过下载次数购买的资源）
 * @param {number} userId - 用户ID
 * @returns {Promise<number>} 今日消耗的下载配额次数
 */
async function getTodayConsumedDownloads(userId) {
  try {
    const result = await query(`
      SELECT COUNT(*) as consumed_count
      FROM daily_purchases
      WHERE user_id = $1
        AND purchase_date = CURRENT_DATE
        AND points_cost = 0
    `, [userId]);

    return parseInt(result.rows[0].consumed_count) || 0;

  } catch (error) {
    logger.error('获取今日消耗下载配额失败:', error);
    return 0;
  }
}

/**
 * 批量重置所有用户的每日下载次数并清理过期购买记录（定时任务使用）
 * @returns {Promise<number>} 重置的用户数量
 */
async function resetAllUsersDailyDownloads() {
  try {
    // 重置用户每日下载次数
    const result = await query(`
      UPDATE users
      SET
        daily_downloads_used = 0,
        last_download_reset_date = CURRENT_DATE
      WHERE last_download_reset_date < CURRENT_DATE
        AND is_vip = true
        AND vip_level > 0
      RETURNING id
    `);

    const resetCount = result.rows.length;

    // 清理昨天及之前的购买记录
    const cleanupResult = await query(`
      DELETE FROM daily_purchases
      WHERE purchase_date < CURRENT_DATE
    `);

    const cleanupCount = cleanupResult.rowCount || 0;

    logger.info(`批量重置了 ${resetCount} 个用户的每日下载次数，清理了 ${cleanupCount} 条过期购买记录`);

    return resetCount;

  } catch (error) {
    logger.error('批量重置每日下载次数失败:', error);
    throw error;
  }
}

/**
 * 获取用户下载统计信息
 * @param {number} userId - 用户ID
 * @returns {Promise<Object>} 下载统计
 */
async function getUserDownloadStats(userId) {
  try {
    const downloadStatus = await checkAndResetDailyDownloads(userId);
    const todayCount = await getTodayDownloadCount(userId);
    const todayConsumed = await getTodayConsumedDownloads(userId);

    // 获取本周下载次数
    const weekResult = await query(`
      SELECT COUNT(*) as week_count
      FROM download_records
      WHERE user_id = $1
        AND downloaded_at >= DATE_TRUNC('week', CURRENT_DATE)
        AND is_successful = true
    `, [userId]);

    // 获取本月下载次数
    const monthResult = await query(`
      SELECT COUNT(*) as month_count
      FROM download_records
      WHERE user_id = $1
        AND downloaded_at >= DATE_TRUNC('month', CURRENT_DATE)
        AND is_successful = true
    `, [userId]);

    // 获取总下载次数
    const totalResult = await query(`
      SELECT COUNT(*) as total_count
      FROM download_records
      WHERE user_id = $1 AND is_successful = true
    `, [userId]);

    return {
      daily: {
        limit: downloadStatus.dailyLimit,
        used: todayConsumed, // 使用实际消耗的下载配额次数
        remaining: Math.max(0, downloadStatus.dailyLimit - todayConsumed), // 基于实际消耗计算剩余
        canDownload: todayConsumed < downloadStatus.dailyLimit
      },
      statistics: {
        today: todayCount,
        thisWeek: parseInt(weekResult.rows[0].week_count) || 0,
        thisMonth: parseInt(monthResult.rows[0].month_count) || 0,
        total: parseInt(totalResult.rows[0].total_count) || 0
      }
    };

  } catch (error) {
    logger.error('获取用户下载统计失败:', error);
    throw error;
  }
}

module.exports = {
  checkAndResetDailyDownloads,
  getUserActualDownloadLimit,
  consumeDownload,
  recordDownload,
  getTodayDownloadCount,
  getTodayConsumedDownloads,
  resetAllUsersDailyDownloads,
  getUserDownloadStats
};
