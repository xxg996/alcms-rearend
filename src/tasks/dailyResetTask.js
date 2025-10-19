/**
 * 每日重置任务
 * 每天凌晨自动重置用户下载次数
 */

const cron = require('node-cron');
const { resetAllUsersDailyDownloads } = require('../utils/downloadLimitUtils');
const VIP = require('../models/VIP');
const { logger } = require('../utils/logger');

/**
 * 启动每日重置任务
 * 每天凌晨0点执行
 */
function startDailyResetTask() {
  // 每天凌晨0点执行重置任务
  const job = cron.schedule('0 0 * * *', async () => {
    try {
      logger.info('开始执行每日下载次数重置任务...');

      const resetCount = await resetAllUsersDailyDownloads();

      logger.info(`每日下载次数重置任务完成，重置了 ${resetCount} 个用户的下载次数`);
    } catch (error) {
      logger.error('每日下载次数重置任务失败:', error);
    }
  }, {
    timezone: 'Asia/Shanghai' // 使用中国时区
  });

  logger.info('每日下载次数重置任务已启动，将在每天凌晨0点执行');
  return job;
}

/**
 * 启动VIP过期检测任务
 * 每分钟检查一次，及时取消已过期的VIP身份
 */
function startVipExpirationTask() {
  const job = cron.schedule('* * * * *', async () => {
    try {
      const expiredUsers = await VIP.updateExpiredVIP();

      if (expiredUsers.length > 0) {
        logger.info('自动处理过期VIP用户', {
          processed: expiredUsers.length,
          userIds: expiredUsers.map((user) => user.id)
        });
      }
    } catch (error) {
      logger.error('自动更新过期VIP用户失败:', error);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  logger.info('VIP过期检测任务已启动，将每分钟执行一次');
  return job;
}

/**
 * 手动执行重置任务（用于测试）
 */
async function executeResetTask() {
  try {
    logger.info('手动执行每日下载次数重置任务...');

    const resetCount = await resetAllUsersDailyDownloads();

    logger.info(`手动重置任务完成，重置了 ${resetCount} 个用户的下载次数`);
    return resetCount;
  } catch (error) {
    logger.error('手动重置任务失败:', error);
    throw error;
  }
}

module.exports = {
  startDailyResetTask,
  startVipExpirationTask,
  executeResetTask
};
