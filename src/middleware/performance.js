/**
 * 性能监控中间件
 * 收集和分析应用性能指标
 */

const os = require('os');
const v8 = require('v8');
const { logger } = require('../utils/logger');

// 性能指标收集器
class PerformanceCollector {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        error: 0,
        byMethod: {},
        byPath: {},
        byStatus: {}
      },
      responseTime: {
        histogram: [],
        percentiles: {},
        average: 0,
        min: Infinity,
        max: 0
      },
      throughput: {
        current: 0,
        history: []
      },
      errors: [],
      slowQueries: [],
      memory: {
        history: []
      },
      cpu: {
        history: []
      }
    };

    // 启动定期收集系统指标
    this.startSystemMetricsCollection();
  }

  /**
   * 记录请求
   */
  recordRequest(method, path, status, duration) {
    // 总请求数
    this.metrics.requests.total++;
    
    // 按状态统计
    if (status >= 200 && status < 400) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.error++;
    }

    // 按方法统计
    this.metrics.requests.byMethod[method] = 
      (this.metrics.requests.byMethod[method] || 0) + 1;

    // 按路径统计（规范化路径）
    const normalizedPath = this.normalizePath(path);
    this.metrics.requests.byPath[normalizedPath] = 
      (this.metrics.requests.byPath[normalizedPath] || 0) + 1;

    // 按状态码统计
    this.metrics.requests.byStatus[status] = 
      (this.metrics.requests.byStatus[status] || 0) + 1;

    // 记录响应时间
    this.recordResponseTime(duration);
  }

  /**
   * 规范化路径（将动态参数替换为占位符）
   */
  normalizePath(path) {
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/gi, '/:uuid')
      .replace(/\?.*$/, '');
  }

  /**
   * 记录响应时间
   */
  recordResponseTime(duration) {
    this.metrics.responseTime.histogram.push(duration);
    
    // 保留最近 1000 个样本
    if (this.metrics.responseTime.histogram.length > 1000) {
      this.metrics.responseTime.histogram.shift();
    }

    // 更新最小/最大值
    this.metrics.responseTime.min = Math.min(this.metrics.responseTime.min, duration);
    this.metrics.responseTime.max = Math.max(this.metrics.responseTime.max, duration);

    // 计算平均值
    const sum = this.metrics.responseTime.histogram.reduce((a, b) => a + b, 0);
    this.metrics.responseTime.average = sum / this.metrics.responseTime.histogram.length;

    // 计算百分位数
    this.calculatePercentiles();
  }

  /**
   * 计算百分位数
   */
  calculatePercentiles() {
    const sorted = [...this.metrics.responseTime.histogram].sort((a, b) => a - b);
    const len = sorted.length;

    this.metrics.responseTime.percentiles = {
      p50: sorted[Math.floor(len * 0.5)],
      p75: sorted[Math.floor(len * 0.75)],
      p90: sorted[Math.floor(len * 0.9)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)]
    };
  }

  /**
   * 记录错误
   */
  recordError(error, req) {
    this.metrics.errors.push({
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      user: req.user?.id
    });

    // 保留最近 100 个错误
    if (this.metrics.errors.length > 100) {
      this.metrics.errors.shift();
    }
  }

  /**
   * 记录慢查询
   */
  recordSlowQuery(query, duration) {
    if (duration > 100) { // 超过 100ms 的查询
      this.metrics.slowQueries.push({
        timestamp: new Date().toISOString(),
        query: query.substring(0, 200), // 截断长查询
        duration
      });

      // 保留最近 50 个慢查询
      if (this.metrics.slowQueries.length > 50) {
        this.metrics.slowQueries.shift();
      }
    }
  }

  /**
   * 启动系统指标收集
   */
  startSystemMetricsCollection() {
    setInterval(() => {
      // 收集内存指标
      const memUsage = process.memoryUsage();
      const heapStats = v8.getHeapStatistics();
      
      this.metrics.memory.history.push({
        timestamp: Date.now(),
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        heapLimit: heapStats.heap_size_limit,
        heapAvailable: heapStats.total_available_size
      });

      // 收集 CPU 指标
      const cpus = os.cpus();
      const cpuUsage = process.cpuUsage();
      
      this.metrics.cpu.history.push({
        timestamp: Date.now(),
        user: cpuUsage.user,
        system: cpuUsage.system,
        loadAverage: os.loadavg(),
        cores: cpus.length
      });

      // 保留最近 60 个数据点（10分钟）
      if (this.metrics.memory.history.length > 60) {
        this.metrics.memory.history.shift();
      }
      if (this.metrics.cpu.history.length > 60) {
        this.metrics.cpu.history.shift();
      }

      // 计算吞吐量
      this.calculateThroughput();
    }, 10000); // 每 10 秒收集一次
  }

  /**
   * 计算吞吐量
   */
  calculateThroughput() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // 统计最近一分钟的请求数
    const recentRequests = this.metrics.requests.total;
    
    this.metrics.throughput.current = recentRequests / 60; // 请求/秒
    this.metrics.throughput.history.push({
      timestamp: now,
      rps: this.metrics.throughput.current
    });

    // 保留最近 60 个数据点
    if (this.metrics.throughput.history.length > 60) {
      this.metrics.throughput.history.shift();
    }
  }

  /**
   * 获取性能报告
   */
  getReport() {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      summary: {
        uptime: Math.floor(uptime),
        totalRequests: this.metrics.requests.total,
        successRate: (this.metrics.requests.success / this.metrics.requests.total * 100).toFixed(2) + '%',
        averageResponseTime: this.metrics.responseTime.average.toFixed(2) + 'ms',
        currentThroughput: this.metrics.throughput.current.toFixed(2) + ' req/s',
        memoryUsage: {
          rss: (memUsage.rss / 1024 / 1024).toFixed(2) + ' MB',
          heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
          heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2) + ' MB'
        }
      },
      requests: this.metrics.requests,
      responseTime: {
        min: this.metrics.responseTime.min + 'ms',
        max: this.metrics.responseTime.max + 'ms',
        average: this.metrics.responseTime.average.toFixed(2) + 'ms',
        percentiles: Object.entries(this.metrics.responseTime.percentiles).reduce((acc, [key, value]) => {
          acc[key] = value ? value.toFixed(2) + 'ms' : 'N/A';
          return acc;
        }, {})
      },
      topEndpoints: this.getTopEndpoints(),
      recentErrors: this.metrics.errors.slice(-10),
      slowQueries: this.metrics.slowQueries.slice(-10),
      systemMetrics: {
        memory: this.metrics.memory.history.slice(-6), // 最近1分钟
        cpu: this.metrics.cpu.history.slice(-6)
      }
    };
  }

  /**
   * 获取访问最多的端点
   */
  getTopEndpoints() {
    return Object.entries(this.metrics.requests.byPath)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));
  }

  /**
   * 重置指标
   */
  reset() {
    this.metrics.requests.total = 0;
    this.metrics.requests.success = 0;
    this.metrics.requests.error = 0;
    this.metrics.requests.byMethod = {};
    this.metrics.requests.byPath = {};
    this.metrics.requests.byStatus = {};
    this.metrics.responseTime.histogram = [];
    this.metrics.errors = [];
    this.metrics.slowQueries = [];
  }
}

// 创建全局性能收集器实例
const performanceCollector = new PerformanceCollector();

/**
 * 性能监控中间件
 */
const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  const startCpu = process.cpuUsage();
  const startMem = process.memoryUsage();

  // 记录原始方法
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  const originalEnd = res.end.bind(res);

  // 响应完成处理
  const handleResponse = () => {
    const duration = Date.now() - startTime;
    const endCpu = process.cpuUsage(startCpu);
    const endMem = process.memoryUsage();

    // 记录请求
    performanceCollector.recordRequest(
      req.method,
      req.route?.path || req.path,
      res.statusCode,
      duration
    );

    // 记录慢请求
    if (duration > 1000) {
      logger.warn(`慢请求检测: ${req.method} ${req.path} - ${duration}ms`);
    }

    // 添加性能头
    if (!res.headersSent) {
      res.set({
        'X-Response-Time': `${duration}ms`,
        'X-CPU-Usage': `${(endCpu.user / 1000).toFixed(2)}ms`,
        'X-Memory-Delta': `${((endMem.heapUsed - startMem.heapUsed) / 1024).toFixed(2)}KB`
      });
    }
  };

  // 重写响应方法
  res.json = function(...args) {
    handleResponse();
    return originalJson(...args);
  };

  res.send = function(...args) {
    handleResponse();
    return originalSend(...args);
  };

  res.end = function(...args) {
    handleResponse();
    return originalEnd(...args);
  };

  // 错误处理
  const originalNext = next;
  next = (error) => {
    if (error) {
      performanceCollector.recordError(error, req);
    }
    originalNext(error);
  };

  next();
};

/**
 * 性能报告端点
 */
const performanceReport = (req, res) => {
  const report = performanceCollector.getReport();
  res.json({
    success: true,
    data: report
  });
};

/**
 * 健康检查端点（增强版）
 */
const healthCheck = async (req, res) => {
  const startTime = Date.now();
  const checks = {
    app: 'healthy',
    database: 'unknown',
    cache: 'unknown',
    memory: 'healthy',
    disk: 'healthy'
  };

  // 检查数据库连接
  try {
    const { query } = require('../config/database');
    await query('SELECT 1');
    checks.database = 'healthy';
  } catch (error) {
    checks.database = 'unhealthy';
  }

  // 检查缓存连接
  try {
    const cacheManager = require('../utils/cache');
    await cacheManager.set('health:check', Date.now(), 10);
    checks.cache = 'healthy';
  } catch (error) {
    checks.cache = 'unhealthy';
  }

  // 检查内存使用
  const memUsage = process.memoryUsage();
  const heapStats = v8.getHeapStatistics();
  const memoryUsagePercent = (memUsage.heapUsed / heapStats.heap_size_limit) * 100;
  
  if (memoryUsagePercent > 90) {
    checks.memory = 'critical';
  } else if (memoryUsagePercent > 70) {
    checks.memory = 'warning';
  }

  // 计算健康状态
  const unhealthyChecks = Object.values(checks).filter(status => 
    status === 'unhealthy' || status === 'critical'
  );
  
  const overallHealth = unhealthyChecks.length === 0 ? 'healthy' : 
                        unhealthyChecks.some(s => s === 'critical') ? 'critical' : 
                        'degraded';

  const responseTime = Date.now() - startTime;

  res.status(overallHealth === 'healthy' ? 200 : 503).json({
    status: overallHealth,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    responseTime: `${responseTime}ms`,
    checks,
    metrics: {
      memory: {
        used: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        total: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        percentage: `${memoryUsagePercent.toFixed(2)}%`
      },
      cpu: {
        loadAverage: os.loadavg()
      },
      requests: {
        total: performanceCollector.metrics.requests.total,
        successRate: `${(performanceCollector.metrics.requests.success / 
                       performanceCollector.metrics.requests.total * 100).toFixed(2)}%`
      }
    }
  });
};

module.exports = {
  performanceMonitor,
  performanceReport,
  performanceCollector,
  healthCheck
};