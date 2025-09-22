/**
 * 下载管理控制器
 * 处理用户下载统计和限制管理
 */

const { getUserDownloadStats, resetAllUsersDailyDownloads, checkAndResetDailyDownloads, consumeDownload, recordDownload, getTodayConsumedDownloads } = require('../utils/downloadLimitUtils');
const { checkFileDownloadPermission, executeDownloadPayment } = require('../utils/downloadAuthUtils');
const ResourceFile = require('../models/ResourceFile');
const Resource = require('../models/Resource');
const { query } = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/download-stats:
 *   get:
 *     tags: [Download]
 *     summary: 获取用户下载统计
 *     description: 获取当前用户的下载次数统计和限制信息
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 下载统计获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserDownloadStats'
 *             example:
 *               success: true
 *               message: "下载统计获取成功"
 *               data:
 *                 daily:
 *                   limit: 100
 *                   used: 15
 *                   remaining: 85
 *                   canDownload: true
 *                 statistics:
 *                   today: 15
 *                   thisWeek: 45
 *                   thisMonth: 120
 *                   total: 500
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getUserDownloadStatistics = async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await getUserDownloadStats(userId);

    res.json({
      success: true,
      message: '下载统计获取成功',
      data: stats
    });
  } catch (error) {
    logger.error('获取用户下载统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取下载统计失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/download/reset-daily-limits:
 *   post:
 *     tags: [Download]
 *     summary: 重置所有用户每日下载次数
 *     description: 管理员手动重置所有用户的每日下载次数（通常由定时任务自动执行）
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 重置成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         resetCount:
 *                           type: integer
 *                           description: 重置的用户数量
 *                           example: 1250
 *             example:
 *               success: true
 *               message: "成功重置1250个用户的每日下载次数"
 *               data:
 *                 resetCount: 1250
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const resetAllDailyDownloads = async (req, res) => {
  try {
    const resetCount = await resetAllUsersDailyDownloads();

    res.json({
      success: true,
      message: `成功重置${resetCount}个用户的每日下载次数`,
      data: {
        resetCount
      }
    });
  } catch (error) {
    logger.error('重置每日下载次数失败:', error);
    res.status(500).json({
      success: false,
      message: '重置每日下载次数失败'
    });
  }
};

/**
 * 处理资源文件下载的新鉴权逻辑
 * @param {Object} resource - 资源对象
 * @param {number} userId - 用户ID
 * @param {Object} user - 完整用户信息
 * @param {Array} files - 文件列表
 * @returns {Promise<Object>} 处理结果
 */
const processResourceDownload = async (resource, userId, user, files) => {
  const results = [];
  let finalDownloadStatus = null;
  let hasAnyError = false;

  // 为每个文件单独检查权限
  for (const file of files) {
    try {
      // 检查文件下载权限
      const authResult = await checkFileDownloadPermission(file, userId, user);

      if (!authResult.canDownload) {
        results.push({
          file_id: file.id,
          file_name: file.name,
          success: false,
          reason: authResult.reason,
          cost_info: authResult.costInfo
        });
        hasAnyError = true;
        continue;
      }

      // 执行扣费
      const paymentSuccess = await executeDownloadPayment(file, userId, authResult.costInfo);

      if (!paymentSuccess) {
        results.push({
          file_id: file.id,
          file_name: file.name,
          success: false,
          reason: '扣费失败',
          cost_info: authResult.costInfo
        });
        hasAnyError = true;
        continue;
      }

      // 增加文件下载次数
      await ResourceFile.incrementDownloadCount(file.id);

      results.push({
        file_id: file.id,
        file_name: file.name,
        success: true,
        cost_info: authResult.costInfo,
        download_url: file.url
      });

      // 记录最终的下载状态
      finalDownloadStatus = authResult.finalDownloadStatus;

    } catch (error) {
      logger.error(`处理文件 ${file.id} 下载失败:`, error);
      results.push({
        file_id: file.id,
        file_name: file.name,
        success: false,
        reason: error.message || '处理失败',
        cost_info: { type: 'error', cost: 0 }
      });
      hasAnyError = true;
    }
  }

  // 如果有任何文件下载成功，增加资源下载次数
  const successCount = results.filter(r => r.success).length;
  if (successCount > 0) {
    await Resource.incrementDownloadCount(resource.id);
  }

  // 如果没有设置 finalDownloadStatus，获取当前状态
  if (!finalDownloadStatus) {
    finalDownloadStatus = await checkAndResetDailyDownloads(userId);
  }

  return {
    results,
    finalDownloadStatus,
    hasError: hasAnyError,
    successCount,
    totalCount: files.length
  };
};

/**
 * @swagger
 * /api/file/{resourceId}:
 *   get:
 *     tags: [Download]
 *     summary: 下载资源文件
 *     description: |
 *       根据资源ID下载该资源的所有文件，采用新的文件级权限控制系统。
 *
 *       **文件级权限控制：**
 *       每个文件在resource_files表中都有独立的权限配置：
 *       - `required_points`: 下载该文件所需积分
 *       - `required_vip_level`: 下载该文件所需VIP等级
 *
 *       **权限检查优先级：**
 *       1. **今日已购买**：如果今天已下载过该文件，免费重复下载
 *       2. **VIP免费权限**：如果文件设置了VIP要求且用户VIP等级满足，免费下载
 *       3. **下载次数优先**：有剩余下载次数时，优先使用次数（不扣积分）
 *       4. **积分支付**：没有下载次数时，使用积分支付
 *
 *       **费用类型：**
 *       - `downloaded_today`: 今日已下载，免费
 *       - `vip_free`: VIP用户免费下载
 *       - `download_count`: 消耗1次下载次数
 *       - `points`: 消耗指定积分数量
 *       - `free`: 完全免费（无任何要求）
 *
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: resourceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 资源ID
 *     responses:
 *       200:
 *         description: 下载成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         files:
 *                           type: array
 *                           description: 文件列表
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                                 description: 文件ID
 *                               name:
 *                                 type: string
 *                                 description: 文件名称
 *                               url:
 *                                 type: string
 *                                 format: uri
 *                                 description: 下载链接
 *                               file_size:
 *                                 type: integer
 *                                 description: 文件大小
 *                               file_type:
 *                                 type: string
 *                                 description: 文件类型
 *                               quality:
 *                                 type: string
 *                                 description: 文件质量
 *                               version:
 *                                 type: string
 *                                 description: 文件版本
 *                         remaining_downloads:
 *                           type: integer
 *                           description: 剩余下载次数
 *                         cost_info:
 *                           type: object
 *                           properties:
 *                             type:
 *                               type: string
 *                               enum: [free, download_count, points, purchased_today]
 *                               description: 计费类型
 *                             cost:
 *                               type: integer
 *                               description: 消耗的次数或积分
 *       400:
 *         description: 请求参数错误
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: |
 *           权限不足或资源不可用。可能的原因包括：
 *           - 用户积分不足以支付文件下载费用
 *           - 用户VIP等级不满足文件要求
 *           - 用户今日下载次数已用完且积分不足
 *           - 文件已被禁用（is_active=false）
 *           - 文件已被删除
 *       404:
 *         description: 资源不存在或无可用文件
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const downloadResourceFiles = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const userId = req.user.id;
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.connection.remoteAddress;

    // 获取资源信息
    const resource = await Resource.findById(parseInt(resourceId));
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: '资源不存在'
      });
    }

    // 检查资源是否发布
    if (resource.status !== 'published') {
      return res.status(403).json({
        success: false,
        message: '资源未发布'
      });
    }

    // 获取用户完整信息（包含VIP等级和积分）
    const userResult = await query(`
      SELECT id, points, vip_level, daily_download_limit
      FROM users
      WHERE id = $1
    `, [userId]);

    const user = userResult.rows[0];
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户信息不存在'
      });
    }

    // 获取资源的所有激活文件
    const files = await ResourceFile.findByResourceId(parseInt(resourceId), {
      includeInactive: false // 只获取激活的文件
    });

    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        message: '该资源暂无可下载文件'
      });
    }

    // 处理下载逻辑（新的基于文件级权限的逻辑）
    const downloadResult = await processResourceDownload(resource, userId, user, files);

    // 如果有任何文件下载成功，记录下载行为
    if (downloadResult.successCount > 0) {
      const successfulFiles = downloadResult.results
        .filter(r => r.success)
        .map(r => r.download_url)
        .join(', ');

      await recordDownload({
        userId,
        resourceId: resource.id,
        ipAddress,
        userAgent,
        downloadUrl: successfulFiles,
        expiresAt: null,
        isSuccessful: true
      });
    }

    // 获取实际消耗的下载配额次数以正确显示统计
    const todayConsumed = await getTodayConsumedDownloads(userId);
    const dailyLimit = downloadResult.finalDownloadStatus ? downloadResult.finalDownloadStatus.dailyLimit : 10;

    // 检查是否有任何下载失败
    if (downloadResult.hasError && downloadResult.successCount === 0) {
      // 所有文件都下载失败
      const firstError = downloadResult.results.find(r => !r.success);
      return res.status(403).json({
        success: false,
        message: firstError ? firstError.reason : '下载失败',
        data: {
          resource: {
            id: resource.id,
            title: resource.title,
            description: resource.description
          },
          results: downloadResult.results,
          remaining_downloads: Math.max(0, dailyLimit - todayConsumed)
        }
      });
    }

    // 构建成功的响应
    const successfulFiles = downloadResult.results
      .filter(r => r.success)
      .map(r => ({
        id: r.file_id,
        name: r.file_name,
        url: r.download_url,
        cost_info: r.cost_info
      }));

    const responseMessage = downloadResult.hasError
      ? `部分文件下载成功（${downloadResult.successCount}/${downloadResult.totalCount}）`
      : '所有文件下载成功';

    res.json({
      success: true,
      message: responseMessage,
      data: {
        resource: {
          id: resource.id,
          title: resource.title,
          description: resource.description
        },
        files: successfulFiles,
        failed_files: downloadResult.results.filter(r => !r.success),
        total_files: downloadResult.totalCount,
        success_count: downloadResult.successCount,
        remaining_downloads: Math.max(0, dailyLimit - todayConsumed),
        download_summary: {
          has_errors: downloadResult.hasError,
          success_count: downloadResult.successCount,
          total_count: downloadResult.totalCount
        }
      }
    });

  } catch (error) {
    logger.error('文件下载失败:', error);
    res.status(500).json({
      success: false,
      message: '文件下载失败',
      error: error.message
    });
  }
};

/**
 * @swagger
 * /api/files/{resourceId}:
 *   get:
 *     tags: [Download]
 *     summary: 获取资源文件列表
 *     description: |
 *       根据资源ID获取该资源的文件列表信息，包含文件的权限配置。
 *
 *       **响应内容：**
 *       - 未登录用户：返回基本文件信息（不包含下载链接）
 *       - 已登录用户：额外返回用户下载状态信息（user_download_status字段）
 *
 *       **user_download_status字段说明：**
 *       - daily_limit: 每日下载次数限制
 *       - daily_used: 今日已使用次数
 *       - remaining_downloads: 剩余下载次数
 *       - can_download: 是否还能下载
 *       - purchased_today: 今日是否已购买过该资源
 *       - has_files: 该资源是否有可下载文件
 *     parameters:
 *       - in: path
 *         name: resourceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 资源ID
 *     security:
 *       - BearerAuth: []
 *       - {}
 *     responses:
 *       200:
 *         description: 文件列表获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         resource:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                               description: 资源ID
 *                             title:
 *                               type: string
 *                               description: 资源标题
 *                             description:
 *                               type: string
 *                               description: 资源描述
 *                         files:
 *                           type: array
 *                           description: 文件列表
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                                 description: 文件ID
 *                               name:
 *                                 type: string
 *                                 description: 文件名称
 *                               file_size:
 *                                 type: integer
 *                                 description: 文件大小
 *                               file_type:
 *                                 type: string
 *                                 description: 文件类型
 *                               file_extension:
 *                                 type: string
 *                                 description: 文件扩展名
 *                               quality:
 *                                 type: string
 *                                 description: 文件质量
 *                               version:
 *                                 type: string
 *                                 description: 文件版本
 *                               language:
 *                                 type: string
 *                                 description: 语言
 *                               is_active:
 *                                 type: boolean
 *                                 description: 是否启用
 *                               download_count:
 *                                 type: integer
 *                                 description: 下载次数
 *                               required_points:
 *                                 type: integer
 *                                 description: 下载该文件所需积分
 *                               required_vip_level:
 *                                 type: integer
 *                                 description: 下载该文件所需VIP等级
 *                         total_files:
 *                           type: integer
 *                           description: 文件总数
 *             example:
 *               success: true
 *               message: "文件列表获取成功"
 *               data:
 *                 resource:
 *                   id: 1
 *                   title: "示例资源"
 *                   description: "这是一个示例资源"
 *                 files:
 *                   - id: 1
 *                     name: "document.pdf"
 *                     file_size: 1024000
 *                     file_type: "application/pdf"
 *                     file_extension: "pdf"
 *                     quality: "high"
 *                     version: "1.0"
 *                     language: "zh-CN"
 *                     is_active: true
 *                     download_count: 100
 *                     required_points: 10
 *                     required_vip_level: 0
 *                 total_files: 1
 *       400:
 *         description: 请求参数错误
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: 资源不存在
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getResourceFilesList = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const userId = req.user?.id;

    // 获取资源信息
    const resource = await Resource.findById(parseInt(resourceId));
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: '资源不存在'
      });
    }

    // 检查资源是否发布
    if (resource.status !== 'published') {
      return res.status(403).json({
        success: false,
        message: '资源未发布'
      });
    }

    // 获取资源的所有文件（包含禁用的文件）
    const files = await ResourceFile.findByResourceId(parseInt(resourceId), {
      includeInactive: true
    });

    // 格式化文件列表（不包含下载链接）
    const formattedFiles = files.map(file => ({
      id: file.id,
      name: file.name,
      file_size: file.file_size,
      file_type: file.file_type,
      file_extension: file.file_extension,
      quality: file.quality,
      version: file.version,
      language: file.language,
      is_active: file.is_active,
      sort_order: file.sort_order,
      download_count: file.download_count,
      required_points: file.required_points || 0,
      required_vip_level: file.required_vip_level || 0
    }));

    // 准备响应数据
    const responseData = {
      resource: {
        id: resource.id,
        title: resource.title,
        description: resource.description
      },
      files: formattedFiles,
      total_files: formattedFiles.length
    };

    // 如果用户已登录，添加下载状态信息
    if (userId) {
      const { checkAndResetDailyDownloads } = require('../utils/downloadLimitUtils');
      const downloadStatus = await checkAndResetDailyDownloads(userId);

      // 检查今日是否已购买过该资源
      const purchaseCheck = await query(`
        SELECT id, points_cost, file_id FROM daily_purchases
        WHERE user_id = $1 AND resource_id = $2 AND purchase_date = CURRENT_DATE
      `, [userId, resource.id]);

      const hasPurchasedToday = purchaseCheck.rows.length > 0;
      const purchase = purchaseCheck.rows[0];

      responseData.user_download_status = {
        daily_limit: downloadStatus.dailyLimit,
        daily_used: downloadStatus.dailyUsed,
        remaining_downloads: downloadStatus.remainingDownloads,
        can_download: downloadStatus.canDownload,
        purchased_today: hasPurchasedToday,
        has_files: formattedFiles.length > 0,
        purchased_info: hasPurchasedToday ? {
          cost_type: purchase.points_cost > 0 ? 'points' : 'download_count',
          cost: purchase.points_cost || 1,
          file_id: purchase.file_id
        } : null
      };
    }

    res.json({
      success: true,
      message: '文件列表获取成功',
      data: responseData
    });

  } catch (error) {
    logger.error('获取文件列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取文件列表失败',
      error: error.message
    });
  }
};

/**
 * @swagger
 * /api/download/{resourceId}:
 *   get:
 *     tags: [Download]
 *     summary: 下载资源文件（简化接口）
 *     description: 下载指定资源的文件，返回文件列表和下载统计信息
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: resourceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 资源ID
 *     responses:
 *       200:
 *         description: 下载成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         files:
 *                           type: array
 *                           description: 文件列表
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                                 description: 文件ID
 *                               name:
 *                                 type: string
 *                                 description: 文件名称
 *                               url:
 *                                 type: string
 *                                 format: uri
 *                                 description: 下载链接
 *                               file_size:
 *                                 type: integer
 *                                 description: 文件大小
 *                               file_type:
 *                                 type: string
 *                                 description: 文件类型
 *                               download_count:
 *                                 type: integer
 *                                 description: 下载次数
 *                         download_stats:
 *                           type: object
 *                           properties:
 *                             today_downloads:
 *                               type: integer
 *                               description: 今日下载次数
 *                             remaining_downloads:
 *                               type: integer
 *                               description: 剩余下载次数
 *                             daily_limit:
 *                               type: integer
 *                               description: 每日限制
 *                             can_download:
 *                               type: boolean
 *                               description: 是否可以下载
 *                         cost_info:
 *                           type: object
 *                           properties:
 *                             type:
 *                               type: string
 *                               description: 计费类型
 *                             cost:
 *                               type: integer
 *                               description: 消耗的次数或积分
 *             example:
 *               success: true
 *               message: "下载成功"
 *               data:
 *                 files:
 *                   - id: 1
 *                     name: "demo.pdf"
 *                     url: "https://example.com/demo.pdf"
 *                     file_size: 1024000
 *                     file_type: "document"
 *                     download_count: 100
 *                 download_stats:
 *                   today_downloads: 5
 *                   remaining_downloads: 5
 *                   daily_limit: 10
 *                   can_download: true
 *                 cost_info:
 *                   type: "download_count"
 *                   cost: 1
 *       400:
 *         description: 请求参数错误
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: 权限不足或次数/积分不足
 *       404:
 *         description: 资源不存在或无可用文件
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const downloadResource = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const userId = req.user.id;
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.connection.remoteAddress;

    // 获取资源信息
    const resource = await Resource.findById(parseInt(resourceId));
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: '资源不存在'
      });
    }

    // 检查资源是否发布
    if (resource.status !== 'published') {
      return res.status(403).json({
        success: false,
        message: '资源未发布'
      });
    }

    // 获取资源的所有文件
    const files = await ResourceFile.findByResourceId(parseInt(resourceId), {
      includeInactive: true
    });

    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        message: '该资源暂无可下载文件'
      });
    }

    // 处理下载逻辑
    const { costInfo, finalDownloadStatus } = await processResourceDownload(resource, userId, files);

    // 记录下载行为
    await recordDownload({
      userId,
      resourceId: resource.id,
      ipAddress,
      userAgent,
      downloadUrl: files.map(f => f.url).join(', '),
      expiresAt: null,
      isSuccessful: true
    });

    // 获取实际消耗的下载配额次数以正确显示统计
    const todayConsumed = await getTodayConsumedDownloads(userId);
    const dailyLimit = finalDownloadStatus.dailyLimit || 10;

    // 格式化文件列表
    const formattedFiles = files.map(file => ({
      id: file.id,
      name: file.name,
      url: file.url,
      file_size: file.file_size,
      file_type: file.file_type,
      file_extension: file.file_extension,
      quality: file.quality,
      version: file.version,
      language: file.language,
      download_count: file.download_count
    }));

    res.json({
      success: true,
      message: '下载成功',
      data: {
        resource: {
          id: resource.id,
          title: resource.title,
          description: resource.description
        },
        files: formattedFiles,
        download_stats: {
          today_downloads: todayConsumed,
          remaining_downloads: Math.max(0, dailyLimit - todayConsumed),
          daily_limit: dailyLimit,
          can_download: todayConsumed < dailyLimit
        },
        cost_info: costInfo
      }
    });

  } catch (error) {
    logger.error('下载失败:', error);
    res.status(500).json({
      success: false,
      message: '下载失败',
      error: error.message
    });
  }
};

/**
 * @swagger
 * /api/user-filestats:
 *   get:
 *     tags: [Download]
 *     summary: 获取当前用户下载统计
 *     description: 获取当前用户的详细下载统计信息，包括今日下载次数和剩余次数
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 获取用户统计成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user_info:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                               description: 用户ID
 *                             username:
 *                               type: string
 *                               description: 用户名
 *                             nickname:
 *                               type: string
 *                               description: 昵称
 *                             points:
 *                               type: integer
 *                               description: 当前积分
 *                         download_stats:
 *                           type: object
 *                           properties:
 *                             today_downloads:
 *                               type: integer
 *                               description: 今日下载次数
 *                             remaining_downloads:
 *                               type: integer
 *                               description: 剩余下载次数
 *                             daily_limit:
 *                               type: integer
 *                               description: 每日下载限制
 *                             can_download:
 *                               type: boolean
 *                               description: 是否可以继续下载
 *                             reset_time:
 *                               type: string
 *                               format: date-time
 *                               description: 下次重置时间
 *                         statistics:
 *                           type: object
 *                           properties:
 *                             today:
 *                               type: integer
 *                               description: 今日下载次数
 *                             this_week:
 *                               type: integer
 *                               description: 本周下载次数
 *                             this_month:
 *                               type: integer
 *                               description: 本月下载次数
 *                             total:
 *                               type: integer
 *                               description: 总下载次数
 *             example:
 *               success: true
 *               message: "用户统计获取成功"
 *               data:
 *                 user_info:
 *                   id: 1
 *                   username: "demo_user"
 *                   nickname: "演示用户"
 *                   points: 500
 *                 download_stats:
 *                   today_downloads: 3
 *                   remaining_downloads: 7
 *                   daily_limit: 10
 *                   can_download: true
 *                   reset_time: "2025-01-20T00:00:00.000Z"
 *                 statistics:
 *                   today: 3
 *                   this_week: 15
 *                   this_month: 45
 *                   total: 150
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getCurrentUserStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // 获取用户基本信息
    const userResult = await query(`
      SELECT id, username, nickname, points
      FROM users
      WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const userInfo = userResult.rows[0];

    // 获取下载统计
    const downloadStats = await getUserDownloadStats(userId);
    const downloadStatus = await checkAndResetDailyDownloads(userId);

    // 计算下次重置时间（明天凌晨）
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    res.json({
      success: true,
      message: '用户统计获取成功',
      data: {
        user_info: {
          id: userInfo.id,
          username: userInfo.username,
          nickname: userInfo.nickname,
          points: parseInt(userInfo.points) || 0
        },
        download_stats: {
          today_downloads: downloadStats.daily.used || 0,
          remaining_downloads: downloadStats.daily.remaining || downloadStats.daily.limit || 10,
          daily_limit: downloadStats.daily.limit || 10,
          can_download: downloadStats.daily.canDownload !== false,
          reset_time: tomorrow.toISOString()
        },
        statistics: downloadStats.statistics
      }
    });

  } catch (error) {
    logger.error('获取用户统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户统计失败'
    });
  }
};

module.exports = {
  getUserDownloadStatistics,
  resetAllDailyDownloads,
  downloadResourceFiles,
  getResourceFilesList,
  downloadResource,
  getCurrentUserStats
};
