/**
 * 集群管理器
 * 使用 Node.js cluster 模块实现多进程架构
 */

const cluster = require('cluster');
const os = require('os');
const path = require('path');
const { logger } = require('./utils/logger');

class ClusterManager {
  constructor(options = {}) {
    this.workers = [];
    this.isProduction = process.env.NODE_ENV === 'production';
    this.numWorkers = options.workers || (this.isProduction ? os.cpus().length : 2);
    this.restartDelay = options.restartDelay || 1000;
    this.maxRestarts = options.maxRestarts || 10;
    this.restartCounts = new Map();
  }

  /**
   * 启动集群
   */
  start() {
    if (cluster.isMaster) {
      this.setupMaster();
    } else {
      this.setupWorker();
    }
  }

  /**
   * 设置主进程
   */
  setupMaster() {
    logger.info(`
╔════════════════════════════════════════╗
║     Alcms Backend Cluster Manager      ║
╠════════════════════════════════════════╣
║  主进程 PID: ${process.pid.toString().padEnd(26)}║
║  CPU 核心数: ${os.cpus().length.toString().padEnd(26)}║
║  工作进程数: ${this.numWorkers.toString().padEnd(26)}║
║  环境: ${process.env.NODE_ENV || 'development'}${' '.repeat(32 - (process.env.NODE_ENV || 'development').length)}║
╚════════════════════════════════════════╝
    `);

    // 创建工作进程
    for (let i = 0; i < this.numWorkers; i++) {
      this.createWorker();
    }

    // 监听工作进程退出事件
    cluster.on('exit', (worker, code, signal) => {
      logger.error(`工作进程 ${worker.process.pid} 退出 (${signal || code})`);
      
      // 检查重启次数
      const restartCount = this.restartCounts.get(worker.id) || 0;
      
      if (restartCount < this.maxRestarts) {
        logger.info(`正在重启工作进程...`);
        this.restartCounts.set(worker.id, restartCount + 1);
        
        setTimeout(() => {
          this.createWorker();
        }, this.restartDelay);
      } else {
        logger.error(`工作进程 ${worker.id} 重启次数超过限制，停止重启`);
      }
    });

    // 监听 SIGUSR2 信号进行优雅重启
    process.on('SIGUSR2', () => {
      logger.info('接收到 SIGUSR2 信号，开始优雅重启...');
      this.gracefulRestart();
    });

    // 监听终止信号
    process.on('SIGTERM', () => {
      logger.info('接收到 SIGTERM 信号，开始优雅关闭...');
      this.gracefulShutdown();
    });

    process.on('SIGINT', () => {
      logger.info('接收到 SIGINT 信号，开始优雅关闭...');
      this.gracefulShutdown();
    });

    // 定期报告集群状态
    this.startHealthReport();
  }

  /**
   * 创建工作进程
   */
  createWorker() {
    const worker = cluster.fork({
      WORKER_ID: this.workers.length
    });
    
    this.workers.push(worker);
    
    logger.info(`工作进程 ${worker.process.pid} 已启动`);
    
    // 监听工作进程消息
    worker.on('message', (msg) => {
      this.handleWorkerMessage(worker, msg);
    });
    
    return worker;
  }

  /**
   * 设置工作进程
   */
  setupWorker() {
    // 加载应用
    require('./app');
    
    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      logger.error('未捕获的异常:', error);
      // 通知主进程
      process.send({ 
        type: 'error', 
        error: error.message,
        stack: error.stack 
      });
      // 优雅退出
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('未处理的 Promise 拒绝:', reason);
      // 通知主进程
      process.send({ 
        type: 'error', 
        error: 'Unhandled Promise Rejection',
        reason: reason 
      });
    });
    
    // 监听关闭信号
    process.on('SIGTERM', () => {
      logger.info(`工作进程 ${process.pid} 接收到 SIGTERM 信号`);
      this.gracefulWorkerShutdown();
    });
    
    // 定期报告健康状态
    setInterval(() => {
      const memUsage = process.memoryUsage();
      process.send({
        type: 'health',
        pid: process.pid,
        memory: memUsage,
        uptime: process.uptime()
      });
    }, 30000); // 每30秒报告一次
  }

  /**
   * 处理工作进程消息
   */
  handleWorkerMessage(worker, msg) {
    switch (msg.type) {
      case 'health':
        // 更新工作进程健康状态
        worker.lastHealth = {
          ...msg,
          timestamp: Date.now()
        };
        break;
        
      case 'error':
        logger.error(`工作进程 ${worker.process.pid} 报告错误:`, msg.error);
        break;
        
      case 'metric':
        // 收集性能指标
        this.collectMetric(worker, msg.data);
        break;
        
      default:
        logger.info(`收到工作进程 ${worker.process.pid} 消息:`, msg);
    }
  }

  /**
   * 优雅重启所有工作进程
   */
  async gracefulRestart() {
    logger.info('开始优雅重启所有工作进程...');
    
    for (const worker of this.workers) {
      // 创建新的工作进程
      const newWorker = this.createWorker();
      
      // 等待新进程就绪
      await new Promise(resolve => {
        newWorker.once('listening', resolve);
        setTimeout(resolve, 5000); // 最多等待5秒
      });
      
      // 关闭旧进程
      worker.disconnect();
      
      // 设置超时强制终止
      setTimeout(() => {
        if (!worker.isDead()) {
          worker.kill();
        }
      }, 10000);
      
      // 从列表中移除旧进程
      const index = this.workers.indexOf(worker);
      if (index > -1) {
        this.workers.splice(index, 1);
      }
      
      // 延迟以避免同时重启所有进程
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    logger.info('优雅重启完成');
  }

  /**
   * 优雅关闭集群
   */
  async gracefulShutdown() {
    logger.info('开始优雅关闭集群...');
    
    // 停止接受新连接
    for (const worker of this.workers) {
      worker.disconnect();
    }
    
    // 等待所有工作进程关闭
    await Promise.all(this.workers.map(worker => {
      return new Promise((resolve) => {
        if (worker.isDead()) {
          resolve();
        } else {
          worker.on('exit', resolve);
          
          // 设置超时强制终止
          setTimeout(() => {
            if (!worker.isDead()) {
              worker.kill();
            }
            resolve();
          }, 30000); // 30秒超时
        }
      });
    }));
    
    logger.info('集群已关闭');
    process.exit(0);
  }

  /**
   * 工作进程优雅关闭
   */
  async gracefulWorkerShutdown() {
    logger.info(`工作进程 ${process.pid} 开始优雅关闭...`);
    
    // 关闭服务器，停止接受新连接
    const server = require('./app').server;
    if (server) {
      server.close(() => {
        logger.info(`工作进程 ${process.pid} HTTP 服务器已关闭`);
      });
    }
    
    // 关闭数据库连接
    try {
      const { closePool } = require('./config/database');
      await closePool();
      logger.info(`工作进程 ${process.pid} 数据库连接已关闭`);
    } catch (error) {
      logger.error('关闭数据库连接失败:', error);
    }
    
    // 关闭缓存连接
    try {
      const cacheManager = require('./utils/cache');
      await cacheManager.close();
      logger.info(`工作进程 ${process.pid} 缓存连接已关闭`);
    } catch (error) {
      logger.error('关闭缓存连接失败:', error);
    }
    
    // 等待所有异步操作完成
    setTimeout(() => {
      logger.info(`工作进程 ${process.pid} 已关闭`);
      process.exit(0);
    }, 5000);
  }

  /**
   * 启动健康报告
   */
  startHealthReport() {
    setInterval(() => {
      const report = {
        master: {
          pid: process.pid,
          uptime: process.uptime(),
          memory: process.memoryUsage()
        },
        workers: this.workers.map(worker => ({
          id: worker.id,
          pid: worker.process.pid,
          state: worker.state,
          health: worker.lastHealth || 'unknown'
        })),
        system: {
          loadAverage: os.loadavg(),
          freeMemory: os.freemem(),
          totalMemory: os.totalmem(),
          cpus: os.cpus().length
        }
      };
      
      if (process.env.NODE_ENV === 'development') {
        logger.info('集群健康报告:', JSON.stringify(report, null, 2));
      }
      
      // 可以将报告发送到监控系统
      this.sendToMonitoring(report);
    }, 60000); // 每分钟报告一次
  }

  /**
   * 发送到监控系统
   */
  sendToMonitoring(report) {
    // 这里可以集成 Prometheus、Datadog 等监控系统
    // 示例：将指标推送到 Prometheus Pushgateway
    if (process.env.PROMETHEUS_PUSHGATEWAY_URL) {
      // 实现推送逻辑
    }
  }

  /**
   * 收集性能指标
   */
  collectMetric(worker, metric) {
    // 聚合来自所有工作进程的指标
    // 可以存储在内存中或推送到外部系统
  }
}

// 导出单例
module.exports = new ClusterManager();