/**
 * 分类管理控制器
 * 处理分类相关的HTTP请求
 * 
 * @swagger
 * tags:
 *   - name: 分类管理相关
 *     description: 分类管理相关api
 */

const Category = require('../models/Category');
const CategoryService = require('../services/CategoryService');
const { logger } = require('../utils/logger');

class CategoryController {
  /**
   * @swagger
   * /api/categories:
   *   get:
   *     tags: [分类管理相关]
   *     summary: 获取分类列表
   *     description: 获取分类列表，支持树形结构或扁平列表，可以过滤活跃状态
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: tree
   *         schema:
   *           type: string
   *           enum: ['true', 'false']
   *           default: 'true'
   *         description: 是否返回树形结构
   *       - in: query
   *         name: includeInactive
   *         schema:
   *           type: string
   *           enum: ['true', 'false']
   *           default: 'false'
   *         description: 是否包含未激活的分类
   *       - in: query
   *         name: includeChildren
   *         schema:
   *           type: string
   *           enum: ['true', 'false']
   *           default: 'true'
   *         description: 是否在响应中包含子分类（树形结构时可用于减少数据量）
   *       - in: query
   *         name: parentId
   *         schema:
   *           type: string
   *         description: 父分类ID，'null'表示获取顶级分类
   *     responses:
   *       200:
   *         description: 获取分类列表成功
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CategoryListResponse'
   *             example:
   *               success: true
   *               data:
   *                 - id: 1
   *                   name: "technology"
   *                   display_name: "科技"
   *                   description: "科技相关内容"
   *                   parent_id: null
   *                   sort_order: 0
   *                   is_active: true
   *                   resource_count: 25
   *                   children:
   *                     - id: 2
   *                       name: "web-dev"
   *                       display_name: "Web开发"
   *                       parent_id: 1
   *                       resource_count: 12
   *                       children: []
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async getCategories(req, res) {
    try {
      const {
        tree = 'true',
        includeInactive = 'false',
        parentId,
        includeChildren = 'true'
      } = req.query;

      const shouldIncludeChildren = includeChildren !== 'false';

      let categories;
      
      if (tree === 'true' && parentId === undefined) {
        // 通过服务层获取树形结构（带缓存）
        const result = await CategoryService.getCategoryTree({ includeInactive: includeInactive === 'true' });
        categories = result.data;
      } else {
        // 返回扁平列表（服务层封装）
        const filters = {
          includeInactive: includeInactive === 'true',
          parent_id: parentId === 'null' ? null : (parentId ? parseInt(parentId) : undefined)
        };
        const result = await CategoryService.getCategoryList(filters);
        categories = result.data;
      }

      const normalizedCategories = Array.isArray(categories) ? categories : [];
      const data = shouldIncludeChildren
        ? CategoryController.cloneCategories(normalizedCategories)
        : CategoryController.removeChildren(normalizedCategories);

      res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error('获取分类列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取分类列表失败',
        error: error.message
      });
    }
  }

  /**
   * 深拷贝分类树，避免修改缓存源数据
   */
  static cloneCategories(categories) {
    if (!Array.isArray(categories)) {
      return categories;
    }

    return categories.map(category => {
      if (!category || typeof category !== 'object') {
        return category;
      }

      const cloned = { ...category };
      if (Array.isArray(category.children)) {
        cloned.children = CategoryController.cloneCategories(category.children);
      }
      return cloned;
    });
  }

  /**
   * 去除子分类字段，仅保留当前层级数据
   */
  static removeChildren(categories) {
    if (!Array.isArray(categories)) {
      return categories;
    }

    return categories.map(category => {
      if (!category || typeof category !== 'object') {
        return category;
      }

      const { children, ...rest } = category;
      return rest;
    });
  }

  /**
   * @swagger
   * /api/categories/{id}:
   *   get:
   *     tags: [分类管理相关]
   *     summary: 获取单个分类详情
   *     description: 根据分类ID获取分类的详细信息，包括分类路径（面包屑）
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 分类ID
   *     responses:
   *       200:
   *         description: 获取分类详情成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/Category'
   *             example:
   *               success: true
   *               data:
   *                 id: 2
   *                 name: "web-dev"
   *                 display_name: "Web开发"
   *                 description: "Web开发相关教程"
   *                 parent_id: 1
   *                 sort_order: 10
   *                 is_active: true
   *                 resource_count: 15
   *                 path:
   *                   - id: 1
   *                     name: "technology"
   *                     display_name: "科技"
   *                   - id: 2
   *                     name: "web-dev"
   *                     display_name: "Web开发"
   *       404:
   *         description: 分类不存在
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "分类不存在"
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async getCategory(req, res) {
    try {
      const { id } = req.params;
      const result = await CategoryService.getCategoryById(parseInt(id));

      if (!result || !result.data) {
        return res.status(404).json({ success: false, message: '分类不存在' });
      }

      res.json({ success: true, data: result.data });
    } catch (error) {
      logger.error('获取分类详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取分类详情失败',
        error: error.message
      });
    }
  }

  /**
   * @swagger
   * /api/categories:
   *   post:
   *     tags: [分类管理相关]
   *     summary: 创建新分类
   *     description: 创建一个新的分类，需要管理员权限。层级限制：分类最多支持3级（根=1，子=2，孙=3），当 parentId 指向的父级已处于第3级或更深，将返回 400 错误。
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateCategoryRequest'
   *           example:
   *             name: "web-development"
   *             displayName: "Web开发"
   *             description: "Web开发相关的教程和资源"
   *             parentId: 1
   *             sortOrder: 10
   *             iconUrl: "https://example.com/icons/web.svg"
   *     responses:
   *       201:
   *         description: 分类创建成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/Category'
   *                     message:
   *                       type: string
   *                       example: "分类创建成功"
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
   *                   message: "分类名称和显示名称为必填字段"
   *               duplicate_name:
   *                 value:
   *                   success: false
   *                   message: "分类名称已存在"
   *               depth_limit:
   *                 value:
   *                   success: false
   *                   message: "分类层级不能超过3级"
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         description: 无权创建分类
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "无权创建分类"
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async createCategory(req, res) {
    try {
      const { name, displayName, description, parentId, sortOrder, iconUrl } = req.body;

      // 验证必填字段
      if (!name || !displayName) {
        return res.status(400).json({
          success: false,
          message: '分类名称和显示名称为必填字段'
        });
      }

      // 检查权限
      const hasPermission = await CategoryController.hasPermission(req.user.id, 'category:create');
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: '无权创建分类'
        });
      }

      const categoryData = {
        name: name.toLowerCase().trim(),
        displayName: displayName.trim(),
        description,
        parentId: parentId ? parseInt(parentId) : null,
        sortOrder: sortOrder ? parseInt(sortOrder) : 0,
        iconUrl
      };

      const result = await CategoryService.createCategory(categoryData, req.user.id);

      res.status(201).json({
        success: true,
        message: '分类创建成功',
        data: result.data
      });
    } catch (error) {
      logger.error('创建分类失败:', error);
      
      if (error.message === '分类名称已存在' || error.message.includes('分类层级不能超过')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: '创建分类失败',
        error: error.message
      });
    }
  }

  /**
   * @swagger
   * /api/categories/{id}:
   *   put:
   *     tags: [分类管理相关]
   *     summary: 更新分类
   *     description: 更新指定ID的分类，需要管理员权限。层级限制：当变更 parentId 导致层级超过3级，或形成循环引用，将返回 400 错误。
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 分类ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateCategoryRequest'
   *           example:
   *             displayName: "更新的分类"
   *             description: "更新的分类描述"
   *             parentId: 2
   *             sortOrder: 20
   *             isActive: true
   *     responses:
   *       200:
   *         description: 分类更新成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/Category'
   *                     message:
   *                       type: string
   *                       example: "分类更新成功"
   *       400:
   *         description: 请求参数错误
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "不能将分类设置为自己的子分类"
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         description: 无权更新分类
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "无权更新分类"
   *       404:
   *         description: 分类不存在
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "分类不存在"
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async updateCategory(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // 检查权限
      const hasPermission = await CategoryController.hasPermission(req.user.id, 'category:update');
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: '无权更新分类'
        });
      }

      // 通过服务层更新（内含循环检测与3级限制）
      const result = await CategoryService.updateCategory(parseInt(id), updateData, req.user.id);

      res.json({ success: true, message: '分类更新成功', data: result.data });
    } catch (error) {
      logger.error('更新分类失败:', error);
      
      if (error.message.includes('循环引用') || error.message.includes('不能将分类设置为') || error.message.includes('分类层级不能超过')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: '更新分类失败',
        error: error.message
      });
    }
  }

  /**
   * @swagger
   * /api/categories/{id}:
   *   delete:
   *     tags: [分类管理相关]
   *     summary: 删除分类
   *     description: 删除指定ID的分类，需要管理员权限。不能删除有子分类或关联资源的分类。说明：数据库外键为 ON DELETE CASCADE，但应用层会在存在子分类时阻止删除，避免级联删除。
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 分类ID
   *     responses:
   *       200:
   *         description: 分类删除成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     message:
   *                       type: string
   *                       example: "分类删除成功"
   *       400:
   *         description: 删除受限
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             examples:
   *               has_children:
   *                 value:
   *                   success: false
   *                   message: "不能删除有子分类的分类"
   *               has_resources:
   *                 value:
   *                   success: false
   *                   message: "不能删除有关联资源的分类"
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         description: 无权删除分类
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "无权删除分类"
   *       404:
   *         description: 分类不存在
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "分类不存在"
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async deleteCategory(req, res) {
    try {
      const { id } = req.params;

      // 检查权限
      const hasPermission = await CategoryController.hasPermission(req.user.id, 'category:delete');
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: '无权删除分类'
        });
      }

      const existing = await Category.findById(parseInt(id));
      if (!existing) {
        return res.status(404).json({ success: false, message: '分类不存在' });
      }

      const result = await CategoryService.deleteCategory(parseInt(id), req.user.id);

      res.json({
        success: true,
        message: '分类删除成功'
      });
    } catch (error) {
      logger.error('删除分类失败:', error);
      
      if (error.message.includes('子分类') || error.message.includes('关联资源')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: '删除分类失败',
        error: error.message
      });
    }
  }

  /**
   * @swagger
   * /api/categories/popular:
   *   get:
   *     tags: [分类管理相关]
   *     summary: 获取热门分类
   *     description: 根据资源数量获取热门分类列表
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *           maximum: 50
   *         description: 返回数量限制
   *     responses:
   *       200:
   *         description: 获取热门分类成功
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
   *                         $ref: '#/components/schemas/PopularCategory'
   *             example:
   *               success: true
   *               data:
   *                 - id: 1
   *                   name: "technology"
   *                   display_name: "科技"
   *                   resource_count: 150
   *                   icon_url: "https://example.com/icons/tech.svg"
   *                 - id: 2
   *                   name: "education"
   *                   display_name: "教育"
   *                   resource_count: 120
   *                   icon_url: "https://example.com/icons/edu.svg"
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async getPopularCategories(req, res) {
    try {
      const { limit = 10 } = req.query;

      const categories = await Category.getPopularCategories(parseInt(limit));

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      logger.error('获取热门分类失败:', error);
      res.status(500).json({
        success: false,
        message: '获取热门分类失败',
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

module.exports = CategoryController;
