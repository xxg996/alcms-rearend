/**
 * Alist文件管理控制器
 * 提供Alist文件详情获取和下载链接生成功能
 */

const AlistResource = require('../models/AlistResource');
const { alistClient, AlistClient } = require('../utils/alistClient');
const { logger } = require('../utils/logger');
const { query } = require('../config/database');

/**
 * @swagger
 * /api/alist/file-info/{resourceId}:
 *   get:
 *     summary: 获取资源的Alist文件详情
 *     description: |
 *       根据资源ID获取关联的Alist文件详细信息，包括文件大小、类型、修改时间等。
 *
 *       **功能特性：**
 *       - 直接从数据库获取缓存的文件信息，响应速度快
 *       - 文件信息在用户下载时自动同步更新
 *       - 支持文件和文件夹类型
 *       - 提供文件大小格式化显示
 *       - 减少对Alist服务器的请求压力
 *
 *       **权限要求：**
 *       - 需要用户登录认证
 *       - 资源必须是官方资源(official=true)
 *       - 资源必须已关联Alist路径
 *     tags: [Alist文件管理]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: resourceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 资源ID
 *         example: 123
 *     responses:
 *       200:
 *         description: 成功获取文件详情
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
 *                         resource_id:
 *                           type: integer
 *                           description: 资源ID
 *                           example: 123
 *                         resource_title:
 *                           type: string
 *                           description: 资源标题
 *                           example: "官方软件包"
 *                         user_download_status:
 *                           type: object
 *                           description: 用户下载状态信息
 *                           properties:
 *                             remaining_daily_downloads:
 *                               type: integer
 *                               description: 当前用户剩余每日下载次数
 *                             remaining_total_downloads:
 *                               type: integer
 *                               description: 当前用户剩余总下载次数
 *                             remaining_points:
 *                               type: integer
 *                               description: 当前用户剩余积分
 *                             purchased_today:
 *                               type: boolean
 *                               description: 今日是否已购买过该资源
 *                             has_files:
 *                               type: boolean
 *                               description: 该资源是否有可下载文件
 *                             purchased_info:
 *                               type: object
 *                               nullable: true
 *                               description: 购买信息（仅当purchased_today为true时有值）
 *                               properties:
 *                                 cost_type:
 *                                   type: string
 *                                   description: 费用类型
 *                                   enum: [points, download_count]
 *                                 cost:
 *                                   type: integer
 *                                   description: 费用数量
 *                                 alist_resource_id:
 *                                   type: integer
 *                                   description: Alist资源ID
 *                                 file_id:
 *                                   type: integer
 *                                   nullable: true
 *                                   description: 文件ID（Alist下载为null）
 *                         files:
 *                           type: array
 *                           description: 文件列表（简化结构，移除重复字段）
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                                 description: 关联记录ID
 *                               path:
 *                                 type: string
 *                                 description: 文件路径
 *                                 example: "/official/software/app_v1.0.zip"
 *                               name:
 *                                 type: string
 *                                 description: 文件名称
 *                                 example: "app_v1.0.zip"
 *                               size:
 *                                 type: integer
 *                                 description: 文件大小（字节）
 *                                 example: 52428800
 *                               size_formatted:
 *                                 type: string
 *                                 description: 格式化后的文件大小
 *                                 example: "50.00 MB"
 *                               mime_type:
 *                                 type: string
 *                                 description: MIME类型
 *                                 example: "application/zip"
 *                               is_folder:
 *                                 type: boolean
 *                                 description: 是否为文件夹
 *                                 example: false
 *                               folder_size:
 *                                 type: integer
 *                                 description: 文件夹大小（字节，仅文件夹有效）
 *                                 example: 0
 *                               file_count:
 *                                 type: integer
 *                                 description: 文件夹内文件数量（仅文件夹有效）
 *                                 example: 0
 *                               last_sync_at:
 *                                 type: string
 *                                 format: date-time
 *                                 description: 最后同步时间
 *                               created_at:
 *                                 type: string
 *                                 format: date-time
 *                                 description: 创建时间
 *                               updated_at:
 *                                 type: string
 *                                 format: date-time
 *                                 description: 更新时间
 *             examples:
 *               single_file:
 *                 summary: 单个文件资源
 *                 value:
 *                   success: true
 *                   message: "获取文件详情成功"
 *                   data:
 *                     resource_id: 123
 *                     resource_title: "官方软件包"
 *                     user_download_status:
 *                       remaining_daily_downloads: 8
 *                       remaining_total_downloads: 50
 *                       remaining_points: 120
 *                       purchased_today: false
 *                       has_files: true
 *                       purchased_info: null
 *                     files:
 *                       - id: 1
 *                         path: "/official/software/app_v1.0.zip"
 *                         name: "app_v1.0.zip"
 *                         size: 52428800
 *                         size_formatted: "50.00 MB"
 *                         mime_type: "application/zip"
 *                         is_folder: false
 *                         folder_size: 0
 *                         file_count: 0
 *                         last_sync_at: "2025-09-25T05:30:00.000Z"
 *                         created_at: "2025-09-20T10:00:00.000Z"
 *                         updated_at: "2025-09-25T05:30:00.000Z"
 *               multiple_files:
 *                 summary: 多文件资源包
 *                 value:
 *                   success: true
 *                   message: "获取文件详情成功"
 *                   data:
 *                     resource_id: 124
 *                     resource_title: "官方文档包"
 *                     user_download_status:
 *                       remaining_daily_downloads: 5
 *                       remaining_total_downloads: 35
 *                       remaining_points: 80
 *                       purchased_today: true
 *                       has_files: true
 *                       purchased_info:
 *                         cost_type: "download_count"
 *                         cost: 1
 *                         alist_resource_id: 2
 *                         file_id: null
 *                     files:
 *                       - id: 2
 *                         path: "/official/documents/tutorial/"
 *                         name: "tutorial"
 *                         size: 0
 *                         size_formatted: "0 Bytes"
 *                         mime_type: null
 *                         is_folder: true
 *                         folder_size: 104857600
 *                         file_count: 15
 *                         last_sync_at: "2025-09-25T05:30:00.000Z"
 *                         created_at: "2025-09-20T10:00:00.000Z"
 *                         updated_at: "2025-09-25T05:30:00.000Z"
 *                       - id: 3
 *                         path: "/official/documents/readme.pdf"
 *                         name: "readme.pdf"
 *                         size: 2097152
 *                         size_formatted: "2.00 MB"
 *                         mime_type: "application/pdf"
 *                         is_folder: false
 *                         folder_size: 0
 *                         file_count: 0
 *                         last_sync_at: "2025-09-25T05:30:00.000Z"
 *                         created_at: "2025-09-20T10:00:00.000Z"
 *                         updated_at: "2025-09-25T05:30:00.000Z"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "资源ID无效"
 *       404:
 *         description: 资源不存在或未关联Alist文件
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               resource_not_found:
 *                 summary: 资源不存在
 *                 value:
 *                   success: false
 *                   message: "资源不存在"
 *               not_official:
 *                 summary: 非官方资源
 *                 value:
 *                   success: false
 *                   message: "该资源不是官方资源，无法访问Alist文件"
 *               no_alist_files:
 *                 summary: 未关联Alist文件
 *                 value:
 *                   success: false
 *                   message: "该资源未关联任何Alist文件"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getResourceFileInfo = async (req, res) => {
  try {
    const resourceId = parseInt(req.params.resourceId);

    if (!resourceId || resourceId <= 0) {
      return res.status(400).json({
        success: false,
        message: '资源ID无效'
      });
    }

    // 检查资源是否存在且为官方资源
    const resourceCheck = await query(
      'SELECT id, title, official, status FROM resources WHERE id = $1',
      [resourceId]
    );

    if (resourceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '资源不存在'
      });
    }

    const resource = resourceCheck.rows[0];

    if (!resource.official) {
      return res.status(404).json({
        success: false,
        message: '该资源不是官方资源'
      });
    }

    // 获取Alist文件关联信息
    const alistFiles = await AlistResource.getByResourceId(resourceId);

    if (alistFiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: '该资源未关联任何文件'
      });
    }

    // 直接使用数据库中的文件信息（优化数据结构，移除重复字段）
    const detailedFiles = alistFiles.map(file => ({
      id: file.id,
      path: file.alist_path,
      name: file.alist_name,
      size: parseInt(file.file_size) || 0,
      size_formatted: AlistClient.formatFileSize(file.file_size || 0),
      mime_type: file.mime_type,
      is_folder: file.is_folder,
      folder_size: parseInt(file.folder_size) || 0,
      file_count: file.file_count || 0,
      last_sync_at: file.last_sync_at,
      created_at: file.created_at,
      updated_at: file.updated_at
    }));

    // 获取用户下载状态信息
    const userId = req.user.id;
    const { checkAndResetDailyDownloads } = require('../utils/downloadLimitUtils');
    const downloadStatus = await checkAndResetDailyDownloads(userId);

    // 获取用户详细信息
    const userQuery = await query(`
      SELECT points, download_count FROM users WHERE id = $1
    `, [userId]);

    const user = userQuery.rows[0];

    // 检查今日是否已购买过该资源
    const purchaseCheck = await query(`
      SELECT id, points_cost, download_count_cost, cost_type, file_id, alist_resource_id
      FROM daily_purchases
      WHERE user_id = $1 AND resource_id = $2 AND purchase_date = CURRENT_DATE
      LIMIT 1
    `, [userId, resourceId]);

    const hasPurchasedToday = purchaseCheck.rows.length > 0;
    const purchase = purchaseCheck.rows[0];

    // 准备响应数据
    const responseData = {
      resource_id: resourceId,
      resource_title: resource.title,
      files: detailedFiles,
      user_download_status: {
        remaining_daily_downloads: downloadStatus.remainingDownloads,
        remaining_total_downloads: user.download_count,
        remaining_points: user.points,
        purchased_today: hasPurchasedToday,
        has_files: detailedFiles.length > 0,
        purchased_info: hasPurchasedToday ? {
          cost_type: purchase.points_cost > 0 ? 'points' : 'download_count',
          cost: purchase.points_cost || purchase.download_count_cost || 1,
          alist_resource_id: purchase.alist_resource_id,
          file_id: purchase.file_id
        } : null
      }
    };

    // 记录访问日志
    logger.info('用户获取Alist文件详情', {
      userId: req.user.id,
      resourceId,
      fileCount: detailedFiles.length
    });

    res.json({
      success: true,
      message: '获取文件详情成功',
      data: responseData
    });

  } catch (error) {
    logger.error('获取Alist文件详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取文件详情失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * /api/alist/download-link:
 *   post:
 *     summary: 生成Alist文件下载链接并扣除下载次数
 *     description: |
 *       生成Alist文件的临时下载链接，并自动扣除用户的下载次数配额。
 *
 *       **功能特性：**
 *       - 生成临时下载链接，提高安全性
 *       - 自动验证用户下载权限
 *       - 扣除用户下载次数或VIP权益
 *       - 记录详细的下载日志
 *       - 支持文件大小和扩展名验证
 *
 *       **权限验证：**
 *       - 需要用户登录认证
 *       - 检查用户下载次数余额
 *       - 验证VIP权益和有效期
 *       - 资源必须是已发布的官方资源
 *
 *       **智能计费规则：**
 *       - VIP用户：优先使用每日下载限额，不足时自动使用总下载次数
 *       - 普通用户：仅消耗总下载次数，不使用每日限额
 *       - 大文件计费：超过100MB的文件，每100MB消耗1次下载次数
 *       - 下载次数卡：兑换后增加的是总下载次数(download_count)，非每日限额
 *     tags: [Alist文件管理]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - alist_resource_id
 *             properties:
 *               alist_resource_id:
 *                 type: integer
 *                 description: Alist资源关联记录ID（alist_resources表中的ID）
 *                 example: 2
 *     responses:
 *       200:
 *         description: 下载链接生成成功
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
 *                         download_url:
 *                           type: string
 *                           description: 临时下载链接
 *                           example: "https://alist.example.com/d/official/software/app_v1.0.zip?sign=xxx"
 *                         expires_at:
 *                           type: string
 *                           format: date-time
 *                           description: 链接过期时间
 *                           example: "2025-09-25T10:30:00.000Z"
 *                         file_info:
 *                           type: object
 *                           description: 文件基本信息
 *                           properties:
 *                             name:
 *                               type: string
 *                               description: 文件名
 *                               example: "app_v1.0.zip"
 *                             size:
 *                               type: integer
 *                               description: 文件大小（字节）
 *                               example: 52428800
 *                             size_formatted:
 *                               type: string
 *                               description: 格式化文件大小
 *                               example: "50.00 MB"
 *                         cost_info:
 *                           type: object
 *                           description: 消费信息
 *                           properties:
 *                             cost_type:
 *                               type: string
 *                               enum: [vip, download_count]
 *                               description: 消费类型
 *                               example: "download_count"
 *                             cost_amount:
 *                               type: integer
 *                               description: 消费数量
 *                               example: 1
 *                             remaining_count:
 *                               type: integer
 *                               description: 剩余下载次数
 *                               example: 49
 *                         download_record:
 *                           type: object
 *                           description: 下载记录信息
 *                           properties:
 *                             id:
 *                               type: integer
 *                               description: 下载记录ID
 *                               example: 789
 *                             created_at:
 *                               type: string
 *                               format: date-time
 *                               description: 下载时间
 *             examples:
 *               vip_download:
 *                 summary: VIP用户下载
 *                 value:
 *                   success: true
 *                   message: "下载链接生成成功"
 *                   data:
 *                     download_url: "https://alist.example.com/d/official/software/app_v1.0.zip?sign=abc123"
 *                     expires_at: "2025-09-25T10:30:00.000Z"
 *                     file_info:
 *                       name: "app_v1.0.zip"
 *                       size: 52428800
 *                       size_formatted: "50.00 MB"
 *                     cost_info:
 *                       cost_type: "vip"
 *                       cost_amount: 0
 *                       remaining_count: null
 *                     download_record:
 *                       id: 789
 *                       created_at: "2025-09-25T05:30:00.000Z"
 *               regular_download:
 *                 summary: 普通用户下载
 *                 value:
 *                   success: true
 *                   message: "下载链接生成成功，消耗1次下载次数"
 *                   data:
 *                     download_url: "https://alist.example.com/d/official/documents/readme.pdf?sign=def456"
 *                     expires_at: "2025-09-25T10:30:00.000Z"
 *                     file_info:
 *                       name: "readme.pdf"
 *                       size: 2097152
 *                       size_formatted: "2.00 MB"
 *                     cost_info:
 *                       cost_type: "download_count"
 *                       cost_amount: 1
 *                       remaining_count: 49
 *                     download_record:
 *                       id: 790
 *                       created_at: "2025-09-25T05:30:00.000Z"
 *       400:
 *         description: 请求参数错误或权限不足
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalid_params:
 *                 summary: 参数错误
 *                 value:
 *                   success: false
 *                   message: "请提供有效的资源ID和文件路径"
 *               insufficient_downloads:
 *                 summary: 下载次数不足
 *                 value:
 *                   success: false
 *                   message: "下载次数不足，当前剩余: 0 次"
 *               file_too_large:
 *                 summary: 文件过大
 *                 value:
 *                   success: false
 *                   message: "文件大小超出限制，最大允许: 1.00 GB"
 *               extension_not_allowed:
 *                 summary: 文件类型不支持
 *                 value:
 *                   success: false
 *                   message: "不支持的文件类型: .xyz"
 *       404:
 *         description: 资源或文件不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               resource_not_found:
 *                 summary: 资源不存在
 *                 value:
 *                   success: false
 *                   message: "资源不存在或不是官方资源"
 *               file_not_found:
 *                 summary: 文件路径不存在
 *                 value:
 *                   success: false
 *                   message: "指定的Alist文件路径不存在"
 *               path_not_associated:
 *                 summary: 路径未关联
 *                 value:
 *                   success: false
 *                   message: "该文件路径未与此资源关联"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const generateDownloadLink = async (req, res) => {
  try {
    const { alist_resource_id } = req.body;
    const userId = req.user.id;

    // 参数验证
    if (!alist_resource_id) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的资源ID'
      });
    }

    // 根据alist_resource_id查询文件关联信息
    const alistResourceQuery = await query(`
      SELECT
        ar.id, ar.resource_id, ar.alist_path, ar.alist_name, ar.file_size,
        r.id as resource_id, r.title, r.official, r.status
      FROM alist_resources ar
      JOIN resources r ON ar.resource_id = r.id
      WHERE ar.id = $1 AND r.official = true AND r.status = 'published'
    `, [alist_resource_id]);

    if (alistResourceQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '资源不存在或对应的资源不是已发布的官方资源'
      });
    }

    const alistResource = alistResourceQuery.rows[0];
    const resource = {
      id: alistResource.resource_id,
      title: alistResource.title,
      official: alistResource.official,
      status: alistResource.status
    };

    // 获取用户信息
    const userInfo = await query(
      `SELECT id, username, download_count, vip_level, vip_expire_at as vip_expires_at,
       daily_download_limit, daily_downloads_used, last_download_reset_date
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userInfo.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用户信息无效'
      });
    }

    const user = userInfo.rows[0];

    // 使用统一的下载限制检查和重置逻辑
    const { checkAndResetDailyDownloads } = require('../utils/downloadLimitUtils');
    const downloadStatus = await checkAndResetDailyDownloads(userId);

    // 更新用户信息以反映可能的重置结果
    user.daily_downloads_used = downloadStatus.dailyUsed;
    // daily_download_limit应该保持为用户的每日限制总数，不是剩余数
    const actualDailyLimit = downloadStatus.dailyLimit;

    // 生成下载链接（同时获取文件信息和Alist的sign）
    let downloadLink;
    try {
      downloadLink = await alistClient.generateDirectDownloadLink(alistResource.alist_path);
    } catch (error) {
      logger.error(`生成下载链接失败: ${alistResource.alist_path}`, error);
      return res.status(500).json({
        success: false,
        message: '生成下载链接失败'
      });
    }

    const fileInfo = downloadLink.fileInfo;

    // // 检查文件大小限制
    // if (!alistClient.isFileSizeAllowed(fileInfo.size)) {
    //   return res.status(400).json({
    //     success: false,
    //     message: `文件大小超出限制，最大允许: ${AlistClient.formatFileSize(alistClient.config.max_file_size)}`
    //   });
    // }

    // 检查文件扩展名
    if (!alistClient.isExtensionAllowed(fileInfo.name)) {
      const extension = AlistClient.getFileExtension(fileInfo.name);
      return res.status(400).json({
        success: false,
        message: `不支持的文件类型: ${extension}`
      });
    }

    // 优化扣费逻辑：检查当天是否已经下载过同一文件
    const isVip = user.vip_level > 0 && user.vip_expires_at && new Date(user.vip_expires_at) > new Date();
    let costAmount = 1; // 默认每文件扣除1次

    // 检查当天是否已经下载过该Alist资源
    const existingDownload = await query(`
      SELECT id, cost_type, download_count_cost, created_at
      FROM daily_purchases
      WHERE user_id = $1
        AND resource_id = $2
        AND alist_resource_id = $3
        AND purchase_date = CURRENT_DATE
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId, resource.id, alist_resource_id]);

    let costType = '';
    let dailyCost = 0;
    let remainingDaily = actualDailyLimit - user.daily_downloads_used;
    let remainingTotal = user.download_count;
    let isRepeatDownload = false;

    if (existingDownload.rows.length > 0) {
      // 当天已经下载过该文件，不再扣费
      isRepeatDownload = true;
      costType = 'free_repeat';
      costAmount = 0;
      dailyCost = 0;

      logger.info('用户当天重复下载同一Alist文件，免费提供', {
        userId,
        username: user.username,
        resourceId: resource.id,
        alistResourceId: alist_resource_id,
        alistPath: alistResource.alist_path,
        originalDownloadTime: existingDownload.rows[0].created_at,
        originalCostType: existingDownload.rows[0].cost_type,
        originalCostAmount: existingDownload.rows[0].download_count_cost
      });
    } else {
      // 首次下载，需要扣费
      if (isVip) {
        // VIP用户：优先使用每日下载次数，不足时使用总次数
        if (remainingDaily >= 1) {
          costType = 'daily_limit';
          dailyCost = 1;
        } else if (remainingTotal >= 1) {
          costType = 'download_count';
          dailyCost = 0;
        } else {
          return res.status(400).json({
            success: false,
            message: `下载次数不足。每日剩余: ${remainingDaily} 次，总次数剩余: ${remainingTotal} 次`
          });
        }
      } else {
        // 普通用户：只使用总下载次数
        if (remainingTotal >= 1) {
          costType = 'download_count';
          dailyCost = 0;
        } else {
          return res.status(400).json({
            success: false,
            message: `下载次数不足，当前剩余: ${remainingTotal} 次`
          });
        }
      }

      // 扣除下载次数
      if (costType === 'daily_limit') {
        // 使用每日下载次数
        await query(
          `UPDATE users SET daily_downloads_used = daily_downloads_used + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [dailyCost, userId]
        );
      } else if (costType === 'download_count') {
        // 使用总下载次数
        await query(
          `UPDATE users SET download_count = download_count - 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [userId]
        );
      }
    }

    // 记录下载购买记录到daily_purchases表
    const downloadRecord = await query(`
      INSERT INTO daily_purchases (
        user_id, resource_id, purchase_date, points_cost, file_id,
        alist_resource_id, download_type, cost_type, download_count_cost
      ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, alist_resource_id, purchase_date) DO UPDATE SET
        cost_type = EXCLUDED.cost_type,
        download_count_cost = GREATEST(daily_purchases.download_count_cost, EXCLUDED.download_count_cost),
        resource_id = EXCLUDED.resource_id
      RETURNING id, created_at
    `, [
      userId,
      resource.id,
      0, // points_cost: Alist下载不消耗积分，固定为0
      null, // file_id: Alist下载没有对应的resource_files记录
      alist_resource_id,
      'alist',
      costType,
      costAmount // download_count_cost: 记录消耗的下载次数
    ]);

    // 更新资源下载统计
    await query(
      'UPDATE resources SET download_count = download_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [resource.id]
    );

    // 同步文件信息到数据库
    await AlistResource.syncFileInfo(resource.id, alistResource.alist_path);

    // 记录成功日志
    logger.info('用户生成Alist下载链接', {
      userId,
      username: user.username,
      alistResourceId: alist_resource_id,
      resourceId: resource.id,
      alistPath: alistResource.alist_path,
      fileName: fileInfo.name,
      fileSize: fileInfo.size,
      costType,
      costAmount,
      dailyCost,
      isVip,
      isRepeatDownload,
      remainingDaily: remainingDaily - dailyCost,
      remainingTotal: costType === 'download_count' ? remainingTotal - 1 : remainingTotal
    });

    // 计算链接过期时间
    const expiresAt = new Date(Date.now() + (alistClient.config.download_timeout * 1000));

    // 生成响应消息
    let message = '下载链接生成成功';
    if (isRepeatDownload) {
      message += '，当日重复下载免费';
    } else if (costAmount > 0) {
      if (costType === 'daily_limit') {
        message += `，消耗每日下载次数${dailyCost}次`;
      } else if (costType === 'download_count') {
        message += `，消耗总下载次数1次`;
      }
    }

    res.json({
      success: true,
      message: message,
      data: {
        download_url: downloadLink.url,
        expires_at: expiresAt.toISOString(),
        file_info: {
          name: fileInfo.name,
          size: fileInfo.size,
          size_formatted: AlistClient.formatFileSize(fileInfo.size)
        },
        cost_info: {
          cost_type: costType,
          cost_amount: costAmount,
          daily_cost: dailyCost,
          remaining_daily: remainingDaily - dailyCost,
          remaining_total: costType === 'download_count' ? remainingTotal - 1 : remainingTotal,
          is_vip: isVip,
          is_repeat_download: isRepeatDownload
        },
        download_record: {
          id: downloadRecord.rows[0].id,
          created_at: downloadRecord.rows[0].created_at
        }
      }
    });

  } catch (error) {
    logger.error('生成Alist下载链接失败:', error);
    res.status(500).json({
      success: false,
      message: '生成下载链接失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getResourceFileInfo,
  generateDownloadLink
};