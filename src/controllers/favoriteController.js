/**
 * 资源收藏控制器
 * 处理用户收藏资源相关的HTTP请求
 */

const Favorite = require('../models/Favorite');
const Resource = require('../models/Resource');

/**
 * 切换收藏状态（收藏/取消收藏）
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
    console.error('切换收藏状态失败:', error);
    res.status(500).json({
      success: false,
      message: '操作失败'
    });
  }
};

/**
 * 检查资源收藏状态
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
    console.error('检查收藏状态失败:', error);
    res.status(500).json({
      success: false,
      message: '检查收藏状态失败'
    });
  }
};

/**
 * 批量检查收藏状态
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
    console.error('批量检查收藏状态失败:', error);
    res.status(500).json({
      success: false,
      message: '批量检查收藏状态失败'
    });
  }
};

/**
 * 获取用户收藏的资源列表
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
    console.error('获取用户收藏列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取收藏列表失败'
    });
  }
};

/**
 * 获取用户收藏统计信息
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
    console.error('获取用户收藏统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取收藏统计失败'
    });
  }
};

/**
 * 获取资源收藏统计信息
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
    console.error('获取资源收藏统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取资源收藏统计失败'
    });
  }
};

/**
 * 获取热门收藏资源（管理员功能）
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
    console.error('获取热门收藏资源失败:', error);
    res.status(500).json({
      success: false,
      message: '获取热门收藏资源失败'
    });
  }
};

/**
 * 批量取消收藏
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
    console.error('批量取消收藏失败:', error);
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