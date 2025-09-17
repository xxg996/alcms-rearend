/**
 * 资源文件管理控制器
 * 处理资源文件的增删改查操作
 */

const ResourceFile = require('../models/ResourceFile');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/admin/resources/{resourceId}/files:
 *   get:
 *     tags: [ResourceFiles]
 *     summary: 获取资源的所有文件
 *     description: 管理员获取指定资源的所有下载文件
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
    const { include_inactive, file_type, quality } = req.query;

    const options = {
      includeInactive: include_inactive === 'true',
      fileType: file_type,
      quality
    };

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
 * /api/admin/resources/{resourceId}/files:
 *   post:
 *     tags: [ResourceFiles]
 *     summary: 添加资源文件
 *     description: 管理员为指定资源添加下载文件
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
 * /api/admin/resource-files/{fileId}:
 *   put:
 *     tags: [ResourceFiles]
 *     summary: 更新资源文件
 *     description: 管理员更新指定的资源文件信息
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
 * /api/admin/resource-files/{fileId}:
 *   delete:
 *     tags: [ResourceFiles]
 *     summary: 删除资源文件
 *     description: 管理员删除指定的资源文件（软删除）
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
 *       404:
 *         description: 文件不存在
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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
 * /api/admin/resources/{resourceId}/files/sort:
 *   put:
 *     tags: [ResourceFiles]
 *     summary: 更新文件排序
 *     description: 管理员更新资源文件的排序顺序
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

module.exports = {
  getResourceFiles,
  createResourceFile,
  updateResourceFile,
  deleteResourceFile,
  updateFileSort,
  getFileStatistics
};