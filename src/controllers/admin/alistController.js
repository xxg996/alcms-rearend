/**
 * Alist管理控制器
 * 提供Alist资源管理的管理员功能
 */

const AlistResource = require('../../models/AlistResource');
const AlistIngestSetting = require('../../models/AlistIngestSetting');
const { alistClient } = require('../../utils/alistClient');
const SystemSetting = require('../../models/SystemSetting');
const { logger } = require('../../utils/logger');
const { query } = require('../../config/database');
const { alistTokenScheduler } = require('../../services/alistTokenScheduler');
const AlistIngestService = require('../../services/alistIngestService');

/**
 * @swagger
 * /api/admin/alist/config:
 *   get:
 *     summary: 获取Alist系统配置
 *     description: 获取当前的Alist配置信息，密码将被屏蔽
 *     tags: [系统设置管理]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 获取配置成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
const getAlistConfig = async (req, res) => {
  try {
    const config = await SystemSetting.getSetting('alist_config');

    // 屏蔽密码
    if (config && config.password) {
      config.password = '******';
    }

    res.json({
      success: true,
      message: '获取Alist配置成功',
      data: config
    });

  } catch (error) {
    logger.error('获取Alist配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取配置失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/alist/config:
 *   put:
 *     summary: 更新Alist系统配置
 *     description: 更新Alist连接配置，需要管理员权限
 *     tags: [系统设置管理]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               base_url:
 *                 type: string
 *                 description: Alist管理后台地址
 *                 example: "http://localhost:5244"
 *               download_domain:
 *                 type: string
 *                 description: 下载域名前缀（可选，不设置时使用base_url）
 *                 example: "https://download.example.com"
 *               username:
 *                 type: string
 *                 example: "admin"
 *               password:
 *                 type: string
 *                 example: "password123"
 *               enabled:
 *                 type: boolean
 *                 example: true
 *               token_expires:
 *                 type: integer
 *                 description: Token过期时间（小时）
 *                 example: 48
 *     responses:
 *       200:
 *         description: 配置更新成功
 */
const updateAlistConfig = async (req, res) => {
  try {
    const { base_url, download_domain, username, password, enabled, token_expires, ...otherConfig } = req.body;

    // 获取当前配置
    const currentConfig = await SystemSetting.getSetting('alist_config') || {};

    // 合并配置
    const newConfig = {
      ...currentConfig,
      ...otherConfig
    };

    if (base_url) newConfig.base_url = base_url;
    if (download_domain !== undefined) {
      // 支持设置空字符串来清除下载域名配置
      newConfig.download_domain = download_domain || null;
    }
    if (username) newConfig.username = username;
    if (password) newConfig.password = password;
    if (enabled !== undefined) newConfig.enabled = enabled;
    if (token_expires) newConfig.token_expires = token_expires;

    // 保存配置
    await SystemSetting.upsertSetting(
      'alist_config',
      newConfig,
      'Alist文件存储系统配置',
      req.user.id
    );

    logger.info('管理员更新了Alist配置', {
      adminId: req.user.id,
      adminUsername: req.user.username,
      baseUrl: base_url,
      downloadDomain: download_domain,
      enabled,
      tokenExpires: token_expires
    });

    res.json({
      success: true,
      message: 'Alist配置更新成功'
    });

  } catch (error) {
    logger.error('更新Alist配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新配置失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/alist/ingest/settings/{id}/scantest:
 *   get:
 *     summary: 模拟Alist目录扫描（仅预览）
 *     description: 返回即将扫描的子目录、文件以及 Markdown/图片等信息，不进行实际入库
 *     tags: [Alist管理相关]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 入库配置ID
 *     responses:
 *       200:
 *         description: 预览成功
 *       404:
 *         description: 入库配置不存在
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const scanTestAlistIngestSetting = async (req, res) => {
  try {
    const settingId = parseInt(req.params.id, 10);

    if (!Number.isFinite(settingId)) {
      return res.status(400).json({
        success: false,
        message: '配置ID无效'
      });
    }

    const setting = await AlistIngestSetting.findById(settingId);
    if (!setting) {
      return res.status(404).json({
        success: false,
        message: '入库配置不存在'
      });
    }

    const result = await AlistIngestService.scanTest(setting, {});

    res.json({
      success: true,
      message: 'Alist目录模拟完成',
      data: result
    });
  } catch (error) {
    logger.error('执行Alist扫描模拟失败:', error);
    res.status(500).json({
      success: false,
      message: '执行模拟失败',
      error: error.message
    });
  }
};

/**
 * @swagger
 * /api/admin/alist/ingest/settings:
 *   get:
 *     summary: 获取Alist入库配置列表
 *     description: 返回已配置的Alist入库规则，可根据启用状态筛选
 *     tags: [Alist管理相关]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: 是否仅获取启用的配置
 *         example: true
 *     responses:
 *       200:
 *         description: 获取配置成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           title:
 *                             type: string
 *                           alist_root_path:
 *                             type: string
 *                           category_id:
 *                             type: integer
 *                           resource_type_id:
 *                             type: integer
 *                           author_id:
 *                             type: integer
 *                           is_active:
 *                             type: boolean
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
/**
 * @swagger
 * /api/admin/alist/ingest/settings/{id}:
 *   get:
 *     summary: 获取单个Alist入库配置
 *     description: 根据配置ID返回对应的入库配置详情
 *     tags: [Alist管理相关]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 入库配置ID
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: 入库配置不存在
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getAlistIngestSettings = async (req, res) => {
  try {
    const idParam = req.params?.id ?? req.query?.id;

    if (idParam !== undefined) {
      const settingId = parseInt(idParam, 10);

      if (!Number.isFinite(settingId)) {
        return res.status(400).json({
          success: false,
          message: '配置ID无效'
        });
      }

      const setting = await AlistIngestSetting.findById(settingId);

      if (!setting) {
        return res.status(404).json({
          success: false,
          message: '入库配置不存在'
        });
      }

      return res.json({
        success: true,
        message: '获取入库配置成功',
        data: setting
      });
    }

    const { is_active } = req.query;

    const settings = await AlistIngestSetting.findAll({
      is_active: is_active === undefined ? undefined : String(is_active).toLowerCase() === 'true'
    });

    return res.json({
      success: true,
      message: '获取入库配置成功',
      data: settings
    });
  } catch (error) {
    logger.error('获取Alist入库配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取入库配置失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/alist/ingest/settings:
 *   post:
 *     summary: 创建Alist入库配置
 *     description: 新增Alist目录入库规则，包含路径、分类、类型和作者绑定信息
 *     tags: [Alist管理相关]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, alist_root_path, author_id, resource_type_id]
 *             properties:
 *               title:
 *                 type: string
 *                 description: 配置名称
 *               alist_root_path:
 *                 type: string
 *                 description: 需要扫描的Alist目录路径
 *                 example: "/official/resources"
 *               category_id:
 *                 type: integer
 *                 nullable: true
 *                 description: 入库资源默认分类ID
 *               resource_type_id:
 *                 type: integer
 *                 description: 入库资源默认类型ID
 *               author_id:
 *                 type: integer
 *                 description: 入库资源作者ID
 *               is_active:
 *                 type: boolean
 *                 description: 是否启用该配置
 *     responses:
 *       201:
 *         description: 配置创建成功
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const createAlistIngestSetting = async (req, res) => {
  try {
    const {
      title,
      alist_root_path,
      category_id,
      resource_type_id,
      author_id,
      is_active
    } = req.body;

    if (!title || !alist_root_path) {
      return res.status(400).json({
        success: false,
        message: '配置名称与Alist路径为必填项'
      });
    }

    if (!resource_type_id || !author_id) {
      return res.status(400).json({
        success: false,
        message: '资源类型ID与作者ID为必填项'
      });
    }

    const payload = {
      title: String(title).trim(),
      alist_root_path,
      category_id: category_id ? parseInt(category_id, 10) : null,
      resource_type_id: parseInt(resource_type_id, 10),
      author_id: parseInt(author_id, 10),
      is_active: is_active === undefined ? true : Boolean(is_active)
    };

    const setting = await AlistIngestSetting.create(payload);

    logger.info('创建Alist入库配置', {
      adminId: req.user.id,
      settingId: setting.id,
      path: setting.alist_root_path
    });

    res.status(201).json({
      success: true,
      message: '入库配置创建成功',
      data: setting
    });
  } catch (error) {
    logger.error('创建Alist入库配置失败:', error);
    res.status(500).json({
      success: false,
      message: '创建入库配置失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/alist/ingest/settings/{id}:
 *   put:
 *     summary: 更新Alist入库配置
 *     description: 修改已存在的Alist入库规则
 *     tags: [Alist管理相关]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 入库配置ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               alist_root_path:
 *                 type: string
 *               category_id:
 *                 type: integer
 *               resource_type_id:
 *                 type: integer
 *               author_id:
 *                 type: integer
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 配置更新成功
 *       404:
 *         description: 配置不存在
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const updateAlistIngestSetting = async (req, res) => {
  try {
    const settingId = parseInt(req.params.id, 10);

    if (!Number.isFinite(settingId)) {
      return res.status(400).json({
        success: false,
        message: '配置ID无效'
      });
    }

    const payload = { ...req.body };

    if (payload.category_id !== undefined) {
      payload.category_id = payload.category_id ? parseInt(payload.category_id, 10) : null;
    }
    if (payload.resource_type_id !== undefined) {
      payload.resource_type_id = payload.resource_type_id ? parseInt(payload.resource_type_id, 10) : null;
    }
    if (payload.author_id !== undefined) {
      payload.author_id = payload.author_id ? parseInt(payload.author_id, 10) : null;
    }
    if (payload.is_active !== undefined) {
      payload.is_active = Boolean(payload.is_active);
    }

    const updated = await AlistIngestSetting.update(settingId, payload);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: '入库配置不存在'
      });
    }

    logger.info('更新Alist入库配置', {
      adminId: req.user.id,
      settingId
    });

    res.json({
      success: true,
      message: '入库配置更新成功',
      data: updated
    });
  } catch (error) {
    logger.error('更新Alist入库配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新入库配置失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/alist/ingest/settings/{id}:
 *   delete:
 *     summary: 删除Alist入库配置
 *     description: 移除指定的Alist入库配置，相关记录将同步删除
 *     tags: [Alist管理相关]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 入库配置ID
 *     responses:
 *       200:
 *         description: 删除成功
 *       404:
 *         description: 配置不存在
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const deleteAlistIngestSetting = async (req, res) => {
  try {
    const settingId = parseInt(req.params.id, 10);

    if (!Number.isFinite(settingId)) {
      return res.status(400).json({
        success: false,
        message: '配置ID无效'
      });
    }

    const deleted = await AlistIngestSetting.delete(settingId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: '入库配置不存在'
      });
    }

    logger.info('删除Alist入库配置', {
      adminId: req.user.id,
      settingId
    });

    res.json({
      success: true,
      message: '入库配置删除成功'
    });
  } catch (error) {
    logger.error('删除Alist入库配置失败:', error);
    res.status(500).json({
      success: false,
      message: '删除入库配置失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/alist/ingest/settings/{id}/scan:
 *   post:
 *     summary: 手动扫描并入库Alist目录
 *     description: 根据入库配置扫描对应Alist路径下的子目录，将文件夹批量入库为资源并自动绑定文件
 *     tags: [Alist管理相关]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 入库配置ID
 *     responses:
 *       200:
 *         description: 扫描完成
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
 *                         totalFolders:
 *                           type: integer
 *                         created:
 *                           type: array
 *                           items:
 *                             type: object
 *                         updated:
 *                           type: array
 *                           items:
 *                             type: object
 *                         skipped:
 *                           type: array
 *                           items:
 *                             type: object
 *                         errors:
 *                           type: array
 *                           items:
 *                             type: object
 *       404:
 *         description: 配置不存在
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const scanAlistIngestSetting = async (req, res) => {
  try {
    const settingId = parseInt(req.params.id, 10);

    if (!Number.isFinite(settingId)) {
      return res.status(400).json({
        success: false,
        message: '配置ID无效'
      });
    }

    const setting = await AlistIngestSetting.findById(settingId);
    if (!setting) {
      return res.status(404).json({
        success: false,
        message: '入库配置不存在'
      });
    }

    const result = await AlistIngestService.scanSetting(settingId, {});

    res.json({
      success: true,
      message: 'Alist目录扫描完成',
      data: result
    });
  } catch (error) {
    logger.error('执行Alist入库扫描失败:', error);
    res.status(500).json({
      success: false,
      message: '执行扫描失败',
      error: error.message
    });
  }
};

/**
 * @swagger
 * /api/admin/alist/resources:
 *   get:
 *     summary: 获取Alist资源关联列表
 *     description: 获取所有资源与Alist文件的关联信息，支持分页
 *     tags: [Alist管理相关]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: 获取列表成功
 */
const getAlistResources = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // 获取总数
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM alist_resources ar
      JOIN resources r ON ar.resource_id = r.id
    `);
    const total = parseInt(countResult.rows[0].total);

    // 获取数据
    const result = await query(`
      SELECT
        ar.id, ar.resource_id, ar.alist_path, ar.alist_name,
        ar.file_size, ar.mime_type, ar.is_folder, ar.last_sync_at,
        ar.created_at, ar.updated_at,
        r.title as resource_title, r.official, r.status,
        u.username as author_username
      FROM alist_resources ar
      JOIN resources r ON ar.resource_id = r.id
      JOIN users u ON r.author_id = u.id
      ORDER BY ar.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      success: true,
      message: '获取Alist资源关联列表成功',
      data: {
        items: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    logger.error('获取Alist资源关联列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取列表失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/alist/resources/{resourceId}:
 *   post:
 *     summary: 为资源添加Alist文件关联
 *     description: 手动为指定资源添加Alist文件路径关联
 *     tags: [Alist管理相关]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: resourceId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - alist_path
 *             properties:
 *               alist_path:
 *                 type: string
 *                 example: "/official/software/app_v1.0.zip"
 *     responses:
 *       200:
 *         description: 关联创建成功
 */
const addAlistResource = async (req, res) => {
  try {
    const resourceId = parseInt(req.params.resourceId);
    const { alist_path } = req.body;

    if (!resourceId || !alist_path) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的资源ID和文件路径'
      });
    }

    // 检查资源是否存在
    const resourceCheck = await query(
      'SELECT id, title, official FROM resources WHERE id = $1',
      [resourceId]
    );

    if (resourceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '资源不存在'
      });
    }

    const resource = resourceCheck.rows[0];

    // 验证Alist路径是否存在
    try {
      const fileInfo = await alistClient.getFileInfo(alist_path);

      // 创建关联
      const alistResource = await AlistResource.upsertAlistResource(
        resourceId,
        alist_path,
        fileInfo
      );

      // 如果不是官方资源，自动设置为官方资源
      if (!resource.official) {
        await query(
          'UPDATE resources SET official = true WHERE id = $1',
          [resourceId]
        );
      }

      logger.info('管理员添加了Alist资源关联', {
        adminId: req.user.id,
        resourceId,
        alistPath: alist_path,
        fileName: fileInfo.name
      });

      res.json({
        success: true,
        message: 'Alist文件关联创建成功',
        data: alistResource
      });

    } catch (error) {
      logger.error(`验证Alist路径失败: ${alist_path}`, error);
      return res.status(400).json({
        success: false,
        message: '指定的Alist文件路径不存在或无法访问'
      });
    }

  } catch (error) {
    logger.error('添加Alist资源关联失败:', error);
    res.status(500).json({
      success: false,
      message: '创建关联失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/alist/resources/{resourceId}:
 *   delete:
 *     summary: 删除资源的Alist文件关联
 *     description: 删除指定资源的Alist文件路径关联
 *     tags: [Alist管理相关]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: resourceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 资源ID
 *         example: 1
 *     responses:
 *       200:
 *         description: 关联删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: "Alist文件关联删除成功"
 *       404:
 *         description: 资源或关联不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "资源的Alist关联不存在"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const deleteAlistResource = async (req, res) => {
  try {
    const resourceId = parseInt(req.params.resourceId);

    if (!resourceId) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的资源ID'
      });
    }

    // 检查资源是否存在
    const resourceCheck = await query(
      'SELECT id, title FROM resources WHERE id = $1',
      [resourceId]
    );

    if (resourceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '资源不存在'
      });
    }

    // 检查Alist关联是否存在
    const alistCheck = await query(
      'SELECT id, alist_path FROM alist_resources WHERE resource_id = $1',
      [resourceId]
    );

    if (alistCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '资源的Alist关联不存在'
      });
    }

    const alistResource = alistCheck.rows[0];

    // 删除Alist关联
    await query('DELETE FROM alist_resources WHERE resource_id = $1', [resourceId]);

    // 取消资源的官方标识（可选，根据业务需求决定）
    await query(
      'UPDATE resources SET official = false WHERE id = $1',
      [resourceId]
    );

    logger.info('管理员删除了Alist资源关联', {
      adminId: req.user.id,
      resourceId,
      alistPath: alistResource.alist_path,
      resourceTitle: resourceCheck.rows[0].title
    });

    res.json({
      success: true,
      message: 'Alist文件关联删除成功'
    });

  } catch (error) {
    logger.error('删除Alist资源关联失败:', error);
    res.status(500).json({
      success: false,
      message: '删除关联失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/alist/resources/items/{alistResourceId}:
 *   delete:
 *     summary: 删除单个Alist文件关联
 *     description: 根据 alist_resources 表的ID删除单条关联记录
 *     tags: [Alist管理相关]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alistResourceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: alist_resources表中关联记录的ID
 *         example: 12
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: "单个Alist文件关联删除成功"
 *       404:
 *         description: 关联记录不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "指定的Alist关联记录不存在"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const deleteAlistResourceById = async (req, res) => {
  try {
    const alistResourceId = parseInt(req.params.alistResourceId, 10);

    if (!alistResourceId) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的关联记录ID'
      });
    }

    const deletedRecord = await AlistResource.deleteById(alistResourceId);

    if (!deletedRecord) {
      return res.status(404).json({
        success: false,
        message: '指定的Alist关联记录不存在'
      });
    }

    const remainingResult = await query(
      'SELECT COUNT(*) FROM alist_resources WHERE resource_id = $1',
      [deletedRecord.resource_id]
    );

    const remainingCount = parseInt(remainingResult.rows[0].count, 10);

    if (remainingCount === 0) {
      await query(
        'UPDATE resources SET official = false WHERE id = $1',
        [deletedRecord.resource_id]
      );
    }

    logger.info('管理员删除单个Alist资源关联', {
      adminId: req.user.id,
      alistResourceId,
      resourceId: deletedRecord.resource_id,
      alistPath: deletedRecord.alist_path,
      remainingCount
    });

    res.json({
      success: true,
      message: '单个Alist文件关联删除成功'
    });
  } catch (error) {
    logger.error('删除单个Alist资源关联失败:', error);
    res.status(500).json({
      success: false,
      message: '删除关联失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/alist/stats:
 *   get:
 *     summary: 获取Alist系统统计信息
 *     description: 获取Alist文件存储的统计数据
 *     tags: [Alist管理相关]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 获取统计信息成功
 */
const getAlistStats = async (req, res) => {
  try {
    const stats = await AlistResource.getStats();

    // 获取下载统计（从daily_purchases表）
    const downloadStats = await query(`
      SELECT
        COUNT(*) as total_downloads,
        COUNT(DISTINCT user_id) as unique_users,
        SUM(CASE WHEN cost_type = 'daily_limit' THEN 1 ELSE 0 END) as vip_downloads,
        SUM(CASE WHEN cost_type = 'download_count' THEN 1 ELSE 0 END) as regular_downloads,
        SUM(download_count_cost) as total_download_count_consumed
      FROM daily_purchases
      WHERE download_type = 'alist'
    `);

    const downloadData = downloadStats.rows[0];

    res.json({
      success: true,
      message: '获取Alist统计信息成功',
      data: {
        file_stats: stats,
        download_stats: {
          total_downloads: parseInt(downloadData.total_downloads),
          unique_users: parseInt(downloadData.unique_users),
          vip_downloads: parseInt(downloadData.vip_downloads),
          regular_downloads: parseInt(downloadData.regular_downloads),
          total_download_count_consumed: parseInt(downloadData.total_download_count_consumed) || 0
        }
      }
    });

  } catch (error) {
    logger.error('获取Alist统计信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计信息失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/alist/token/refresh:
 *   post:
 *     summary: 手动刷新Alist Token
 *     description: 强制刷新Alist访问令牌，忽略过期时间检查
 *     tags: [系统设置管理]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Token刷新成功
 *       500:
 *         description: Token刷新失败
 */
const refreshAlistToken = async (req, res) => {
  try {
    const result = await alistTokenScheduler.manualRefresh();

    logger.info('管理员手动刷新Alist token', {
      adminId: req.user.id,
      adminUsername: req.user.username,
      success: result.success
    });

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    logger.error('手动刷新Alist token失败:', error);
    res.status(500).json({
      success: false,
      message: '刷新Token失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/alist/token/status:
 *   get:
 *     summary: 获取Alist Token状态
 *     description: 获取当前Token的状态和定时任务信息
 *     tags: [系统设置管理]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 获取状态成功
 */
const getAlistTokenStatus = async (req, res) => {
  try {
    const schedulerStatus = alistTokenScheduler.getStatus();

    // 获取数据库中的token信息
    const config = await SystemSetting.getSetting('alist_config');
    const tokenInfo = config ? {
      hasToken: !!config.access_token,
      tokenExpiresAt: config.token_expires_at,
      lastRefresh: config.last_token_refresh,
      tokenPreview: config.access_token ?
        config.access_token.substring(0, 16) + '...' : null
    } : null;

    res.json({
      success: true,
      message: '获取Token状态成功',
      data: {
        scheduler: schedulerStatus,
        token: tokenInfo
      }
    });

  } catch (error) {
    logger.error('获取Alist Token状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取状态失败'
    });
  }
};

module.exports = {
  getAlistConfig,
  updateAlistConfig,
  getAlistIngestSettings,
  createAlistIngestSetting,
  updateAlistIngestSetting,
  deleteAlistIngestSetting,
  scanAlistIngestSetting,
  scanTestAlistIngestSetting,
  getAlistResources,
  addAlistResource,
  deleteAlistResource,
  deleteAlistResourceById,
  getAlistStats,
  refreshAlistToken,
  getAlistTokenStatus
};
