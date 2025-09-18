/**
 * 资源文件管理控制器
 * 处理资源文件的增删改查操作
 */

const ResourceFile = require('../models/ResourceFile');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/resources/{resourceId}/files:
 *   get:
 *     tags: [ResourceFiles]
 *     summary: 获取资源的所有文件
 *     description: 获取指定资源的所有下载文件。资源作者可以获取自己资源的文件，管理员可以获取任何资源的文件
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
 *       - in: query
 *         name: include_inactive
 *         schema:
 *           type: boolean
 *           default: false
 *         description: 是否包含禁用的文件
 *       - in: query
 *         name: file_type
 *         schema:
 *           type: string
 *         description: 文件类型筛选
 *       - in: query
 *         name: quality
 *         schema:
 *           type: string
 *         description: 文件质量筛选
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: 筛选启用/禁用状态的文件
 *     responses:
 *       200:
 *         description: 获取文件列表成功
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
 *                         $ref: '#/components/schemas/ResourceFile'
 *       404:
 *         description: 资源不存在
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getResourceFiles = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { include_inactive, file_type, quality, is_active } = req.query;

    const options = {
      includeInactive: include_inactive === 'true',
      fileType: file_type,
      quality
    };

    // 新增 is_active 筛选功能
    if (is_active !== undefined) {
      options.isActive = is_active === 'true';
    }

    const files = await ResourceFile.findByResourceId(parseInt(resourceId), options);

    res.json({
      success: true,
      message: '获取资源文件成功',
      data: files
    });
  } catch (error) {
    logger.error('获取资源文件失败:', error);
    res.status(500).json({
      success: false,
      message: '获取资源文件失败'
    });
  }
};

/**
 * @swagger
 * /api/resources/{resourceId}/files:
 *   post:
 *     tags: [ResourceFiles]
 *     summary: 添加资源文件
 *     description: 为指定资源添加下载文件。资源作者可以为自己的资源添加文件，管理员可以为任何资源添加文件
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateResourceFileRequest'
 *           example:
 *             name: "高清视频"
 *             url: "https://example.com/video.mp4"
 *             file_size: 1073741824
 *             file_type: "video"
 *             file_extension: "mp4"
 *             quality: "1080p"
 *             version: "v1.0"
 *             language: "zh-CN"
 *             sort_order: 0
 *     responses:
 *       201:
 *         description: 文件添加成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ResourceFile'
 *       400:
 *         description: 请求参数错误
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const createResourceFile = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const {
      name,
      url,
      file_size,
      file_type,
      file_extension,
      quality,
      version,
      language,
      sort_order
    } = req.body;

    // 验证必填字段
    if (!name || !url) {
      return res.status(400).json({
        success: false,
        message: '文件名称和URL为必填字段'
      });
    }

    const fileData = {
      resourceId: parseInt(resourceId),
      name,
      url,
      fileSize: file_size || 0,
      fileType: file_type,
      fileExtension: file_extension,
      quality,
      version,
      language,
      sortOrder: sort_order || 0
    };

    const file = await ResourceFile.create(fileData);

    res.status(201).json({
      success: true,
      message: '资源文件添加成功',
      data: file
    });
  } catch (error) {
    logger.error('创建资源文件失败:', error);
    res.status(500).json({
      success: false,
      message: '创建资源文件失败'
    });
  }
};

/**
 * @swagger
 * /api/resource-files/{fileId}:
 *   put:
 *     tags: [ResourceFiles]
 *     summary: 更新资源文件
 *     description: 更新指定的资源文件信息。资源作者可以更新自己资源的文件，管理员可以更新任何资源的文件
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 文件ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateResourceFileRequest'
 *     responses:
 *       200:
 *         description: 文件更新成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ResourceFile'
 *       404:
 *         description: 文件不存在
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const updateResourceFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const updateData = req.body;

    // 转换字段名称
    const mappedData = {};
    if (updateData.file_size !== undefined) mappedData.file_size = updateData.file_size;
    if (updateData.file_type !== undefined) mappedData.file_type = updateData.file_type;
    if (updateData.file_extension !== undefined) mappedData.file_extension = updateData.file_extension;
    if (updateData.sort_order !== undefined) mappedData.sort_order = updateData.sort_order;
    if (updateData.is_active !== undefined) mappedData.is_active = updateData.is_active;

    // 直接映射的字段
    ['name', 'url', 'quality', 'version', 'language'].forEach(field => {
      if (updateData[field] !== undefined) {
        mappedData[field] = updateData[field];
      }
    });

    if (Object.keys(mappedData).length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有提供更新数据'
      });
    }

    const file = await ResourceFile.update(parseInt(fileId), mappedData);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    res.json({
      success: true,
      message: '资源文件更新成功',
      data: file
    });
  } catch (error) {
    logger.error('更新资源文件失败:', error);
    res.status(500).json({
      success: false,
      message: '更新资源文件失败'
    });
  }
};

/**
 * @swagger
 * /api/resource-files/{fileId}/delete:
 *   post:
 *     tags: [ResourceFiles]
 *     summary: 删除资源文件
 *     description: 删除指定的资源文件（软删除）。资源作者可以删除自己资源的文件，管理员可以删除任何文件
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 文件ID
 *         example: 1
 *     responses:
 *       200:
 *         description: 文件删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "资源文件删除成功"
 *       404:
 *         description: 文件不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "文件不存在"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: 没有权限操作此文件
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "没有权限操作此文件"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const deleteResourceFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    const file = await ResourceFile.softDelete(parseInt(fileId));

    if (!file) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    res.json({
      success: true,
      message: '资源文件删除成功'
    });
  } catch (error) {
    logger.error('删除资源文件失败:', error);
    res.status(500).json({
      success: false,
      message: '删除资源文件失败'
    });
  }
};

/**
 * @swagger
 * /api/resources/{resourceId}/files/sort:
 *   put:
 *     tags: [ResourceFiles]
 *     summary: 更新文件排序
 *     description: 更新资源文件的排序顺序。资源作者可以更新自己资源的文件排序，管理员可以更新任何资源的文件排序
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sort_data
 *             properties:
 *               sort_data:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: 文件ID
 *                     sort_order:
 *                       type: integer
 *                       description: 排序顺序
 *           example:
 *             sort_data:
 *               - id: 1
 *                 sort_order: 0
 *               - id: 2
 *                 sort_order: 1
 *     responses:
 *       200:
 *         description: 排序更新成功
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
 *                         $ref: '#/components/schemas/ResourceFile'
 *       400:
 *         description: 请求参数错误
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const updateFileSort = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { sort_data } = req.body;

    if (!Array.isArray(sort_data) || sort_data.length === 0) {
      return res.status(400).json({
        success: false,
        message: '排序数据必须是非空数组'
      });
    }

    // 验证排序数据格式
    for (const item of sort_data) {
      if (!item.id || typeof item.sort_order !== 'number') {
        return res.status(400).json({
          success: false,
          message: '排序数据格式错误，需要包含id和sort_order字段'
        });
      }
    }

    const files = await ResourceFile.updateSortOrder(parseInt(resourceId), sort_data);

    res.json({
      success: true,
      message: '文件排序更新成功',
      data: files
    });
  } catch (error) {
    logger.error('更新文件排序失败:', error);
    res.status(500).json({
      success: false,
      message: '更新文件排序失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/resource-files/statistics:
 *   get:
 *     tags: [ResourceFiles]
 *     summary: 获取文件统计信息
 *     description: 管理员获取资源文件的统计信息
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: resource_id
 *         schema:
 *           type: integer
 *         description: 资源ID（可选，用于获取特定资源的统计）
 *     responses:
 *       200:
 *         description: 统计信息获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ResourceFileStatistics'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getFileStatistics = async (req, res) => {
  try {
    const { resource_id } = req.query;

    const stats = await ResourceFile.getStatistics(
      resource_id ? parseInt(resource_id) : null
    );

    res.json({
      success: true,
      message: '文件统计信息获取成功',
      data: stats
    });
  } catch (error) {
    logger.error('获取文件统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取文件统计失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/resource-files:
 *   get:
 *     tags: [ResourceFiles]
 *     summary: 获取所有资源文件列表
 *     description: 管理员获取系统中所有资源文件的分页列表，支持多种筛选和搜索功能
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 每页数量
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: 筛选启用/禁用状态的文件
 *       - in: query
 *         name: file_type
 *         schema:
 *           type: string
 *         description: 文件类型筛选
 *       - in: query
 *         name: quality
 *         schema:
 *           type: string
 *         description: 文件质量筛选
 *       - in: query
 *         name: resource_id
 *         schema:
 *           type: integer
 *         description: 资源ID筛选
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 搜索关键词（文件名或资源标题）
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [created_at, name, file_size, download_count, sort_order]
 *           default: created_at
 *         description: 排序字段
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *         description: 排序方向
 *     responses:
 *       200:
 *         description: 获取文件列表成功
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
 *                           items:
 *                             allOf:
 *                               - $ref: '#/components/schemas/ResourceFile'
 *                               - type: object
 *                                 properties:
 *                                   resource_title:
 *                                     type: string
 *                                     description: 资源标题
 *                                   resource_author_id:
 *                                     type: integer
 *                                     description: 资源作者ID
 *                                   resource_author_username:
 *                                     type: string
 *                                     description: 资源作者用户名
 *                         pagination:
 *                           $ref: '#/components/schemas/PaginationInfo'
 *             example:
 *               success: true
 *               message: "获取所有文件列表成功"
 *               data:
 *                 files:
 *                   - id: 1
 *                     name: "示例文件.pdf"
 *                     resource_title: "Vue.js教程"
 *                     resource_author_username: "admin"
 *                     file_size: 1024000
 *                     is_active: true
 *                     download_count: 100
 *                 pagination:
 *                   current_page: 1
 *                   per_page: 20
 *                   total_items: 50
 *                   total_pages: 3
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getAllResourceFiles = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      is_active,
      file_type,
      quality,
      resource_id,
      search,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      fileType: file_type,
      quality,
      resourceId: resource_id ? parseInt(resource_id) : undefined,
      search,
      sortBy: sort_by,
      sortOrder: sort_order
    };

    // 处理 is_active 参数
    if (is_active !== undefined) {
      options.isActive = is_active === 'true';
    }

    const result = await ResourceFile.findAll(options);

    res.json({
      success: true,
      message: '获取所有文件列表成功',
      data: result
    });
  } catch (error) {
    logger.error('获取所有文件列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取所有文件列表失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/resource-files/batch-delete:
 *   post:
 *     tags: [ResourceFiles]
 *     summary: 批量删除资源文件
 *     description: 管理员批量删除指定的资源文件（软删除）
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - file_ids
 *             properties:
 *               file_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: 要删除的文件ID列表
 *                 example: [1, 2, 3]
 *     responses:
 *       200:
 *         description: 批量删除成功
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
 *                         deleted_count:
 *                           type: integer
 *                           description: 成功删除的文件数量
 *                         failed_ids:
 *                           type: array
 *                           items:
 *                             type: integer
 *                           description: 删除失败的文件ID
 *             example:
 *               success: true
 *               message: "批量删除文件成功，共删除3个文件"
 *               data:
 *                 deleted_count: 3
 *                 failed_ids: []
 *       400:
 *         description: 请求参数错误
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const batchDeleteResourceFiles = async (req, res) => {
  try {
    const { file_ids } = req.body;

    if (!Array.isArray(file_ids) || file_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '文件ID列表不能为空'
      });
    }

    // 验证所有ID都是数字
    const invalidIds = file_ids.filter(id => !Number.isInteger(id) || id <= 0);
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: '无效的文件ID'
      });
    }

    const results = await Promise.allSettled(
      file_ids.map(id => ResourceFile.softDelete(id))
    );

    const deletedCount = results.filter(result => result.status === 'fulfilled' && result.value).length;
    const failedIds = file_ids.filter((id, index) =>
      results[index].status === 'rejected' || !results[index].value
    );

    res.json({
      success: true,
      message: `批量删除文件成功，共删除${deletedCount}个文件`,
      data: {
        deleted_count: deletedCount,
        failed_ids: failedIds
      }
    });
  } catch (error) {
    logger.error('批量删除资源文件失败:', error);
    res.status(500).json({
      success: false,
      message: '批量删除资源文件失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/resource-files/batch-update:
 *   post:
 *     tags: [ResourceFiles]
 *     summary: 批量更新资源文件
 *     description: 管理员批量更新指定的资源文件信息
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - updates
 *             properties:
 *               updates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - id
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: 文件ID
 *                     name:
 *                       type: string
 *                       description: 文件名称
 *                     url:
 *                       type: string
 *                       description: 文件URL
 *                     file_size:
 *                       type: integer
 *                       description: 文件大小
 *                     file_type:
 *                       type: string
 *                       description: 文件类型
 *                     file_extension:
 *                       type: string
 *                       description: 文件扩展名
 *                     quality:
 *                       type: string
 *                       description: 文件质量
 *                     version:
 *                       type: string
 *                       description: 版本
 *                     language:
 *                       type: string
 *                       description: 语言
 *                     sort_order:
 *                       type: integer
 *                       description: 排序顺序
 *                     is_active:
 *                       type: boolean
 *                       description: 是否启用
 *                 description: 更新数据列表
 *                 example:
 *                   - id: 1
 *                     name: "更新的文件名"
 *                     is_active: false
 *                   - id: 2
 *                     quality: "4K"
 *                     sort_order: 10
 *     responses:
 *       200:
 *         description: 批量更新成功
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
 *                         updated_count:
 *                           type: integer
 *                           description: 成功更新的文件数量
 *                         failed_updates:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               error:
 *                                 type: string
 *                           description: 更新失败的文件信息
 *             example:
 *               success: true
 *               message: "批量更新文件成功，共更新2个文件"
 *               data:
 *                 updated_count: 2
 *                 failed_updates: []
 *       400:
 *         description: 请求参数错误
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const batchUpdateResourceFiles = async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '更新数据不能为空'
      });
    }

    // 验证更新数据格式
    for (const update of updates) {
      if (!update.id || !Number.isInteger(update.id) || update.id <= 0) {
        return res.status(400).json({
          success: false,
          message: '每个更新项必须包含有效的文件ID'
        });
      }
    }

    const results = await Promise.allSettled(
      updates.map(async (updateData) => {
        const { id, ...data } = updateData;

        // 转换字段名称
        const mappedData = {};
        if (data.file_size !== undefined) mappedData.file_size = data.file_size;
        if (data.file_type !== undefined) mappedData.file_type = data.file_type;
        if (data.file_extension !== undefined) mappedData.file_extension = data.file_extension;
        if (data.sort_order !== undefined) mappedData.sort_order = data.sort_order;
        if (data.is_active !== undefined) mappedData.is_active = data.is_active;

        // 直接映射的字段
        ['name', 'url', 'quality', 'version', 'language'].forEach(field => {
          if (data[field] !== undefined) {
            mappedData[field] = data[field];
          }
        });

        if (Object.keys(mappedData).length === 0) {
          throw new Error('没有提供更新数据');
        }

        return { id, result: await ResourceFile.update(id, mappedData) };
      })
    );

    const successfulUpdates = results.filter(result =>
      result.status === 'fulfilled' && result.value.result
    );

    const failedUpdates = results
      .map((result, index) => {
        if (result.status === 'rejected') {
          return { id: updates[index].id, error: result.reason.message };
        } else if (!result.value.result) {
          return { id: updates[index].id, error: '文件不存在或更新失败' };
        }
        return null;
      })
      .filter(Boolean);

    res.json({
      success: true,
      message: `批量更新文件成功，共更新${successfulUpdates.length}个文件`,
      data: {
        updated_count: successfulUpdates.length,
        failed_updates: failedUpdates
      }
    });
  } catch (error) {
    logger.error('批量更新资源文件失败:', error);
    res.status(500).json({
      success: false,
      message: '批量更新资源文件失败'
    });
  }
};

module.exports = {
  getResourceFiles,
  createResourceFile,
  updateResourceFile,
  deleteResourceFile,
  updateFileSort,
  getFileStatistics,
  getAllResourceFiles,
  batchDeleteResourceFiles,
  batchUpdateResourceFiles
};