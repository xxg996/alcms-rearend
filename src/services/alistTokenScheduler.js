/**
 * Alist Token定时刷新服务
 * 每39小时自动刷新一次Alist访问令牌
 */

const { alistClient } = require('../utils/alistClient');
const { logger } = require('../utils/logger');

class AlistTokenScheduler {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    // 39小时的毫秒数
    this.refreshInterval = 39 * 60 * 60 * 1000;
  }

  /**
   * 启动定时刷新任务
   */
  start() {
    if (this.isRunning) {
      logger.warn('Alist token定时刷新任务已在运行中');
      return;
    }

    logger.info('启动Alist token定时刷新任务', {
      interval: '39小时',
      intervalMs: this.refreshInterval
    });

    // 立即执行一次检查
    this.executeTask();

    // 设置定时任务
    this.intervalId = setInterval(() => {
      this.executeTask();
    }, this.refreshInterval);

    this.isRunning = true;
  }

  /**
   * 停止定时刷新任务
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('Alist token定时刷新任务已停止');
  }

  /**
   * 执行刷新任务
   */
  async executeTask() {
    try {
      logger.info('执行Alist token定时刷新检查');
      await alistClient.tokenRefreshTask();
    } catch (error) {
      logger.error('Alist token定时刷新任务执行失败:', error);
    }
  }

  /**
   * 手动触发刷新
   */
  async manualRefresh() {
    try {
      logger.info('手动触发Alist token刷新');
      const success = await alistClient.forceRefreshToken();

      if (success) {
        logger.info('手动Alist token刷新成功');
        return { success: true, message: 'Token刷新成功' };
      } else {
        logger.warn('手动Alist token刷新失败');
        return { success: false, message: 'Token刷新失败' };
      }
    } catch (error) {
      logger.error('手动Alist token刷新异常:', error);
      return { success: false, message: `Token刷新异常: ${error.message}` };
    }
  }

  /**
   * 获取任务状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      refreshInterval: this.refreshInterval,
      refreshIntervalHours: this.refreshInterval / (60 * 60 * 1000),
      nextRefresh: this.isRunning ?
        new Date(Date.now() + this.refreshInterval).toISOString() :
        null
    };
  }
}

// 创建单例实例
const alistTokenScheduler = new AlistTokenScheduler();

module.exports = {
  alistTokenScheduler,
  AlistTokenScheduler
};