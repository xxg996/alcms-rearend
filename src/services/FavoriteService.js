/**
 * 收藏业务逻辑服务
 * 处理用户收藏相关的所有业务操作
 */

const BaseService = require('./BaseService');
const Favorite = require('../models/Favorite');
const Resource = require('../models/Resource');
const User = require('../models/User');

class FavoriteService extends BaseService {
  constructor() {
    super();
  }

  /**
   * 添加收藏
   */
  async addFavorite(userId, resourceId, folderName = 'default') {
    return this.withPerformanceMonitoring('addFavorite', async () => {
      try {
        this.validateRequired({ userId, resourceId }, ['userId', 'resourceId']);

        // 检查资源是否存在
        const resource = await Resource.findById(resourceId);
        if (!resource) {
          throw new Error('资源不存在');
        }

        // 检查是否已经收藏
        const existingFavorite = await Favorite.findByUserAndResource(userId, resourceId);
        if (existingFavorite) {
          throw new Error('已经收藏过该资源');
        }

        const newFavorite = await Favorite.create({
          user_id: userId,
          resource_id: resourceId,
          folder_name: folderName,
          created_at: new Date()
        });

        // 增加资源收藏数（异步执行）
        this.incrementResourceFavoriteCount(resourceId).catch(err =>
          this.log('warn', '更新资源收藏数失败', { resourceId, error: err.message })
        );

        // 清除相关缓存
        await this.clearFavoriteCache(userId);

        this.log('info', '添加收藏成功', { 
          userId, 
          resourceId, 
          folderName 
        });

        return this.formatSuccessResponse(newFavorite, '收藏成功');

      } catch (error) {
        this.handleError(error, 'addFavorite');
      }
    });
  }

  /**
   * 移除收藏
   */
  async removeFavorite(userId, resourceId) {
    return this.withPerformanceMonitoring('removeFavorite', async () => {
      try {
        this.validateRequired({ userId, resourceId }, ['userId', 'resourceId']);

        const favorite = await Favorite.findByUserAndResource(userId, resourceId);
        if (!favorite) {
          throw new Error('未收藏该资源');
        }

        await Favorite.deleteById(favorite.id);

        // 减少资源收藏数（异步执行）
        this.decrementResourceFavoriteCount(resourceId).catch(err =>
          this.log('warn', '更新资源收藏数失败', { resourceId, error: err.message })
        );

        // 清除相关缓存
        await this.clearFavoriteCache(userId);

        this.log('info', '移除收藏成功', { userId, resourceId });

        return this.formatSuccessResponse(null, '取消收藏成功');

      } catch (error) {
        this.handleError(error, 'removeFavorite');
      }
    });
  }

  /**
   * 获取用户收藏列表
   */
  async getUserFavorites(userId, filters = {}, pagination = {}) {
    return this.withPerformanceMonitoring('getUserFavorites', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const { page, limit, offset } = this.normalizePaginationParams(
          pagination.page,
          pagination.limit
        );

        const normalizedFilters = {
          ...this.normalizeFavoriteFilters(filters),
          user_id: userId
        };

        const [favorites, totalCount] = await Promise.all([
          Favorite.findByFilters({ ...normalizedFilters, limit, offset }),
          Favorite.countByFilters(normalizedFilters)
        ]);

        // 获取资源详情
        const resourceIds = favorites.map(f => f.resource_id);
        const resources = await Resource.findByIds(resourceIds);
        const resourceMap = resources.reduce((acc, resource) => {
          acc[resource.id] = resource;
          return acc;
        }, {});

        // 组合收藏和资源信息
        const enrichedFavorites = favorites.map(favorite => ({
          ...favorite,
          resource: resourceMap[favorite.resource_id] || null
        }));

        return this.formatPaginatedResponse(
          enrichedFavorites,
          { page, limit },
          totalCount
        );

      } catch (error) {
        this.handleError(error, 'getUserFavorites');
      }
    });
  }

  /**
   * 获取用户收藏夹列表
   */
  async getUserFavoriteFolders(userId) {
    return this.withPerformanceMonitoring('getUserFavoriteFolders', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const cacheKey = `favorite:folders:${userId}`;

        return await this.getCached(cacheKey, async () => {
          const folders = await Favorite.getFoldersByUserId(userId);
          
          return this.formatSuccessResponse(folders, '获取收藏夹成功');
        }, 300);

      } catch (error) {
        this.handleError(error, 'getUserFavoriteFolders');
      }
    });
  }

  /**
   * 创建收藏夹
   */
  async createFavoriteFolder(userId, folderName, description = '') {
    return this.withPerformanceMonitoring('createFavoriteFolder', async () => {
      try {
        this.validateRequired({ userId, folderName }, ['userId', 'folderName']);

        if (folderName.length < 1 || folderName.length > 50) {
          throw new Error('收藏夹名称长度必须在1-50个字符之间');
        }

        // 检查收藏夹是否已存在
        const existingFolder = await Favorite.checkFolderExists(userId, folderName);
        if (existingFolder) {
          throw new Error('收藏夹已存在');
        }

        // 记录收藏夹信息（这里可以创建专门的收藏夹表，目前简化处理）
        this.log('info', '收藏夹创建成功', { 
          userId, 
          folderName, 
          description 
        });

        // 清除相关缓存
        await this.clearFavoriteCache(userId);

        return this.formatSuccessResponse({
          name: folderName,
          description,
          created_at: new Date()
        }, '收藏夹创建成功');

      } catch (error) {
        this.handleError(error, 'createFavoriteFolder');
      }
    });
  }

  /**
   * 移动收藏到指定文件夹
   */
  async moveFavoriteToFolder(userId, resourceId, targetFolder) {
    return this.withPerformanceMonitoring('moveFavoriteToFolder', async () => {
      try {
        this.validateRequired({ userId, resourceId, targetFolder }, 
          ['userId', 'resourceId', 'targetFolder']);

        const favorite = await Favorite.findByUserAndResource(userId, resourceId);
        if (!favorite) {
          throw new Error('收藏记录不存在');
        }

        const updatedFavorite = await Favorite.updateById(favorite.id, {
          folder_name: targetFolder,
          updated_at: new Date()
        });

        // 清除相关缓存
        await this.clearFavoriteCache(userId);

        this.log('info', '收藏移动成功', { 
          userId, 
          resourceId, 
          fromFolder: favorite.folder_name,
          toFolder: targetFolder 
        });

        return this.formatSuccessResponse(updatedFavorite, '移动收藏成功');

      } catch (error) {
        this.handleError(error, 'moveFavoriteToFolder');
      }
    });
  }

  /**
   * 批量操作收藏
   */
  async batchOperateFavorites(userId, operation, resourceIds, targetFolder = null) {
    return this.withPerformanceMonitoring('batchOperateFavorites', async () => {
      try {
        this.validateRequired({ userId, operation }, ['userId', 'operation']);

        if (!Array.isArray(resourceIds) || resourceIds.length === 0) {
          throw new Error('资源ID列表不能为空');
        }

        if (resourceIds.length > 100) {
          throw new Error('一次最多操作100个收藏');
        }

        const results = [];
        const errors = [];

        await this.executeInTransaction(async (client) => {
          for (const resourceId of resourceIds) {
            try {
              switch (operation) {
                case 'delete':
                  await this.batchDeleteFavorite(userId, resourceId, client);
                  results.push({ resourceId, action: 'deleted' });
                  break;
                
                case 'move':
                  if (!targetFolder) {
                    throw new Error('移动操作需要指定目标文件夹');
                  }
                  await this.batchMoveFavorite(userId, resourceId, targetFolder, client);
                  results.push({ resourceId, action: 'moved', targetFolder });
                  break;
                
                default:
                  throw new Error('不支持的操作类型');
              }
            } catch (error) {
              errors.push({ resourceId, error: error.message });
            }
          }
        });

        // 清除相关缓存
        await this.clearFavoriteCache(userId);

        this.log('info', '批量收藏操作完成', { 
          userId, 
          operation,
          total: resourceIds.length,
          success: results.length,
          failed: errors.length
        });

        return this.formatSuccessResponse({
          results,
          errors,
          summary: {
            total: resourceIds.length,
            success: results.length,
            failed: errors.length
          }
        }, '批量操作完成');

      } catch (error) {
        this.handleError(error, 'batchOperateFavorites');
      }
    });
  }

  /**
   * 检查资源是否被收藏
   */
  async checkFavoriteStatus(userId, resourceIds) {
    return this.withPerformanceMonitoring('checkFavoriteStatus', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        if (!Array.isArray(resourceIds)) {
          resourceIds = [resourceIds];
        }

        const favorites = await Favorite.findByUserAndResources(userId, resourceIds);
        const favoriteMap = favorites.reduce((acc, favorite) => {
          acc[favorite.resource_id] = {
            favorited: true,
            folder_name: favorite.folder_name,
            created_at: favorite.created_at
          };
          return acc;
        }, {});

        const status = resourceIds.reduce((acc, resourceId) => {
          acc[resourceId] = favoriteMap[resourceId] || { favorited: false };
          return acc;
        }, {});

        return this.formatSuccessResponse(status, '获取收藏状态成功');

      } catch (error) {
        this.handleError(error, 'checkFavoriteStatus');
      }
    });
  }

  /**
   * 获取收藏统计
   */
  async getFavoriteStats(userId) {
    return this.withPerformanceMonitoring('getFavoriteStats', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const cacheKey = `favorite:stats:${userId}`;

        return await this.getCached(cacheKey, async () => {
          const stats = await Favorite.getUserStats(userId);
          
          return this.formatSuccessResponse(stats, '获取收藏统计成功');
        }, 300);

      } catch (error) {
        this.handleError(error, 'getFavoriteStats');
      }
    });
  }

  /**
   * 获取热门收藏资源
   */
  async getPopularFavorites(limit = 20, timeRange = '7d') {
    return this.withPerformanceMonitoring('getPopularFavorites', async () => {
      try {
        const cacheKey = `favorite:popular:${timeRange}:${limit}`;

        return await this.getCached(cacheKey, async () => {
          const popularResources = await Favorite.getPopularResources(limit, timeRange);
          
          return this.formatSuccessResponse(popularResources, '获取热门收藏成功');
        }, 600);

      } catch (error) {
        this.handleError(error, 'getPopularFavorites');
      }
    });
  }

  /**
   * 批量删除收藏
   */
  async batchDeleteFavorite(userId, resourceId, client) {
    const favorite = await Favorite.findByUserAndResource(userId, resourceId);
    if (favorite) {
      await Favorite.deleteById(favorite.id, client);
      // 减少资源收藏数
      await Resource.decrementFavoriteCount(resourceId, client);
    }
  }

  /**
   * 批量移动收藏
   */
  async batchMoveFavorite(userId, resourceId, targetFolder, client) {
    const favorite = await Favorite.findByUserAndResource(userId, resourceId);
    if (favorite) {
      await Favorite.updateById(favorite.id, {
        folder_name: targetFolder,
        updated_at: new Date()
      }, client);
    }
  }

  /**
   * 增加资源收藏数
   */
  async incrementResourceFavoriteCount(resourceId) {
    try {
      await Resource.incrementFavoriteCount(resourceId);
    } catch (error) {
      this.log('error', '增加资源收藏数失败', { resourceId, error: error.message });
    }
  }

  /**
   * 减少资源收藏数
   */
  async decrementResourceFavoriteCount(resourceId) {
    try {
      await Resource.decrementFavoriteCount(resourceId);
    } catch (error) {
      this.log('error', '减少资源收藏数失败', { resourceId, error: error.message });
    }
  }

  /**
   * 标准化收藏过滤参数
   */
  normalizeFavoriteFilters(filters) {
    const {
      folder_name,
      start_date,
      end_date,
      resource_type,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = filters;

    return {
      folder_name,
      start_date,
      end_date,
      resource_type,
      sort_by,
      sort_order
    };
  }

  /**
   * 清除收藏相关缓存
   */
  async clearFavoriteCache(userId) {
    await Promise.all([
      this.clearCache(`favorite:folders:${userId}`),
      this.clearCache(`favorite:stats:${userId}`),
      this.clearCache('favorite:popular:*')
    ]);
  }
}

module.exports = new FavoriteService();