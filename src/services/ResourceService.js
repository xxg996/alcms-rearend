/**
 * 资源业务逻辑服务
 * 处理资源管理相关的所有业务操作
 */

const BaseService = require('./BaseService');
const Resource = require('../models/Resource');
const Category = require('../models/Category');
const Tag = require('../models/Tag');
const { generateSecureResourceInfo } = require('../utils/downloadUtils');
const { generateSecureResourceInfoBatch } = require('../utils/downloadUtilsBatch');

class ResourceService extends BaseService {
  constructor() {
    super();
  }

  /**
   * 获取资源列表
   */
  async getResourceList(filters = {}, pagination = {}, user = null) {
    return this.withPerformanceMonitoring('getResourceList', async () => {
      try {
        const { page, limit, offset } = this.normalizePaginationParams(
          pagination.page,
          pagination.limit
        );

        // 标准化过滤参数
        const normalizedFilters = this.normalizeResourceFilters(filters);
        
        // 生成缓存键
        const cacheKey = this.generateResourceListCacheKey(
          normalizedFilters, page, limit, user
        );

        return await this.getCached(cacheKey, async () => {
          // 获取资源列表和总数
          const [resources, totalCount] = await Promise.all([
            Resource.findByFilters({ ...normalizedFilters, limit, offset }),
            Resource.countByFilters(normalizedFilters)
          ]);

          // 批量获取标签信息
          const resourceIds = resources.map(r => r.id);
          let resourceTags = {};
          
          if (resourceIds.length > 0) {
            const tags = await Tag.findByResourceIds(resourceIds);
            resourceTags = tags.reduce((acc, tag) => {
              if (!acc[tag.resource_id]) acc[tag.resource_id] = [];
              acc[tag.resource_id].push({
                id: tag.id,
                name: tag.name,
                display_name: tag.display_name,
                color: tag.color
              });
              return acc;
            }, {});
          }

          // 处理下载信息
          const resourcesWithDownloadInfo = await this.attachDownloadInfo(
            resources, user
          );

          // 组合资源和标签信息
          const enrichedResources = resourcesWithDownloadInfo.map(resource => ({
            ...resource,
            tags: resourceTags[resource.id] || []
          }));

          return this.formatPaginatedResponse(
            enrichedResources,
            { page, limit },
            totalCount
          );
        }, 900); // 缓存15分钟

      } catch (error) {
        this.handleError(error, 'getResourceList');
      }
    });
  }

  /**
   * 获取单个资源详情
   */
  async getResourceById(resourceId, user = null) {
    return this.withPerformanceMonitoring('getResourceById', async () => {
      try {
        this.validateRequired({ resourceId }, ['resourceId']);

        const resource = await Resource.findById(resourceId);
        if (!resource) {
          throw new Error('资源不存在');
        }

        // 获取资源标签
        const tags = await Tag.findByResourceIds([resourceId]);
        const resourceTags = tags.map(tag => ({
          id: tag.id,
          name: tag.name,
          display_name: tag.display_name,
          color: tag.color
        }));

        // 处理下载信息
        const [resourceWithDownloadInfo] = await this.attachDownloadInfo(
          [resource], user
        );

        const enrichedResource = {
          ...resourceWithDownloadInfo,
          tags: resourceTags
        };

        // 增加浏览次数（异步执行，不影响响应）
        this.incrementViewCount(resourceId).catch(err => 
          this.log('warn', '更新浏览次数失败', { resourceId, error: err.message })
        );

        return this.formatSuccessResponse(
          enrichedResource,
          '获取资源详情成功'
        );

      } catch (error) {
        this.handleError(error, 'getResourceById');
      }
    });
  }

  /**
   * 创建资源
   */
  async createResource(resourceData, authorId) {
    return this.withPerformanceMonitoring('createResource', async () => {
      try {
        this.validateRequired({ authorId }, ['authorId']);
        this.validateRequired(resourceData, ['title', 'description']);

        // 验证资源数据
        const validatedData = await this.validateResourceData(resourceData);

        const newResource = await this.executeInTransaction(async (client) => {
          // 创建资源
          const resource = await Resource.create({
            ...validatedData,
            author_id: authorId,
            created_at: new Date(),
            updated_at: new Date()
          });

          // 处理标签关联
          if (resourceData.tags && resourceData.tags.length > 0) {
            await this.associateResourceTags(resource.id, resourceData.tags, client);
          }

          return resource;
        });

        // 清除相关缓存
        await this.clearResourceListCache();

        this.log('info', '资源创建成功', { 
          resourceId: newResource.id, 
          authorId 
        });

        return this.formatSuccessResponse(
          newResource,
          '资源创建成功'
        );

      } catch (error) {
        this.handleError(error, 'createResource');
      }
    });
  }

  /**
   * 更新资源
   */
  async updateResource(resourceId, updateData, userId) {
    return this.withPerformanceMonitoring('updateResource', async () => {
      try {
        this.validateRequired({ resourceId, userId }, ['resourceId', 'userId']);

        // 检查资源存在性和权限
        const existingResource = await Resource.findById(resourceId);
        if (!existingResource) {
          throw new Error('资源不存在');
        }

        // 验证权限（只有作者或管理员可以修改）
        const user = await this.getUserById(userId);
        if (existingResource.author_id !== userId && user.role !== 'admin') {
          throw new Error('没有权限修改此资源');
        }

        // 验证更新数据
        const validatedData = await this.validateResourceData(updateData, false);

        const updatedResource = await this.executeInTransaction(async (client) => {
          // 更新资源
          const resource = await Resource.updateById(resourceId, {
            ...validatedData,
            updated_at: new Date()
          });

          // 处理标签更新
          if (updateData.tags !== undefined) {
            await this.updateResourceTags(resourceId, updateData.tags, client);
          }

          return resource;
        });

        // 清除相关缓存
        await this.clearResourceCache(resourceId);

        this.log('info', '资源更新成功', { resourceId, userId });

        return this.formatSuccessResponse(
          updatedResource,
          '资源更新成功'
        );

      } catch (error) {
        this.handleError(error, 'updateResource');
      }
    });
  }

  /**
   * 删除资源
   */
  async deleteResource(resourceId, userId) {
    return this.withPerformanceMonitoring('deleteResource', async () => {
      try {
        this.validateRequired({ resourceId, userId }, ['resourceId', 'userId']);

        // 检查资源存在性和权限
        const existingResource = await Resource.findById(resourceId);
        if (!existingResource) {
          throw new Error('资源不存在');
        }

        const user = await this.getUserById(userId);
        if (existingResource.author_id !== userId && user.role !== 'admin') {
          throw new Error('没有权限删除此资源');
        }

        await this.executeInTransaction(async (client) => {
          // 删除标签关联
          await Tag.removeResourceTags(resourceId, client);
          
          // 删除资源
          await Resource.deleteById(resourceId, client);
        });

        // 清除相关缓存
        await this.clearResourceCache(resourceId);

        this.log('info', '资源删除成功', { resourceId, userId });

        return this.formatSuccessResponse(null, '资源删除成功');

      } catch (error) {
        this.handleError(error, 'deleteResource');
      }
    });
  }

  // 注意：下载功能已迁移到 ResourceFile 系统和 downloadController
  // 请使用 /api/download/* 相关接口进行文件下载

  /**
   * 标准化资源过滤参数
   */
  normalizeResourceFilters(filters) {
    const {
      categoryId,
      resourceTypeId,
      authorId,
      status = 'published',
      isPublic,
      isFree,
      search,
      tags,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = filters;

    return {
      categoryId: categoryId ? parseInt(categoryId) : undefined,
      resourceTypeId: resourceTypeId ? parseInt(resourceTypeId) : undefined,
      authorId: authorId ? parseInt(authorId) : undefined,
      status,
      isPublic: isPublic !== undefined ? isPublic === 'true' : undefined,
      isFree: isFree !== undefined ? isFree === 'true' : undefined,
      search,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',')) : undefined,
      sortBy,
      sortOrder
    };
  }

  /**
   * 生成资源列表缓存键
   */
  generateResourceListCacheKey(filters, page, limit, user) {
    const userRole = user?.role || 'anonymous';
    const filterStr = Object.entries(filters)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${key}:${Array.isArray(value) ? value.join(',') : value}`)
      .join(':');
    
    return `resources:list:${userRole}:${page}:${limit}:${filterStr}`;
  }

  /**
   * 附加下载信息到资源列表
   */
  async attachDownloadInfo(resources, user) {
    if (resources.length === 0) return resources;

    return await generateSecureResourceInfoBatch(resources, user);
  }

  /**
   * 验证资源数据
   */
  async validateResourceData(data, isCreate = true) {
    const validatedData = {};

    if (isCreate || data.title !== undefined) {
      if (!data.title || data.title.length < 1 || data.title.length > 200) {
        throw new Error('标题长度必须在1-200个字符之间');
      }
      validatedData.title = data.title;
    }

    if (isCreate || data.description !== undefined) {
      if (!data.description || data.description.length < 1) {
        throw new Error('描述不能为空');
      }
      validatedData.description = data.description;
    }

    // 验证分类ID
    if (data.category_id !== undefined) {
      if (data.category_id) {
        const category = await Category.findById(data.category_id);
        if (!category) {
          throw new Error('指定的分类不存在');
        }
      }
      validatedData.category_id = data.category_id;
    }

    // 其他字段验证...
    const optionalFields = [
      'slug', 'summary', 'cover_image_url', 'resource_type_id',
      'is_public', 'is_free', 'required_vip_level', 'required_points'
    ];

    optionalFields.forEach(field => {
      if (data[field] !== undefined) {
        validatedData[field] = data[field];
      }
    });

    return validatedData;
  }

  /**
   * 增加浏览次数
   */
  async incrementViewCount(resourceId) {
    try {
      await Resource.incrementViewCount(resourceId);
      await this.clearResourceCache(resourceId);
    } catch (error) {
      this.log('error', '增加浏览次数失败', { resourceId, error: error.message });
    }
  }

  /**
   * 增加下载次数
   */
  async incrementDownloadCount(resourceId) {
    try {
      await Resource.incrementDownloadCount(resourceId);
      await this.clearResourceCache(resourceId);
    } catch (error) {
      this.log('error', '增加下载次数失败', { resourceId, error: error.message });
    }
  }

  /**
   * 清除资源相关缓存
   */
  async clearResourceCache(resourceId) {
    await Promise.all([
      this.clearCache(`resource:${resourceId}:*`),
      this.clearResourceListCache()
    ]);
  }

  /**
   * 清除资源列表缓存
   */
  async clearResourceListCache() {
    await this.clearCache('resources:list:*');
  }

  /**
   * 获取用户信息（辅助方法）
   */
  async getUserById(userId) {
    const User = require('../models/User');
    return await User.findById(userId);
  }

  /**
   * 关联资源标签
   */
  async associateResourceTags(resourceId, tags, client) {
    if (tags && tags.length > 0) {
      await Tag.addResourceTags(resourceId, tags, client);
    }
  }

  /**
   * 更新资源标签
   */
  async updateResourceTags(resourceId, tags, client) {
    // 先删除现有标签关联
    await Tag.removeResourceTags(resourceId, client);
    
    // 添加新的标签关联
    if (tags && tags.length > 0) {
      await Tag.addResourceTags(resourceId, tags, client);
    }
  }
}

module.exports = new ResourceService();