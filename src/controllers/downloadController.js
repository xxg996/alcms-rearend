/**
 * 下载管理控制器
 * 处理用户下载统计和限制管理
 */

const { getUserDownloadStats, resetAllUsersDailyDownloads, checkAndResetDailyDownloads, consumeDownload, recordDownload } = require('../utils/downloadLimitUtils');
const ResourceFile = require('../models/ResourceFile');
const Resource = require('../models/Resource');
const { query } = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/user/download-stats:
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
 * @swagger
 * /api/user/file/{resourceId}:
 *   get:
 *     tags: [Download]
 *     summary: 下载资源文件
 *     description: 根据资源ID下载该资源的所有文件，自动处理权限、计费和次数限制
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
 *         description: 权限不足或次数/积分不足
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

    // 获取资源的所有文件（包含禁用的文件）
    const files = await ResourceFile.findByResourceId(parseInt(resourceId), {
      includeInactive: true // 包含禁用的文件
    });

    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        message: '该资源暂无可下载文件'
      });
    }

    let costInfo = { type: 'free', cost: 0 };

    // 如果是付费资源，进行计费逻辑
    if (!resource.is_free) {
      // 先检查今日是否已购买过该资源
      const purchaseCheck = await query(`
        SELECT id, points_cost FROM daily_purchases
        WHERE user_id = $1 AND resource_id = $2 AND purchase_date = CURRENT_DATE
      `, [userId, resource.id]);

      if (purchaseCheck.rows.length > 0) {
        // 今日已购买过，可以免费下载
        const purchase = purchaseCheck.rows[0];
        costInfo = {
          type: 'purchased_today',
          cost: 0,
          original_cost: purchase.points_cost || 1  // 显示原始消耗
        };
      } else {
        // 今日未购买，需要消耗次数或积分
        const downloadStatus = await checkAndResetDailyDownloads(userId);

        if (downloadStatus.canDownload) {
          // 有下载次数，消耗次数
          await consumeDownload(userId);

          // 记录今日购买状态（用次数购买）
          await query(`
            INSERT INTO daily_purchases (user_id, resource_id, points_cost)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, resource_id, purchase_date) DO NOTHING
          `, [userId, resource.id, 0]); // points_cost = 0 表示用次数购买

          costInfo = { type: 'download_count', cost: 1 };
        } else {
          // 没有下载次数，检查是否可以用积分购买
          if (resource.required_points && resource.required_points > 0) {
            // 检查用户积分
            const userResult = await query(`
              SELECT points FROM users WHERE id = $1
            `, [userId]);

            const userPoints = userResult.rows[0]?.points || 0;

            if (userPoints < resource.required_points) {
              return res.status(403).json({
                success: false,
                message: `积分不足，需要 ${resource.required_points} 积分，当前有 ${userPoints} 积分`
              });
            }

            // 扣除积分
            await query(`
              UPDATE users SET points = points - $1 WHERE id = $2
            `, [resource.required_points, userId]);

            // 记录积分消耗
            await query(`
              INSERT INTO user_points (user_id, points, reason, resource_id)
              VALUES ($1, $2, $3, $4)
            `, [userId, -resource.required_points, '下载文件消耗积分', resource.id]);

            // 记录今日购买状态（用积分购买）
            await query(`
              INSERT INTO daily_purchases (user_id, resource_id, points_cost)
              VALUES ($1, $2, $3)
              ON CONFLICT (user_id, resource_id, purchase_date) DO NOTHING
            `, [userId, resource.id, resource.required_points]);

            costInfo = { type: 'points', cost: resource.required_points };
          } else {
            return res.status(403).json({
              success: false,
              message: '下载次数已用完且未配置积分购买'
            });
          }
        }
      }
    }

    // 记录下载行为
    await recordDownload({
      userId,
      resourceId: resource.id,
      ipAddress,
      userAgent,
      downloadUrl: files.map(f => f.url).join(', '), // 记录所有文件URL
      expiresAt: null,
      isSuccessful: true
    });

    // 增加所有文件的下载次数
    await Promise.all(files.map(file =>
      ResourceFile.incrementDownloadCount(file.id)
    ));

    // 获取更新后的下载状态
    const updatedStatus = await checkAndResetDailyDownloads(userId);

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
      is_active: file.is_active,
      sort_order: file.sort_order,
      download_count: file.download_count
    }));

    res.json({
      success: true,
      message: '资源文件获取成功',
      data: {
        resource: {
          id: resource.id,
          title: resource.title,
          description: resource.description
        },
        files: formattedFiles,
        total_files: formattedFiles.length,
        remaining_downloads: updatedStatus.remainingDownloads,
        cost_info: costInfo
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

module.exports = {
  getUserDownloadStatistics,
  resetAllDailyDownloads,
  downloadResourceFiles
};