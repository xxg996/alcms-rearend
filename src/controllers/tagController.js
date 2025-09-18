/**
 * 标签管理控制器
 * 处理标签相关的HTTP请求
 * 
 * @swagger
 * tags:
 *   - name: Tags
 *     description: 标签管理相关接口
 */

const Tag = require('../models/Tag');
const { logger } = require('../utils/logger');

class TagController {
  /**
   * @swagger
   * /api/tags:
   *   get:
   *     tags: [Tags]
   *     summary: 获取标签列表
   *     description: 获取标签列表，支持搜索、排序和分页
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: 搜索关键词
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [name, display_name, usage_count, created_at]
   *           default: usage_count
   *         description: 排序字段
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [ASC, DESC]
   *           default: DESC
   *         description: 排序方向
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *         description: 返回数量限制
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: 页码（需配合limit使用）
   *     responses:
   *       200:
   *         description: 获取标签列表成功
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TagListResponse'
   *             example:
   *               success: true
   *               data:
   *                 tags:
   *                   - id: 1
   *                     name: "javascript"
   *                     display_name: "JavaScript"
   *                     description: "JavaScript 编程语言"
   *                     color: "#f39c12"
   *                     usage_count: 250
   *                     created_at: "2025-09-11T08:00:00.000Z"
   *                     updated_at: "2025-09-12T10:00:00.000Z"
   *                 pagination:
   *                   page: 1
   *                   limit: 20
   *                   total: 50
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async getTags(req, res) {
    try {
      const {
        search,
        sortBy = 'usage_count',
        sortOrder = 'DESC',
        limit,
        page = 1
      } = req.query;

      const options = {
        search,
        sortBy,
        sortOrder,
        limit: limit ? parseInt(limit) : undefined,
        offset: limit ? (parseInt(page) - 1) * parseInt(limit) : 0
      };

      const tags = await Tag.findAll(options);

      res.json({
        success: true,
        data: {
          tags,
          pagination: limit ? {
            page: parseInt(page),
            limit: parseInt(limit),
            total: tags.length
          } : null
        }
      });
    } catch (error) {
      logger.error('获取标签列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取标签列表失败',
        error: error.message
      });
    }
  }

  /**
   * @swagger
   * /api/tags/{id}:
   *   get:
   *     tags: [Tags]
   *     summary: 获取单个标签详情
   *     description: 根据标签ID获取标签的详细信息
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 标签ID
   *     responses:
   *       200:
   *         description: 获取标签详情成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/Tag'
   *             example:
   *               success: true
   *               data:
   *                 id: 1
   *                 name: "javascript"
   *                 display_name: "JavaScript"
   *                 description: "JavaScript 编程语言相关内容"
   *                 color: "#f39c12"
   *                 usage_count: 250
   *                 created_at: "2025-09-11T08:00:00.000Z"
   *                 updated_at: "2025-09-12T10:00:00.000Z"
   *       404:
   *         description: 标签不存在
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "标签不存在"
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async getTag(req, res) {
    try {
      const { id } = req.params;

      const tag = await Tag.findById(parseInt(id));

      if (!tag) {
        return res.status(404).json({
          success: false,
          message: '标签不存在'
        });
      }

      res.json({
        success: true,
        data: tag
      });
    } catch (error) {
      logger.error('获取标签详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取标签详情失败',
        error: error.message
      });
    }
  }

  /**
   * @swagger
   * /api/tags:
   *   post:
   *     tags: [Tags]
   *     summary: 创建新标签
   *     description: 创建一个新的标签，需要管理员权限
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateTagRequest'
   *           example:
   *             name: "python"
   *             displayName: "Python"
   *             description: "Python 编程语言相关内容"
   *             color: "#3776ab"
   *     responses:
   *       201:
   *         description: 标签创建成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/Tag'
   *                     message:
   *                       type: string
   *                       example: "标签创建成功"
   *       400:
   *         description: 请求参数错误
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             examples:
   *               missing_fields:
   *                 value:
   *                   success: false
   *                   message: "标签名称和显示名称为必填字段"
   *               duplicate_name:
   *                 value:
   *                   success: false
   *                   message: "标签名称已存在"
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         description: 无权创建标签
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "无权创建标签"
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async createTag(req, res) {
    try {
      const { name, displayName, description, color } = req.body;

      // 验证必填字段
      if (!name || !displayName) {
        return res.status(400).json({
          success: false,
          message: '标签名称和显示名称为必填字段'
        });
      }

      // 检查权限
      const hasPermission = await TagController.hasPermission(req.user.id, 'tag:create');
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: '无权创建标签'
        });
      }

      const tagData = {
        name: name.toLowerCase().trim(),
        displayName: displayName.trim(),
        description,
        color: color || '#007bff'
      };

      const tag = await Tag.create(tagData);

      res.status(201).json({
        success: true,
        message: '标签创建成功',
        data: tag
      });
    } catch (error) {
      logger.error('创建标签失败:', error);
      
      if (error.message === '标签名称已存在') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: '创建标签失败',
        error: error.message
      });
    }
  }

  /**
   * 更新标签
   */
  static async updateTag(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // 检查权限
      const hasPermission = await TagController.hasPermission(req.user.id, 'tag:update');
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: '无权更新标签'
        });
      }

      const tag = await Tag.findById(parseInt(id));

      if (!tag) {
        return res.status(404).json({
          success: false,
          message: '标签不存在'
        });
      }

      // 数据预处理
      if (updateData.name) {
        updateData.name = updateData.name.toLowerCase().trim();
      }
      if (updateData.displayName) {
        updateData.displayName = updateData.displayName.trim();
      }

      const updatedTag = await Tag.update(parseInt(id), updateData);

      res.json({
        success: true,
        message: '标签更新成功',
        data: updatedTag
      });
    } catch (error) {
      logger.error('更新标签失败:', error);
      res.status(500).json({
        success: false,
        message: '更新标签失败',
        error: error.message
      });
    }
  }

  /**
   * @swagger
   * /api/tags/delete/{id}:
   *   post:
   *     tags: [Tags]
   *     summary: 删除标签
   *     description: 根据标签ID删除标签，需要管理员权限
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 标签ID
   *         example: 1
   *     responses:
   *       200:
   *         description: 标签删除成功
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SuccessResponse'
   *             example:
   *               success: true
   *               message: "标签删除成功"
   *       400:
   *         description: 标签有关联资源，无法删除
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "标签有关联资源，无法删除"
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         description: 无权删除标签
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "无权删除标签"
   *       404:
   *         description: 标签不存在
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "标签不存在"
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async deleteTag(req, res) {
    try {
      const { id } = req.params;

      // 检查权限
      const hasPermission = await TagController.hasPermission(req.user.id, 'tag:delete');
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: '无权删除标签'
        });
      }

      const tag = await Tag.findById(parseInt(id));

      if (!tag) {
        return res.status(404).json({
          success: false,
          message: '标签不存在'
        });
      }

      await Tag.delete(parseInt(id));

      res.json({
        success: true,
        message: '标签删除成功'
      });
    } catch (error) {
      logger.error('删除标签失败:', error);
      
      if (error.message.includes('关联资源')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: '删除标签失败',
        error: error.message
      });
    }
  }

  /**
   * @swagger
   * /api/tags/search:
   *   get:
   *     tags: [Tags]
   *     summary: 搜索标签
   *     description: 使用关键词搜索标签
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
   *         example: "js"
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *           maximum: 50
   *         description: 返回数量限制
   *     responses:
   *       200:
   *         description: 搜索成功
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TagSearchResponse'
   *             example:
   *               success: true
   *               data:
   *                 tags:
   *                   - id: 1
   *                     name: "javascript"
   *                     display_name: "JavaScript"
   *                     color: "#f39c12"
   *                     usage_count: 250
   *                   - id: 2
   *                     name: "nodejs"
   *                     display_name: "Node.js"
   *                     color: "#68a063"
   *                     usage_count: 150
   *                 query: "js"
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
  static async searchTags(req, res) {
    try {
      const { q: query, limit = 10 } = req.query;

      if (!query || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: '搜索关键词不能为空'
        });
      }

      const tags = await Tag.searchTags(query.trim(), parseInt(limit));

      res.json({
        success: true,
        data: {
          tags,
          query: query.trim()
        }
      });
    } catch (error) {
      logger.error('搜索标签失败:', error);
      res.status(500).json({
        success: false,
        message: '搜索标签失败',
        error: error.message
      });
    }
  }

  /**
   * @swagger
   * /api/tags/popular:
   *   get:
   *     tags: [Tags]
   *     summary: 获取热门标签
   *     description: 根据使用次数获取热门标签列表
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *           maximum: 100
   *         description: 返回数量限制
   *     responses:
   *       200:
   *         description: 获取热门标签成功
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
   *                         $ref: '#/components/schemas/PopularTag'
   *             example:
   *               success: true
   *               data:
   *                 - id: 1
   *                   name: "javascript"
   *                   display_name: "JavaScript"
   *                   color: "#f39c12"
   *                   usage_count: 300
   *                 - id: 2
   *                   name: "python"
   *                   display_name: "Python"
   *                   color: "#3776ab"
   *                   usage_count: 280
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async getPopularTags(req, res) {
    try {
      const { limit = 20 } = req.query;

      const tags = await Tag.getPopularTags(parseInt(limit));

      res.json({
        success: true,
        data: tags
      });
    } catch (error) {
      logger.error('获取热门标签失败:', error);
      res.status(500).json({
        success: false,
        message: '获取热门标签失败',
        error: error.message
      });
    }
  }

  /**
   * @swagger
   * /api/tags/batch:
   *   post:
   *     tags: [Tags]
   *     summary: 批量创建标签
   *     description: 一次性创建多个标签，需要管理员权限
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateTagsRequest'
   *           example:
   *             tags:
   *               - name: "react"
   *                 displayName: "React"
   *                 description: "React 前端框架"
   *                 color: "#61dafb"
   *               - name: "vue"
   *                 displayName: "Vue.js"
   *                 description: "Vue.js 前端框架"
   *                 color: "#4fc08d"
   *     responses:
   *       201:
   *         description: 批量创建成功
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CreateTagsResponse'
   *             example:
   *               success: true
   *               message: "成功创建 2 个标签"
   *               data:
   *                 created:
   *                   - id: 10
   *                     name: "react"
   *                     display_name: "React"
   *                     color: "#61dafb"
   *                   - id: 11
   *                     name: "vue"
   *                     display_name: "Vue.js"
   *                     color: "#4fc08d"
   *                 errors: []
   *       400:
   *         description: 请求数据错误
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "标签数据格式错误"
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         description: 无权创建标签
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "无权创建标签"
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async createTags(req, res) {
    try {
      const { tags } = req.body;

      if (!Array.isArray(tags) || tags.length === 0) {
        return res.status(400).json({
          success: false,
          message: '标签数据格式错误'
        });
      }

      // 检查权限
      const hasPermission = await TagController.hasPermission(req.user.id, 'tag:create');
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: '无权创建标签'
        });
      }

      const results = [];
      const errors = [];

      for (const tagData of tags) {
        try {
          const { name, displayName, description, color } = tagData;
          
          if (!name || !displayName) {
            errors.push({
              tag: tagData,
              error: '标签名称和显示名称为必填字段'
            });
            continue;
          }

          const processedTagData = {
            name: name.toLowerCase().trim(),
            displayName: displayName.trim(),
            description,
            color: color || '#007bff'
          };

          const tag = await Tag.create(processedTagData);
          results.push(tag);
        } catch (error) {
          errors.push({
            tag: tagData,
            error: error.message
          });
        }
      }

      res.status(201).json({
        success: true,
        message: `成功创建 ${results.length} 个标签`,
        data: {
          created: results,
          errors: errors.length > 0 ? errors : undefined
        }
      });
    } catch (error) {
      logger.error('批量创建标签失败:', error);
      res.status(500).json({
        success: false,
        message: '批量创建标签失败',
        error: error.message
      });
    }
  }

  /**
   * 检查用户权限
   */
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
}

module.exports = TagController;
