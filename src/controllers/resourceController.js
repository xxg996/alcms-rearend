/**
 * 资源管理控制器
 * 处理资源相关的HTTP请求
 * 
 * @swagger
 * tags:
 *   - name: 资源管理相关
 *     description: 资源管理相关api
 */

const Resource = require('../models/Resource');
const Category = require('../models/Category');
const Tag = require('../models/Tag');
const ResourceInteraction = require('../models/ResourceInteraction');
const { generateSecureResourceInfo } = require('../utils/downloadUtils');
const { generateSecureResourceInfoBatch } = require('../utils/downloadUtilsBatch');
const { checkAndResetDailyDownloads } = require('../utils/downloadLimitUtils');
const { query } = require('../config/database');
const { logger } = require('../utils/logger');
const AuditLog = require('../models/AuditLog');
const { successResponse, errorResponse } = require('../utils/responseHelper');

const getRequestMeta = (req) => ({
  ipAddress: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip,
  userAgent: req.get('user-agent') || ''
});

class ResourceController {
  /**
   * @swagger
   * /api/resources:
   *   get:
   *     tags: [资源管理相关]
   *     summary: 获取资源列表
   *     description: |
   *       获取分页的资源列表，支持多种过滤和排序选项。
   *
   *       **权限控制说明：**
   *       - 未登录用户：只能看到公开的已发布资源（is_public=true, status='published'）
   *       - 已登录用户：额外可以看到自己创建的所有状态资源
   *       - 管理员：可以通过 include_all=true 参数查看所有资源
   *
   *       **默认过滤：**
   *       - 默认只返回已发布的资源（status='published'）
   *       - 使用 include_all=true 可以返回所有状态的资源（需要相应权限）
   *
   *     security:
 *       - BearerAuth: []
 *       - {}
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
   *           maximum: 100
   *         description: 每页数量（最大100）
   *       - in: query
   *         name: category_id
   *         schema:
   *           type: integer
   *         description: 分类ID过滤
   *       - in: query
   *         name: resource_type_id
   *         schema:
   *           type: integer
   *         description: 资源类型ID过滤
   *       - in: query
   *         name: author_id
   *         schema:
   *           type: integer
   *         description: 作者ID过滤
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [draft, published, archived, deleted]
   *         description: 状态过滤
   *       - in: query
   *         name: is_public
   *         schema:
   *           type: boolean
   *         description: 是否公开过滤
   *       - in: query
   *         name: is_free
   *         schema:
   *           type: boolean
   *         description: 是否免费过滤
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: 搜索关键词
   *       - in: query
   *         name: tags
   *         schema:
   *           type: string
   *         description: 标签ID列表，逗号分隔，例如 "1,2,3"
   *       - in: query
   *         name: sort_by
   *         schema:
   *           type: string
   *           enum: [created_at, updated_at, published_at, view_count, download_count, like_count]
   *           default: created_at
   *         description: 排序字段
   *       - in: query
   *         name: sort_order
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: desc
   *         description: 排序方向
   *     responses:
   *       200:
   *         description: 获取资源列表成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/ResourceListResponse'
   *             example:
   *               success: true
   *               data:
   *                 resources: []
   *                 pagination:
   *                   page: 1
   *                   limit: 20
   *                   total: 0
   *                   totalPages: 0
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async getResources(req, res) {
    try {
      logger.debug('获取资源列表请求参数', { query: req.query });
      
      const {
        page = 1,
        limit = 20,
        category_id,
        resource_type_id,
        author_id,
        status,
        is_public,
        search,
        tags,
        sort_by,
        sort_order
      } = req.query;

      const rawTags = tags ? (Array.isArray(tags) ? tags : String(tags).split(',')) : [];
      const tagIds = rawTags
        .map(tag => {
          if (typeof tag === 'number') return tag;
          if (typeof tag === 'string' && tag.trim() !== '') {
            const parsed = parseInt(tag.trim(), 10);
            return Number.isFinite(parsed) ? parsed : null;
          }
          return null;
        })
        .filter(id => Number.isFinite(id));

      const includeAll = String(req.query.include_all || '').toLowerCase() === 'true';
      const resolvedStatus = includeAll ? undefined : (status ?? 'published');

      const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        category_id: category_id !== undefined ? toIntegerOrNull(category_id) : undefined,
        resource_type_id: resource_type_id !== undefined ? toIntegerOrNull(resource_type_id) : undefined,
        author_id: author_id !== undefined ? toIntegerOrNull(author_id) : undefined,
        status: resolvedStatus,
        is_public: is_public !== undefined ? toBoolean(is_public, true) : undefined,
        search,
        tags: tagIds.length > 0 ? tagIds : undefined,
        sort_by,
        sort_order
      };

      logger.debug('解析后的查询选项', options);
      
      const result = await Resource.findAll(options);

      // 批量生成安全信息，解决N+1查询问题
      if (result.resources && result.resources.length > 0) {
        result.resources = await generateSecureResourceInfoBatch(
          result.resources, 
          req.user?.id
        );
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('获取资源列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取资源列表失败',
        error: error.message
      });
    }
  }

  /**
   * @swagger
   * /api/resources/{id}:
   *   get:
   *     tags: [资源管理相关]
   *     summary: 获取单个资源详情
   *     description: |
   *       根据资源ID获取资源的详细信息。
   *
   *       **权限控制说明：**
   *       - 公开资源（is_public=true）：所有用户（包括未登录游客）都可以访问
   *       - 私有资源（is_public=false）：仅以下用户可以访问：
   *         - 资源作者本人
   *         - 拥有 'resource:read' 权限的管理员用户
   *
   *       **响应内容：**
   *       - 未登录用户：返回基本资源信息
   *       - 已登录用户：额外返回用户相关的个人化数据（如收藏状态等）
   *       - 下载状态信息请查看 /api/files/{resourceId} 接口
   *     security:
 *       - BearerAuth: []
 *       - {}
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 资源ID
   *     responses:
   *       200:
   *         description: 获取资源详情成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/Resource'
   *             example:
   *               success: true
   *               data:
   *                 id: 1
   *                 title: "Vue.js 完整教程"
   *                 slug: "vue-complete-tutorial"
   *                 description: "从基础到高级的 Vue.js 学习教程"
   *                 author_id: 1
   *                 author_username: "admin"
   *                 status: "published"
   *                 is_public: true
   *                 is_free: false
   *                 required_points: 100
   *                 view_count: 1251
   *                 download_count: 89
   *                 like_count: 45
   *                 created_at: "2025-09-11T10:00:00.000Z"
   *                 updated_at: "2025-09-12T08:00:00.000Z"
   *                 user_download_status:
   *                   daily_limit: 50
   *                   daily_used: 15
   *                   remaining_downloads: 35
   *                   can_download: true
   *                   purchased_today: false
   *                   download_cost:
   *                     type: "download_count"
   *                     cost: 1
   *                   purchased_info: null
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         description: |
   *           权限不足 - 尝试访问私有资源但没有足够权限。
   *
   *           **可能的原因：**
   *           - 未登录用户尝试访问私有资源（is_public=false）
   *           - 已登录用户尝试访问不属于自己且无管理权限的私有资源
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "无权访问此资源"
   *       404:
   *         description: 资源不存在
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "资源不存在"
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async getResource(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const resource = await Resource.findById(parseInt(id), userId);

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: '资源不存在'
        });
      }

      // 检查访问权限
      if (!resource.is_public && (!userId || resource.author_id !== userId)) {
        // 检查用户是否有权限访问私有资源
        const hasPermission = await ResourceController.checkResourceAccessPermission(userId, resource);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: '无权访问此资源'
          });
        }
      }

      // 增加浏览次数（异步执行，不等待结果）
      Resource.incrementViewCount(parseInt(id)).catch(console.error);

      // 生成安全的资源信息（隐藏真实下载链接）
      const secureResource = await generateSecureResourceInfo(resource, userId);


      res.json({
        success: true,
        data: secureResource
      });
    } catch (error) {
      logger.error('获取资源详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取资源详情失败',
        error: error.message
      });
    }
  }

  /**
   * @swagger
   * /api/resources:
   *   post:
   *     tags: [资源管理相关]
   *     summary: 创建新资源
   *     description: 创建一个新的资源，需要认证
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateResourceRequest'
   *           example:
   *             title: "新的Vue.js教程"
   *             description: "这是一个全面的Vue.js学习教程"
   *             summary: "适合初学者的教程"
   *             category_id: 1
   *             resource_type_id: 1
   *             cover_image_url: "https://example.com/cover.jpg"
   *             is_public: true
   *             is_free: false
   *             required_points: 50
   *             tags: [1, 2, 3]
   *     responses:
   *       201:
   *         description: 资源创建成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/Resource'
   *                     message:
   *                       type: string
   *                       example: "资源创建成功"
   *             example:
   *               success: true
   *               message: "资源创建成功"
   *               data:
   *                 id: 1
   *                 title: "新的Vue.js教程"
   *                 slug: "new-vue-tutorial"
   *                 description: "这是一个全面的Vue.js学习教程"
   *                 author_id: 1
   *                 status: "draft"
   *                 created_at: "2025-09-12T10:00:00.000Z"
   *                 updated_at: "2025-09-12T10:00:00.000Z"
   *       400:
   *         description: 请求参数错误
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "标题和资源类型为必填字段"
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async createResource(req, res) {
    const { ipAddress, userAgent } = getRequestMeta(req);
    try {
      const userId = req.user.id;
      const {
        title,
        slug,
        description,
        summary,
        category_id,
        resource_type_id,
        cover_image_url,
        is_public = true,
        is_free = true,
        required_points = 0,
        status,
        tags = [],
        official = false
      } = req.body;

      if (!title || resource_type_id === undefined || resource_type_id === null) {
        return res.status(400).json({
          success: false,
          message: '标题和资源类型为必填字段'
        });
      }

      // 检查设置official字段的权限
      if (official === true) {
        const userPermissions = await require('../models/User').getUserPermissions(userId);
        const canPublishOfficial = userPermissions.some(p => p.name === 'resource:publish_official');

        if (!canPublishOfficial) {
          return res.status(403).json({
            success: false,
            message: '无权发布官方资源'
          });
        }
      }

      const tagIds = await normalizeTagInputs(tags);

      const normalizedCategoryId = toIntegerOrNull(category_id);
      const normalizedResourceTypeId = toIntegerOrNull(resource_type_id, null);

      if (normalizedResourceTypeId === null) {
        return res.status(400).json({
          success: false,
          message: '资源类型ID无效'
        });
      }

      const resourceData = {
        title,
        slug,
        description,
        summary,
        category_id: normalizedCategoryId,
        resource_type_id: normalizedResourceTypeId,
        cover_image_url,
        is_public: toBoolean(is_public, true),
        is_free: toBoolean(is_free, true),
        required_points: toNonNegativeInt(required_points),
        status: status || 'published',
        author_id: userId,
        tags: tagIds,
        official: toBoolean(official, false)
      };

      const resource = await Resource.create(resourceData);

      await AuditLog.createSystemLog({
        operatorId: userId,
        targetType: 'resource',
        targetId: resource.id,
        action: 'create',
        summary: `创建资源 ${resource.title}`,
        detail: { status: resource.status },
        ipAddress,
        userAgent
      });

      res.status(201).json({
        success: true,
        message: '资源创建成功',
        data: resource
      });
    } catch (error) {
      logger.error('创建资源失败:', error);
      await AuditLog.createSystemLog({
        operatorId: req.user?.id || null,
        targetType: 'resource',
        targetId: null,
        action: 'create_failed',
        summary: '创建资源失败',
        detail: { error: error.message },
        ipAddress,
        userAgent
      });
      res.status(500).json({
        success: false,
        message: '创建资源失败',
        error: error.message
      });
    }
  }

  /**
   * @swagger
   * /api/resources/{id}:
   *   put:
   *     tags: [资源管理相关]
   *     summary: 更新资源
   *     description: 更新指定ID的资源，只有作者或管理员可以操作
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 资源ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateResourceRequest'
   *           example:
   *             title: "更新的教程标题"
   *             description: "更新后的描述内容"
   *             summary: "更新的摘要"
   *             cover_image_url: "https://example.com/new-cover.jpg"
   *             category_id: 2
   *             is_public: false
   *             is_free: true
   *             required_points: 100
   *             tags: [1, 4, 5]
   *     responses:
   *       200:
   *         description: 资源更新成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/Resource'
   *                     message:
   *                       type: string
   *                       example: "资源更新成功"
   *             example:
   *               success: true
   *               message: "资源更新成功"
   *               data:
   *                 id: 1
   *                 title: "更新的教程标题"
   *                 description: "更新后的描述内容"
   *                 updated_at: "2025-09-12T12:00:00.000Z"
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         description: 无权编辑此资源
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "无权编辑此资源"
   *       404:
   *         description: 资源不存在
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "资源不存在"
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async updateResource(req, res) {
    const { ipAddress, userAgent } = getRequestMeta(req);
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updateData = req.body || {};

      const resource = await Resource.findById(parseInt(id));

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: '资源不存在'
        });
      }

      // 权限检查：只有作者或管理员可以编辑
      const canEdit = await ResourceController.checkResourceEditPermission(userId, resource);
      if (!canEdit) {
        return res.status(403).json({
          success: false,
          message: '无权编辑此资源'
        });
      }

      // 检查修改official字段的权限
      if (Object.prototype.hasOwnProperty.call(updateData, 'official') && updateData.official === true) {
        const userPermissions = await require('../models/User').getUserPermissions(userId);
        const canPublishOfficial = userPermissions.some(p => p.name === 'resource:publish_official');

        if (!canPublishOfficial) {
          return res.status(403).json({
            success: false,
            message: '无权设置资源为官方资源'
          });
        }
      }

      const sanitizedUpdate = {};

      if (updateData.tags) {
        const tagIds = await normalizeTagInputs(updateData.tags);
        await Tag.syncResourceTags(parseInt(id), tagIds);
      }

      const assignIfPresent = (field, transformer = (v) => v) => {
        if (Object.prototype.hasOwnProperty.call(updateData, field)) {
          sanitizedUpdate[field] = transformer(updateData[field]);
        }
      };

      ['title', 'slug', 'description', 'summary', 'cover_image_url', 'status'].forEach((field) => {
        assignIfPresent(field);
      });

      assignIfPresent('category_id', (value) => toIntegerOrNull(value));

      if (Object.prototype.hasOwnProperty.call(updateData, 'resource_type_id')) {
        const normalized = toIntegerOrNull(updateData.resource_type_id, null);
        if (normalized === null) {
          return res.status(400).json({
            success: false,
            message: '资源类型ID无效'
          });
        }
        sanitizedUpdate.resource_type_id = normalized;
      }

      assignIfPresent('is_public', (value) => toBoolean(value, resource.is_public));
      assignIfPresent('is_free', (value) => toBoolean(value, resource.is_free));
      assignIfPresent('required_points', (value) => toNonNegativeInt(value, resource.required_points || 0));
      assignIfPresent('official', (value) => toBoolean(value, resource.official || false));

      if (Object.keys(sanitizedUpdate).length === 0 && !updateData.tags) {
        return res.status(400).json({
          success: false,
          message: '未提供可更新的字段'
        });
      }

      const updatedResource = Object.keys(sanitizedUpdate).length > 0
        ? await Resource.update(parseInt(id), sanitizedUpdate)
        : resource;

      await AuditLog.createSystemLog({
        operatorId: userId,
        targetType: 'resource',
        targetId: updatedResource.id,
        action: 'update',
        summary: `更新资源 ${updatedResource.title}`,
        detail: {
          fields: Object.keys(sanitizedUpdate),
          before: { status: resource.status },
          after: { status: updatedResource.status }
        },
        ipAddress,
        userAgent
      });

      res.json({
        success: true,
        message: '资源更新成功',
        data: updatedResource
      });
    } catch (error) {
      logger.error('更新资源失败:', error);
      await AuditLog.createSystemLog({
        operatorId: req.user?.id || null,
        targetType: 'resource',
        targetId: req.params?.id || null,
        action: 'update_failed',
        summary: '更新资源失败',
        detail: { error: error.message },
        ipAddress,
        userAgent
      });
      res.status(500).json({
        success: false,
        message: '更新资源失败',
        error: error.message
      });
    }
  }

  /**
   * @swagger
   * /api/resources/{id}:
   *   delete:
   *     tags: [资源管理相关]
   *     summary: 删除资源
   *     description: 删除指定ID的资源，只有作者或管理员可以操作
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 资源ID
   *     responses:
   *       200:
   *         description: 资源删除成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     message:
   *                       type: string
   *                       example: "资源删除成功"
   *             example:
   *               success: true
   *               message: "资源删除成功"
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         description: 无权删除此资源
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "无权删除此资源"
   *       404:
   *         description: 资源不存在
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "资源不存在"
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async deleteResource(req, res) {
    const { ipAddress, userAgent } = getRequestMeta(req);
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const resource = await Resource.findById(parseInt(id));

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: '资源不存在'
        });
      }

      // 权限检查：只有作者或管理员可以删除
      const canDelete = await ResourceController.checkResourceDeletePermission(userId, resource);
      if (!canDelete) {
        return res.status(403).json({
          success: false,
          message: '无权删除此资源'
        });
      }

      const deletedResource = await Resource.delete(parseInt(id));

      await AuditLog.createSystemLog({
        operatorId: userId,
        targetType: 'resource',
        targetId: id,
        action: 'delete',
        summary: `删除资源 ${resource.title}`,
        detail: { status: deletedResource?.status || 'deleted' },
        ipAddress,
        userAgent
      });

      res.json({
        success: true,
        message: '资源删除成功'
      });
    } catch (error) {
      logger.error('删除资源失败:', error);
      await AuditLog.createSystemLog({
        operatorId: req.user?.id || null,
        targetType: 'resource',
        targetId: req.params?.id || null,
        action: 'delete_failed',
        summary: '删除资源失败',
        detail: { error: error.message },
        ipAddress,
        userAgent
      });
      res.status(500).json({
        success: false,
        message: '删除资源失败',
        error: error.message
      });
    }
  }

  // 注意：下载功能已迁移到 /api/admin/resources/:id/files 和 /api/user/download/:fileId

  /**
   * @swagger
   * /api/resources/search:
   *   get:
   *     tags: [资源管理相关]
   *     summary: 搜索资源
   *     description: 使用关键词进行全文搜索资源
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *           minLength: 1
   *         description: 搜索关键词
   *         example: "Vue"
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
   *         name: type
   *         schema:
   *           type: string
   *         description: 搜索类型过滤
   *     responses:
   *       200:
   *         description: 搜索成功
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
   *                         resources:
   *                           type: array
   *                           items:
   *                             $ref: '#/components/schemas/Resource'
   *                         query:
   *                           type: string
   *                           description: 搜索关键词
   *                         pagination:
   *                           $ref: '#/components/schemas/Pagination'
   *             example:
   *               success: true
   *               data:
   *                 resources: []
   *                 query: "Vue"
   *                 pagination:
   *                   page: 1
   *                   limit: 20
   *                   total: 0
   *       400:
   *         description: 搜索关键词为空
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "搜索关键词不能为空"
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async searchResources(req, res) {
    try {
      const { q: query, page = 1, limit = 20, type } = req.query;

      if (!query || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: '搜索关键词不能为空'
        });
      }

      const currentPage = Math.max(parseInt(page, 10) || 1, 1);
      const currentLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const offset = (currentPage - 1) * currentLimit;

      const searchResults = await Resource.fullTextSearch(query.trim(), {
        limit: currentLimit,
        offset
      });

      res.json({
        success: true,
        data: {
          resources: searchResults,
          query: query.trim(),
          pagination: {
            page: currentPage,
            limit: currentLimit,
            total: searchResults.length
          }
        }
      });
    } catch (error) {
      logger.error('搜索资源失败:', error);
      res.status(500).json({
        success: false,
        message: '搜索失败',
        error: error.message
      });
    }
  }

  /**
   * @swagger
   * /api/resources/stats:
   *   get:
   *     tags: [资源管理相关]
   *     summary: 获取资源统计信息
   *     description: 获取系统中资源的统计数据，包括总数、状态分布、类型分布等
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: 获取统计信息成功
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
   *                         overview:
   *                           type: object
   *                           properties:
   *                             total_resources:
   *                               type: integer
   *                               description: 总资源数
   *                             published_resources:
   *                               type: integer
   *                               description: 已发布资源数
   *                             draft_resources:
   *                               type: integer
   *                               description: 草稿资源数
   *                             public_resources:
   *                               type: integer
   *                               description: 公开资源数
   *                             free_resources:
   *                               type: integer
   *                               description: 免费资源数
   *                             total_views:
   *                               type: integer
   *                               description: 总浏览次数
   *                             total_downloads:
   *                               type: integer
   *                               description: 总下载次数
   *                             avg_file_size:
   *                               type: number
   *                               description: 平均文件大小
   *                         byType:
   *                           type: array
   *                           items:
   *                             type: object
   *                             properties:
   *                               type_name:
   *                                 type: string
   *                                 description: 资源类型名称
   *                               count:
   *                                 type: integer
   *                                 description: 该类型资源数量
   *                         byCategory:
   *                           type: array
   *                           items:
   *                             type: object
   *                             properties:
   *                               category_name:
   *                                 type: string
   *                                 description: 分类名称
   *                               count:
   *                                 type: integer
   *                                 description: 该分类资源数量
   *             example:
   *               success: true
   *               data:
   *                 overview:
   *                   total_resources: 150
   *                   published_resources: 120
   *                   draft_resources: 30
   *                   public_resources: 100
   *                   free_resources: 80
   *                   total_views: 15000
   *                   total_downloads: 3500
   *                   avg_file_size: 2048000
   *                 byType:
   *                   - type_name: "文章"
   *                     count: 60
   *                   - type_name: "视频"
   *                     count: 40
   *                 byCategory:
   *                   - category_name: "科技"
   *                     count: 50
   *                   - category_name: "教育"
   *                     count: 35
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async getResourceStats(req, res) {
    try {
      const { query } = require('../config/database');

      const stats = await query(`
        SELECT 
          COUNT(*) as total_resources,
          COUNT(CASE WHEN status = 'published' THEN 1 END) as published_resources,
          COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_resources,
          COUNT(CASE WHEN is_public = true THEN 1 END) as public_resources,
          COUNT(CASE WHEN is_free = true THEN 1 END) as free_resources,
          SUM(view_count) as total_views,
          SUM(download_count) as total_downloads,
          AVG(file_size) as avg_file_size
        FROM resources
      `);

      const typeStats = await query(`
        SELECT 
          rt.display_name as type_name,
          COUNT(r.id) as count
        FROM resource_types rt
        LEFT JOIN resources r ON rt.id = r.resource_type_id
        GROUP BY rt.id, rt.display_name
        ORDER BY count DESC
      `);

      const categoryStats = await query(`
        SELECT 
          c.display_name as category_name,
          COUNT(r.id) as count
        FROM categories c
        LEFT JOIN resources r ON c.id = r.category_id
        GROUP BY c.id, c.display_name
        ORDER BY count DESC
        LIMIT 10
      `);

      res.json({
        success: true,
        data: {
          overview: stats.rows[0],
          byType: typeStats.rows,
          byCategory: categoryStats.rows
        }
      });
    } catch (error) {
      logger.error('获取资源统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取统计信息失败',
        error: error.message
      });
    }
  }

  // 权限检查辅助方法
  static async checkResourceAccessPermission(userId, resource) {
    if (!userId) return false;
    
    // 作者可以访问自己的资源
    if (resource.author_id === userId) return true;
    
    // 检查管理员权限
    return await this.hasPermission(userId, 'resource:read');
  }

  static async checkResourceEditPermission(userId, resource) {
    // 作者可以编辑自己的资源
    if (resource.author_id === userId) return true;
    
    // 检查管理员权限
    return await this.hasPermission(userId, 'resource:update');
  }

  static async checkResourceDeletePermission(userId, resource) {
    // 作者可以删除自己的资源
    if (resource.author_id === userId) return true;
    
    // 检查管理员权限
    return await this.hasPermission(userId, 'resource:delete');
  }

  static async hasPermission(userId, permissionName) {
    const { query } = require('../config/database');
    
    const result = await query(`
      SELECT 1 FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1 AND p.name = $2
      LIMIT 1
    `, [userId, permissionName]);
    
    return result.rows.length > 0;
  }

  /**
   * @swagger
   * /api/resources/{id}/like:
   *   post:
   *     tags: [资源管理相关]
   *     summary: 点赞/取消点赞资源
   *     description: 切换资源的点赞状态
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 资源ID
   *     responses:
   *       200:
   *         description: 操作成功
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   type: object
   *                   properties:
   *                     isLiked:
   *                       type: boolean
   *                     likeCount:
   *                       type: integer
   *                     action:
   *                       type: string
   *                       enum: [liked, unliked]
   *       400:
   *         description: 请求参数错误
   *       401:
   *         description: 未授权
   *       404:
   *         description: 资源不存在
   *       500:
   *         description: 服务器错误
   */
  static async toggleLike(req, res) {
    try {
      const resourceId = parseInt(req.params.id, 10);
      const userId = req.user.id;

      if (Number.isNaN(resourceId) || resourceId <= 0) {
        return errorResponse(res, '资源ID格式不正确', 400);
      }

      // 检查资源是否存在
      const resourceResult = await query('SELECT id FROM resources WHERE id = $1', [resourceId]);
      if (resourceResult.rows.length === 0) {
        return errorResponse(res, '资源不存在', 404);
      }

      const result = await ResourceInteraction.toggleLike(userId, resourceId);

      const message = result.action === 'liked' ? '点赞成功' : '取消点赞成功';
      return successResponse(res, message, result);

    } catch (error) {
      logger.error('切换资源点赞状态失败:', error);
      return errorResponse(res, '操作失败', 500);
    }
  }

  /**
   * @swagger
   * /api/resources/{id}/likes:
   *   get:
   *     tags: [资源管理相关]
   *     summary: 获取资源点赞列表
   *     description: 获取资源的点赞用户列表
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 资源ID
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
   *     responses:
   *       200:
   *         description: 获取成功
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   type: object
   *                   properties:
   *                     data:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           id:
   *                             type: integer
   *                           user_id:
   *                             type: integer
   *                           username:
   *                             type: string
   *                           nickname:
   *                             type: string
   *                           avatar_url:
   *                             type: string
   *                           created_at:
   *                             type: string
   *                     pagination:
   *                       type: object
   *       400:
   *         description: 请求参数错误
   *       404:
   *         description: 资源不存在
   *       500:
   *         description: 服务器错误
   */
  static async getResourceLikes(req, res) {
    try {
      const resourceId = parseInt(req.params.id, 10);
      const page = parseInt(req.query.page, 10) || 1;
      const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

      if (Number.isNaN(resourceId) || resourceId <= 0) {
        return errorResponse(res, '资源ID格式不正确', 400);
      }

      // 检查资源是否存在
      const resourceResult = await query('SELECT id FROM resources WHERE id = $1', [resourceId]);
      if (resourceResult.rows.length === 0) {
        return errorResponse(res, '资源不存在', 404);
      }

      const result = await ResourceInteraction.getResourceLikes(resourceId, {
        page,
        limit
      });

      return successResponse(res, '获取点赞列表成功', result);

    } catch (error) {
      logger.error('获取资源点赞列表失败:', error);
      return errorResponse(res, '获取点赞列表失败', 500);
    }
  }
}

module.exports = ResourceController;

const normalizeTagInputs = async (rawTags = []) => {
  if (!Array.isArray(rawTags) || rawTags.length === 0) {
    return [];
  }

  const ids = rawTags
    .map((tag) => {
      if (typeof tag === 'number' && Number.isFinite(tag)) {
        return Math.trunc(tag);
      }
      if (typeof tag === 'string' && /^\d+$/.test(tag.trim())) {
        return Number(tag.trim());
      }
      if (typeof tag === 'object' && tag !== null && tag.id !== undefined) {
        const numericId = Number(tag.id);
        return Number.isFinite(numericId) ? numericId : null;
      }
      return null;
    })
    .filter((id) => Number.isFinite(id) && id > 0);

  if (ids.length === 0) {
    return [];
  }

  const existingIds = await Tag.filterExistingIds(ids);
  return existingIds;
};

const toBoolean = (value, defaultValue = true) => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === '') {
    return defaultValue;
  }

  return !['false', '0', 'no', 'off'].includes(normalized);
};

const toIntegerOrNull = (value, defaultValue = null) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return defaultValue;
  }

  return Math.trunc(numeric);
};

const toNonNegativeInt = (value, defaultValue = 0) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return Math.trunc(numeric);
  }
  return defaultValue;
};
