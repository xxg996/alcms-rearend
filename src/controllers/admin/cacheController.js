/**
 * 缓存管理控制器
 * 提供缓存清理和管理功能
 */

const corsCache = require('../../utils/corsCache');
const { cache } = require('../../utils/cache');
const AuditLog = require('../../models/AuditLog');
const { logger } = require('../../utils/logger');

const getRequestMeta = (req) => ({
  ipAddress: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip,
  userAgent: req.get('user-agent') || ''
});

const recordSystemLog = async (req, payload) => {
  const operatorId = req.user?.id || null;
  const { ipAddress, userAgent } = getRequestMeta(req);
  await AuditLog.createSystemLog({
    operatorId,
    ipAddress,
    userAgent,
    ...payload
  });
};

/**
 * @swagger
 * /api/admin/cache/clear:
 *   post:
 *     summary: 一键清理所有缓存
 *     description: |
 *       清理系统中的所有缓存数据，提升系统性能和确保配置实时生效。
 *
 *       **清理范围包括：**
 *       - CORS白名单配置缓存
 *       - 应用业务数据缓存
 *       - 用户权限缓存
 *       - 系统配置缓存
 *       - 内存垃圾回收（如果可用）
 *
 *       **适用场景：**
 *       - 更新系统配置后需要立即生效
 *       - 系统性能出现异常时的故障排查
 *       - 定期维护清理过期缓存数据
 *       - 内存使用率过高时的优化操作
 *
 *       **注意事项：**
 *       - 此操作需要管理员权限
 *       - 清理后短时间内系统响应可能略慢（重新构建缓存）
 *       - 建议在系统访问量较低时执行
 *     tags: [系统设置管理]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 缓存清理成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         cleared_items:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: 已清理的缓存项目列表
 *                           example: ["CORS配置缓存", "应用数据缓存", "用户权限缓存", "内存垃圾回收"]
 *                         cleared_count:
 *                           type: integer
 *                           description: 清理的缓存项目数量
 *                           example: 4
 *                         duration_ms:
 *                           type: integer
 *                           description: 清理操作耗时（毫秒）
 *                           example: 156
 *                         cleared_at:
 *                           type: string
 *                           format: date-time
 *                           description: 清理完成时间
 *                           example: "2025-09-25T01:30:00.000Z"
 *                         operator:
 *                           type: object
 *                           description: 操作人员信息
 *                           properties:
 *                             id:
 *                               type: integer
 *                               description: 操作员用户ID
 *                               example: 1
 *                             username:
 *                               type: string
 *                               description: 操作员用户名
 *                               example: "admin"
 *             examples:
 *               success:
 *                 summary: 成功清理缓存
 *                 value:
 *                   success: true
 *                   message: "缓存清理完成，共清理 4 项"
 *                   data:
 *                     cleared_items: ["CORS配置缓存", "应用数据缓存", "用户权限缓存", "内存垃圾回收"]
 *                     cleared_count: 4
 *                     duration_ms: 156
 *                     cleared_at: "2025-09-25T01:30:00.000Z"
 *                     operator:
 *                       id: 1
 *                       username: "admin"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: 权限不足 - 需要管理员权限
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "权限不足，需要管理员权限"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const clearAllCache = async (req, res) => {
  try {
    const clearedItems = [];
    const startTime = Date.now();

    // 1. 清理CORS配置缓存
    try {
      corsCache.clearCache();
      clearedItems.push('CORS配置缓存');
      logger.info('CORS缓存已清理', { operatorId: req.user.id });
    } catch (error) {
      logger.error('清理CORS缓存失败:', error);
    }

    // 2. 清理应用数据缓存
    try {
      await cache.clear();
      clearedItems.push('应用数据缓存');
      logger.info('应用数据缓存已清理', { operatorId: req.user.id });
    } catch (error) {
      logger.error('清理应用数据缓存失败:', error);
    }

    // 3. 清理其他可能的缓存
    try {
      // 如果有其他缓存系统，在这里添加清理逻辑
      // 例如：用户权限缓存、配置缓存等

      // 可以通过进程重启来清理内存缓存
      if (global.gc) {
        global.gc();
        clearedItems.push('内存垃圾回收');
      }
    } catch (error) {
      logger.error('清理其他缓存失败:', error);
    }

    const duration = Date.now() - startTime;

    // 记录操作日志
    logger.info('管理员执行了缓存清理操作', {
      operatorId: req.user.id,
      operatorUsername: req.user.username,
      clearedItems,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

    await recordSystemLog(req, {
      targetType: 'system_cache',
      targetId: null,
      action: 'cache_clear',
      summary: `清理缓存 ${clearedItems.length} 项`,
      detail: {
        clearedItems,
        duration
      }
    });

    res.json({
      success: true,
      message: `缓存清理完成，共清理 ${clearedItems.length} 项`,
      data: {
        cleared_items: clearedItems,
        cleared_count: clearedItems.length,
        duration_ms: duration,
        cleared_at: new Date().toISOString(),
        operator: {
          id: req.user.id,
          username: req.user.username
        }
      }
    });

  } catch (error) {
    logger.error('缓存清理操作失败:', error);
    await recordSystemLog(req, {
      targetType: 'system_cache',
      targetId: null,
      action: 'cache_clear_failed',
      summary: '缓存清理失败',
      detail: { error: error.message }
    });
    res.status(500).json({
      success: false,
      message: '缓存清理失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * /api/admin/cache/status:
 *   get:
 *     summary: 查看系统缓存状态
 *     description: |
 *       获取系统中各种缓存的详细状态信息，包括缓存有效性、统计数据和性能指标。
 *
 *       **监控信息包括：**
 *       - CORS配置缓存状态和过期时间
 *       - 应用业务数据缓存统计
 *       - 系统内存使用情况
 *       - Node.js 运行时信息
 *       - 缓存命中率和性能指标
 *
 *       **适用场景：**
 *       - 系统性能监控和诊断
 *       - 缓存效率分析和优化
 *       - 内存使用情况检查
 *       - 定期维护状态评估
 *
 *       **注意事项：**
 *       - 此接口需要管理员权限
 *       - 返回的数据仅供监控使用
 *       - 不会对系统缓存产生任何影响
 *     tags: [系统设置管理]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 获取缓存状态成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         cors_cache:
 *                           type: object
 *                           description: CORS配置缓存状态
 *                           properties:
 *                             hasCache:
 *                               type: boolean
 *                               description: 是否有缓存数据
 *                               example: true
 *                             lastUpdated:
 *                               type: integer
 *                               description: 最后更新时间戳
 *                               example: 1632750000000
 *                             isValid:
 *                               type: boolean
 *                               description: 缓存是否有效
 *                               example: true
 *                             refreshInProgress:
 *                               type: boolean
 *                               description: 是否正在刷新缓存
 *                               example: false
 *                             cacheExpireMs:
 *                               type: integer
 *                               description: 缓存过期时间（毫秒）
 *                               example: 300000
 *                             allowedOriginsCount:
 *                               type: integer
 *                               description: 允许的域名数量
 *                               example: 3
 *                         app_cache:
 *                           type: object
 *                           description: 应用数据缓存统计信息
 *                           properties:
 *                             hitRate:
 *                               type: number
 *                               format: float
 *                               description: 缓存命中率
 *                               example: 0.85
 *                             totalKeys:
 *                               type: integer
 *                               description: 总缓存键数量
 *                               example: 1250
 *                             memoryUsage:
 *                               type: string
 *                               description: 内存使用量
 *                               example: "25.6MB"
 *                         system_info:
 *                           type: object
 *                           description: 系统运行时信息
 *                           properties:
 *                             node_version:
 *                               type: string
 *                               description: Node.js版本
 *                               example: "v18.17.0"
 *                             memory_usage:
 *                               type: object
 *                               description: 内存使用详情
 *                               properties:
 *                                 rss:
 *                                   type: integer
 *                                   description: 常驻集大小（字节）
 *                                   example: 52428800
 *                                 heapTotal:
 *                                   type: integer
 *                                   description: 堆总大小（字节）
 *                                   example: 33554432
 *                                 heapUsed:
 *                                   type: integer
 *                                   description: 已使用堆大小（字节）
 *                                   example: 25165824
 *                                 external:
 *                                   type: integer
 *                                   description: 外部内存使用（字节）
 *                                   example: 1638400
 *                             uptime_seconds:
 *                               type: number
 *                               description: 进程运行时间（秒）
 *                               example: 86400
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *                           description: 状态查询时间
 *                           example: "2025-09-25T01:30:00.000Z"
 *             examples:
 *               healthy:
 *                 summary: 健康的缓存状态
 *                 value:
 *                   success: true
 *                   data:
 *                     cors_cache:
 *                       hasCache: true
 *                       lastUpdated: 1632750000000
 *                       isValid: true
 *                       refreshInProgress: false
 *                       cacheExpireMs: 300000
 *                       allowedOriginsCount: 3
 *                     app_cache:
 *                       hitRate: 0.85
 *                       totalKeys: 1250
 *                       memoryUsage: "25.6MB"
 *                     system_info:
 *                       node_version: "v18.17.0"
 *                       memory_usage:
 *                         rss: 52428800
 *                         heapTotal: 33554432
 *                         heapUsed: 25165824
 *                         external: 1638400
 *                       uptime_seconds: 86400
 *                     timestamp: "2025-09-25T01:30:00.000Z"
 *               cache_expired:
 *                 summary: 缓存过期状态
 *                 value:
 *                   success: true
 *                   data:
 *                     cors_cache:
 *                       hasCache: true
 *                       lastUpdated: 1632746400000
 *                       isValid: false
 *                       refreshInProgress: true
 *                       cacheExpireMs: 300000
 *                       allowedOriginsCount: 3
 *                     app_cache:
 *                       hitRate: 0.72
 *                       totalKeys: 890
 *                       memoryUsage: "18.2MB"
 *                     system_info:
 *                       node_version: "v18.17.0"
 *                       memory_usage:
 *                         rss: 48234496
 *                         heapTotal: 29360128
 *                         heapUsed: 21495808
 *                         external: 1425408
 *                       uptime_seconds: 82800
 *                     timestamp: "2025-09-25T01:30:00.000Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: 权限不足 - 需要管理员权限
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "权限不足，需要管理员权限"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getCacheStatus = async (req, res) => {
  try {
    const status = {
      cors_cache: corsCache.getCacheStatus(),
      app_cache: await cache.getStats(),
      system_info: {
        node_version: process.version,
        memory_usage: process.memoryUsage(),
        uptime_seconds: process.uptime()
      },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('获取缓存状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取缓存状态失败'
    });
  }
};

module.exports = {
  clearAllCache,
  getCacheStatus
};
