/**
 * @fileoverview 资源收藏控制器
 * @description 处理用户收藏资源相关的HTTP请求，包括收藏/取消收藏、查看收藏列表、收藏统计等
 * @module favoriteController
 * @requires ../models/Favorite
 * @requires ../models/Resource
 * @requires ../utils/logger
 * @author AI Assistant
 * @version 1.0.0
 */

const Favorite = require('../models/Favorite');
const Resource = require('../models/Resource');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/favorites/resources/{resourceId}/toggle:
 *   post:
 *     tags: [收藏系统]
 *     summary: 切换收藏状态
 *     description: 切换指定资源的收藏状态，如果未收藏则收藏，如果已收藏则取消收藏
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: resourceId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: 资源ID
 *         example: 123
 *     responses:
 *       200:
 *         description: 切换收藏状态成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FavoriteToggleResponse'
 *             examples:
 *               favorited:
 *                 summary: 收藏成功
 *                 value:
 *                   success: true
 *                   message: "收藏成功"
 *                   data:
 *                     is_favorited: true
 *                     resource_id: 123
 *                     favorited_at: "2025-09-12T10:30:00.000Z"
 *                     action: "favorited"
 *               unfavorited:
 *                 summary: 取消收藏成功
 *                 value:
 *                   success: true
 *                   message: "取消收藏成功"
 *                   data:
 *                     is_favorited: false
 *                     resource_id: 123
 *                     action: "unfavorited"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "无效的资源ID"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: 资源不可收藏
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "该资源不可收藏"
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
const toggleFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    const { resourceId } = req.params;

    // 验证资源ID
    if (!resourceId || isNaN(resourceId)) {
      return res.status(400).json({
        success: false,
        message: '无效的资源ID'
      });
    }

    // 检查资源是否存在且可访问
    const resource = await Resource.findById(parseInt(resourceId));
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: '资源不存在'
      });
    }

    if (resource.status !== 'published' || !resource.is_public) {
      return res.status(403).json({
        success: false,
        message: '该资源不可收藏'
      });
    }

    // 检查当前收藏状态
    const currentStatus = await Favorite.checkFavoriteStatus(userId, parseInt(resourceId));
    
    if (currentStatus) {
      // 取消收藏
      await Favorite.removeFavorite(userId, parseInt(resourceId));
      
      res.json({
        success: true,
        message: '取消收藏成功',
        data: {
          is_favorited: false,
          resource_id: parseInt(resourceId),
          action: 'unfavorited'
        }
      });
    } else {
      // 添加收藏
      const favoriteRecord = await Favorite.addFavorite(userId, parseInt(resourceId));
      
      res.json({
        success: true,
        message: '收藏成功',
        data: {
          is_favorited: true,
          resource_id: parseInt(resourceId),
          favorited_at: favoriteRecord.created_at,
          action: 'favorited'
        }
      });
    }
  } catch (error) {
    logger.error('切换收藏状态失败:', error);
    res.status(500).json({
      success: false,
      message: '操作失败'
    });
  }
};

/**
 * @swagger
 * /api/favorites/resources/{resourceId}/status:
 *   get:
 *     tags: [收藏系统]
 *     summary: 检查资源收藏状态
 *     description: 检查当前用户是否收藏了指定资源
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: resourceId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: 资源ID
 *         example: 123
 *     responses:
 *       200:
 *         description: 检查收藏状态成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/FavoriteStatus'
 *             examples:
 *               favorited:
 *                 summary: 已收藏
 *                 value:
 *                   success: true
 *                   data:
 *                     is_favorited: true
 *                     resource_id: 123
 *                     favorited_at: "2025-09-12T10:30:00.000Z"
 *               not_favorited:
 *                 summary: 未收藏
 *                 value:
 *                   success: true
 *                   data:
 *                     is_favorited: false
 *                     resource_id: 123
 *                     favorited_at: null
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "无效的资源ID"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const checkFavoriteStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { resourceId } = req.params;

    // 验证资源ID
    if (!resourceId || isNaN(resourceId)) {
      return res.status(400).json({
        success: false,
        message: '无效的资源ID'
      });
    }

    const favoriteRecord = await Favorite.checkFavoriteStatus(userId, parseInt(resourceId));
    
    res.json({
      success: true,
      data: {
        is_favorited: !!favoriteRecord,
        resource_id: parseInt(resourceId),
        favorited_at: favoriteRecord ? favoriteRecord.created_at : null
      }
    });
  } catch (error) {
    logger.error('检查收藏状态失败:', error);
    res.status(500).json({
      success: false,
      message: '检查收藏状态失败'
    });
  }
};

/**
 * @swagger
 * /api/favorites/resources/batch-check:
 *   post:
 *     tags: [收藏系统]
 *     summary: 批量检查收藏状态
 *     description: 批量检查多个资源的收藏状态，单次最多检查100个资源
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BatchCheckFavoriteStatusRequest'
 *           example:
 *             resource_ids: [123, 456, 789]
 *     responses:
 *       200:
 *         description: 批量检查收藏状态成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BatchFavoriteStatusResponse'
 *             example:
 *               success: true
 *               data:
 *                 "123":
 *                   is_favorited: true
 *                   favorited_at: "2025-09-12T10:30:00.000Z"
 *                 "456":
 *                   is_favorited: false
 *                   favorited_at: null
 *                 "789":
 *                   is_favorited: true
 *                   favorited_at: "2025-09-11T15:20:00.000Z"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               empty_list:
 *                 summary: 资源列表为空
 *                 value:
 *                   success: false
 *                   message: "资源ID列表不能为空"
 *               too_many:
 *                 summary: 资源数量超限
 *                 value:
 *                   success: false
 *                   message: "单次最多检查100个资源的收藏状态"
 *               invalid_ids:
 *                 summary: 无效的资源ID
 *                 value:
 *                   success: false
 *                   message: "没有有效的资源ID"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const batchCheckFavoriteStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { resource_ids } = req.body;

    // 验证资源ID数组
    if (!Array.isArray(resource_ids) || resource_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '资源ID列表不能为空'
      });
    }

    if (resource_ids.length > 100) {
      return res.status(400).json({
        success: false,
        message: '单次最多检查100个资源的收藏状态'
      });
    }

    // 验证所有ID都是数字
    const validIds = resource_ids.filter(id => !isNaN(id)).map(id => parseInt(id));
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有有效的资源ID'
      });
    }

    const favoriteMap = await Favorite.batchCheckFavoriteStatus(userId, validIds);
    
    res.json({
      success: true,
      data: favoriteMap
    });
  } catch (error) {
    logger.error('批量检查收藏状态失败:', error);
    res.status(500).json({
      success: false,
      message: '批量检查收藏状态失败'
    });
  }
};

/**
 * @swagger
 * /api/favorites/my-favorites:
 *   get:
 *     tags: [收藏系统]
 *     summary: 获取用户收藏列表
 *     description: 分页获取当前用户的收藏资源列表，支持按分类、类型和关键词筛选
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: 页码
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: 每页数量
 *         example: 20
 *       - in: query
 *         name: category
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: 分类ID筛选
 *         example: 1
 *       - in: query
 *         name: type
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: 资源类型ID筛选
 *         example: 2
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 100
 *         description: 搜索关键词
 *         example: "UI设计"
 *     responses:
 *       200:
 *         description: 获取收藏列表成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserFavoritesList'
 *             example:
 *               success: true
 *               message: "获取收藏列表成功"
 *               data:
 *                 favorites:
 *                   - id: 1001
 *                     user_id: 1
 *                     resource_id: 123
 *                     created_at: "2025-09-12T10:30:00.000Z"
 *                     resource:
 *                       id: 123
 *                       title: "精美UI设计素材"
 *                       description: "高质量的UI设计素材包"
 *                       thumbnail: "https://example.com/thumbnail.jpg"
 *                       category_name: "UI设计"
 *                       type_name: "PSD文件"
 *                       download_count: 150
 *                       favorite_count: 25
 *                       file_size: 15728640
 *                       status: "published"
 *                 pagination:
 *                   current_page: 1
 *                   per_page: 20
 *                   total: 100
 *                   total_pages: 5
 *                   has_next: true
 *                   has_prev: false
 *                 filters:
 *                   category: null
 *                   type: null
 *                   search: null
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getUserFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      category,
      type,
      search
    } = req.query;

    // 验证分页参数
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(Math.max(1, parseInt(limit)), 50);

    const options = {
      page: pageNum,
      limit: limitNum,
      categoryId: category ? parseInt(category) : null,
      resourceTypeId: type ? parseInt(type) : null,
      search: search ? search.trim() : null
    };

    const result = await Favorite.getUserFavorites(userId, options);
    
    res.json({
      success: true,
      message: '获取收藏列表成功',
      data: result
    });
  } catch (error) {
    logger.error('获取用户收藏列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取收藏列表失败'
    });
  }
};

/**
 * @swagger
 * /api/favorites/my-stats:
 *   get:
 *     tags: [收藏系统]
 *     summary: 获取用户收藏统计
 *     description: 获取当前用户的收藏统计信息，包括总数、分类统计、最近收藏等
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 获取收藏统计成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserFavoriteStats'
 *             example:
 *               success: true
 *               message: "获取收藏统计成功"
 *               data:
 *                 total_count: 25
 *                 this_month_count: 5
 *                 by_category:
 *                   "UI设计": 10
 *                   "图标素材": 8
 *                   "字体文件": 7
 *                 by_type:
 *                   "PSD文件": 12
 *                   "AI文件": 8
 *                   "字体": 5
 *                 recent_favorites:
 *                   - resource_id: 123
 *                     title: "精美UI设计素材"
 *                     favorited_at: "2025-09-12T10:30:00.000Z"
 *                   - resource_id: 456
 *                     title: "字体包集合"
 *                     favorited_at: "2025-09-11T15:20:00.000Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getUserFavoriteStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await Favorite.getUserFavoriteStats(userId);
    
    res.json({
      success: true,
      message: '获取收藏统计成功',
      data: stats
    });
  } catch (error) {
    logger.error('获取用户收藏统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取收藏统计失败'
    });
  }
};

/**
 * @swagger
 * /api/favorites/resources/{resourceId}/stats:
 *   get:
 *     tags: [收藏系统]
 *     summary: 获取资源收藏统计
 *     description: 获取指定资源的收藏统计信息，包括收藏总数、趋势等
 *     parameters:
 *       - in: path
 *         name: resourceId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: 资源ID
 *         example: 123
 *     responses:
 *       200:
 *         description: 获取资源收藏统计成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ResourceFavoriteStats'
 *             example:
 *               success: true
 *               message: "获取资源收藏统计成功"
 *               data:
 *                 resource_id: 123
 *                 resource_title: "精美UI设计素材"
 *                 total_favorites: 150
 *                 today_favorites: 5
 *                 this_week_favorites: 25
 *                 this_month_favorites: 80
 *                 favorite_trend:
 *                   - date: "2025-09-12"
 *                     count: 5
 *                   - date: "2025-09-11"
 *                     count: 3
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "无效的资源ID"
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
const getResourceFavoriteStats = async (req, res) => {
  try {
    const { resourceId } = req.params;

    // 验证资源ID
    if (!resourceId || isNaN(resourceId)) {
      return res.status(400).json({
        success: false,
        message: '无效的资源ID'
      });
    }

    // 检查资源是否存在
    const resource = await Resource.findById(parseInt(resourceId));
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: '资源不存在'
      });
    }

    const stats = await Favorite.getResourceFavoriteStats(parseInt(resourceId));
    
    res.json({
      success: true,
      message: '获取资源收藏统计成功',
      data: {
        resource_id: parseInt(resourceId),
        resource_title: resource.title,
        ...stats
      }
    });
  } catch (error) {
    logger.error('获取资源收藏统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取资源收藏统计失败'
    });
  }
};

/**
 * @swagger
 * /api/favorites/admin/popular:
 *   get:
 *     tags: [收藏管理]
 *     summary: 获取热门收藏资源
 *     description: 管理员功能，获取指定时间段内的热门收藏资源列表
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 返回的资源数量
 *         example: 20
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *         description: 统计时间段（天数）
 *         example: 30
 *     responses:
 *       200:
 *         description: 获取热门收藏资源成功
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
 *                         period_days:
 *                           type: integer
 *                           description: 统计时间段
 *                         resources:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/PopularFavorite'
 *             example:
 *               success: true
 *               message: "获取热门收藏资源成功"
 *               data:
 *                 period_days: 30
 *                 resources:
 *                   - resource_id: 123
 *                     title: "精美UI设计素材"
 *                     description: "高质量的UI设计素材包"
 *                     thumbnail: "https://example.com/thumbnail.jpg"
 *                     category_name: "UI设计"
 *                     type_name: "PSD文件"
 *                     favorite_count: 150
 *                     period_favorites: 80
 *                     growth_rate: 53.3
 *                   - resource_id: 456
 *                     title: "字体包集合"
 *                     description: "多款精美中文字体包"
 *                     category_name: "字体文件"
 *                     type_name: "字体"
 *                     favorite_count: 120
 *                     period_favorites: 65
 *                     growth_rate: 54.2
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getPopularFavorites = async (req, res) => {
  try {
    const { 
      limit = 20, 
      days = 30 
    } = req.query;

    const limitNum = Math.min(Math.max(1, parseInt(limit)), 100);
    const daysNum = Math.min(Math.max(1, parseInt(days)), 365);

    const options = {
      limit: limitNum,
      days: daysNum
    };

    const popularResources = await Favorite.getPopularFavorites(options);
    
    res.json({
      success: true,
      message: '获取热门收藏资源成功',
      data: {
        period_days: daysNum,
        resources: popularResources
      }
    });
  } catch (error) {
    logger.error('获取热门收藏资源失败:', error);
    res.status(500).json({
      success: false,
      message: '获取热门收藏资源失败'
    });
  }
};

/**
 * @swagger
 * /api/favorites/batch-remove:
 *   post:
 *     tags: [收藏系统]
 *     summary: 批量取消收藏
 *     description: 批量取消多个资源的收藏，单次最多取消50个资源
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BatchRemoveFavoritesRequest'
 *           example:
 *             resource_ids: [123, 456, 789]
 *     responses:
 *       200:
 *         description: 批量取消收藏完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BatchRemoveFavoritesResponse'
 *             example:
 *               success: true
 *               message: "批量取消收藏完成，成功2个，失葥1个"
 *               data:
 *                 results:
 *                   - resource_id: 123
 *                     success: true
 *                     action: "unfavorited"
 *                   - resource_id: 456
 *                     success: true
 *                     action: "unfavorited"
 *                   - resource_id: 789
 *                     success: false
 *                     message: "该资源未收藏"
 *                 errors: undefined
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               empty_list:
 *                 summary: 资源列表为空
 *                 value:
 *                   success: false
 *                   message: "资源ID列表不能为空"
 *               too_many:
 *                 summary: 资源数量超限
 *                 value:
 *                   success: false
 *                   message: "单次最多取消收藏50个资源"
 *               invalid_ids:
 *                 summary: 无效的资源ID
 *                 value:
 *                   success: false
 *                   message: "没有有效的资源ID"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const batchRemoveFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    const { resource_ids } = req.body;

    // 验证资源ID数组
    if (!Array.isArray(resource_ids) || resource_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '资源ID列表不能为空'
      });
    }

    if (resource_ids.length > 50) {
      return res.status(400).json({
        success: false,
        message: '单次最多取消收藏50个资源'
      });
    }

    // 验证所有ID都是数字
    const validIds = resource_ids.filter(id => !isNaN(id)).map(id => parseInt(id));
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有有效的资源ID'
      });
    }

    const results = [];
    const errors = [];

    for (const resourceId of validIds) {
      try {
        const removedRecord = await Favorite.removeFavorite(userId, resourceId);
        if (removedRecord) {
          results.push({
            resource_id: resourceId,
            success: true,
            action: 'unfavorited'
          });
        } else {
          results.push({
            resource_id: resourceId,
            success: false,
            message: '该资源未收藏'
          });
        }
      } catch (error) {
        errors.push({
          resource_id: resourceId,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `批量取消收藏完成，成功${results.filter(r => r.success).length}个，失败${errors.length}个`,
      data: {
        results,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    logger.error('批量取消收藏失败:', error);
    res.status(500).json({
      success: false,
      message: '批量取消收藏失败'
    });
  }
};

module.exports = {
  toggleFavorite,
  checkFavoriteStatus,
  batchCheckFavoriteStatus,
  getUserFavorites,
  getUserFavoriteStats,
  getResourceFavoriteStats,
  getPopularFavorites,
  batchRemoveFavorites
};