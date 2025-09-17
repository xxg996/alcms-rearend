/**
 * 每日重置任务
 * 每天凌晨自动重置用户下载次数
 */

const cron = require('node-cron');
const { resetAllUsersDailyDownloads } = require('../utils/downloadLimitUtils');
const { logger } = require('../utils/logger');

/**
 * 启动每日重置任务
 * 每天凌晨0点执行
 */
function startDailyResetTask() {
  // 每天凌晨0点执行重置任务
  cron.schedule('0 0 * * *', async () => {
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
  executeResetTask
};