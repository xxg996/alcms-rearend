/**
 * 分类业务逻辑服务
 * 处理分类管理相关的所有业务操作
 */

const BaseService = require('./BaseService');
const Category = require('../models/Category');

class CategoryService extends BaseService {
  constructor() {
    super();
  }

  /**
   * 获取分类列表（树形结构）
   */
  async getCategoryTree(options = {}) {
    return this.withPerformanceMonitoring('getCategoryTree', async () => {
      try {
        const { includeInactive = false } = options;
        const cacheKey = `categories:tree:${includeInactive}`;

        return await this.getCached(cacheKey, async () => {
          // 直接使用模型提供的树结构查询
          const categoryTree = await Category.findAllTree(includeInactive);
          return this.formatSuccessResponse(categoryTree, '获取分类列表成功');
        }, 600); // 缓存10分钟

      } catch (error) {
        this.handleError(error, 'getCategoryTree');
      }
    });
  }

  /**
   * 获取扁平分类列表
   */
  async getCategoryList(filters = {}, pagination = {}) {
    return this.withPerformanceMonitoring('getCategoryList', async () => {
      try {
        const normalizedFilters = this.normalizeCategoryFilters(filters);

        // 模型不支持通用过滤/分页统计，这里返回扁平列表
        const categories = await Category.findAll({
          includeInactive: normalizedFilters.status === 'inactive' ? true : (normalizedFilters.status === 'active' ? false : (normalizedFilters.includeInactive ?? false)),
          parentId: normalizedFilters.parent_id
        });

        return this.formatSuccessResponse(categories, '获取分类列表成功');

      } catch (error) {
        this.handleError(error, 'getCategoryList');
      }
    });
  }

  /**
   * 根据ID获取分类详情
   */
  async getCategoryById(categoryId) {
    return this.withPerformanceMonitoring('getCategoryById', async () => {
      try {
        this.validateRequired({ categoryId }, ['categoryId']);

        const cacheKey = `category:${categoryId}`;

        return await this.getCached(cacheKey, async () => {
          const category = await Category.findById(categoryId);
          
          if (!category) {
            throw new Error('分类不存在');
          }

          // 模型 findById 已带 children 字段；为兼容保留 children 变量
          const children = category.children || [];
          
          // 获取父分类路径
          const path = await this.getCategoryPath(categoryId);

          const enrichedCategory = {
            ...category,
            children,
            path
          };

          return this.formatSuccessResponse(enrichedCategory, '获取分类详情成功');
        }, 300);

      } catch (error) {
        this.handleError(error, 'getCategoryById');
      }
    });
  }

  /**
   * 创建分类
   */
  async createCategory(categoryData, userId) {
    return this.withPerformanceMonitoring('createCategory', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);
        this.validateRequired(categoryData, ['name', 'displayName']);

        // 统一输入字段（驼峰 -> 模型所需）
        const name = String(categoryData.name).toLowerCase().trim();
        const displayName = String(categoryData.displayName).trim();
        const description = categoryData.description ?? null;
        const parentId = categoryData.parentId ? parseInt(categoryData.parentId) : null;
        const sortOrder = categoryData.sortOrder ? parseInt(categoryData.sortOrder) : 0;
        const iconUrl = categoryData.iconUrl ?? null;

        // 验证父分类并检查层级深度（最多三级）
        if (parentId) {
          const parentCategory = await Category.findById(parentId);
          if (!parentCategory) {
            throw new Error('父分类不存在');
          }

          const depth = await this.getCategoryDepth(parentId);
          if (depth >= 3) {
            throw new Error('分类层级不能超过3级');
          }
        }

        // 创建分类
        const newCategory = await Category.create({
          name,
          displayName,
          description,
          parentId,
          sortOrder,
          iconUrl
        });

        // 清除相关缓存
        await this.clearCategoryCache();

        this.log('info', '分类创建成功', { 
          categoryId: newCategory.id,
          name,
          userId
        });

        return this.formatSuccessResponse(newCategory, '分类创建成功');

      } catch (error) {
        this.handleError(error, 'createCategory');
      }
    });
  }

  /**
   * 更新分类
   */
  async updateCategory(categoryId, updateData, userId) {
    return this.withPerformanceMonitoring('updateCategory', async () => {
      try {
        this.validateRequired({ categoryId, userId }, ['categoryId', 'userId']);

        const existingCategory = await Category.findById(categoryId);
        if (!existingCategory) {
          throw new Error('分类不存在');
        }

        // 规范化输入
        const update = {};
        if (updateData.name !== undefined) update.name = String(updateData.name).toLowerCase().trim();
        if (updateData.displayName !== undefined) update.display_name = String(updateData.displayName).trim();
        if (updateData.description !== undefined) update.description = updateData.description;
        if (updateData.sortOrder !== undefined) update.sort_order = parseInt(updateData.sortOrder);
        if (updateData.iconUrl !== undefined) update.icon_url = updateData.iconUrl;
        if (updateData.isActive !== undefined) update.is_active = !!updateData.isActive;

        // 处理父分类变更与校验（最多三级 + 防循环）
        if (updateData.parentId !== undefined) {
          const parent_id = updateData.parentId ? parseInt(updateData.parentId) : null;
          if (parent_id) {
            if (parent_id === parseInt(categoryId)) {
              throw new Error('不能将分类设为自己的父分类');
            }

            const parentCategory = await Category.findById(parent_id);
            if (!parentCategory) {
              throw new Error('父分类不存在');
            }

            // 检查是否会形成循环引用
            const isDescendant = await this.isDescendantCategory(parent_id, categoryId);
            if (isDescendant) {
              throw new Error('不能将分类设为自己子分类的父分类，这会形成循环引用');
            }

            // 检查层级深度：父级深度>=3 时，设置将超过3级
            const depth = await this.getCategoryDepth(parent_id);
            if (depth >= 3) {
              throw new Error('分类层级不能超过3级');
            }
          }
          update.parent_id = parent_id;
        }

        const updatedCategory = await Category.update(parseInt(categoryId), update);

        // 清除相关缓存
        await this.clearCategoryCache();

        this.log('info', '分类更新成功', { categoryId, userId });

        return this.formatSuccessResponse(updatedCategory, '分类更新成功');

      } catch (error) {
        this.handleError(error, 'updateCategory');
      }
    });
  }

  /**
   * 删除分类
   */
  async deleteCategory(categoryId, userId) {
    return this.withPerformanceMonitoring('deleteCategory', async () => {
      try {
        this.validateRequired({ categoryId, userId }, ['categoryId', 'userId']);

        const category = await Category.findById(categoryId);
        if (!category) {
          throw new Error('分类不存在');
        }

        // 直接使用模型删除，模型内部已检查子分类与资源关联
        await Category.delete(parseInt(categoryId));

        // 清除相关缓存
        await this.clearCategoryCache();

        this.log('info', '分类删除成功', { categoryId, userId });

        return this.formatSuccessResponse(null, '分类删除成功');

      } catch (error) {
        this.handleError(error, 'deleteCategory');
      }
    });
  }

  /**
   * 批量更新分类排序
   */
  async updateCategorySortOrder(sortData, userId) {
    return this.withPerformanceMonitoring('updateCategorySortOrder', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        if (!Array.isArray(sortData) || sortData.length === 0) {
          throw new Error('排序数据不能为空');
        }

        await this.executeInTransaction(async (client) => {
          for (const item of sortData) {
            const { id, sort_order } = item;
            await Category.update(parseInt(id), { sort_order: parseInt(sort_order) });
          }
        });

        // 清除相关缓存
        await this.clearCategoryCache();

        this.log('info', '分类排序更新成功', { 
          count: sortData.length, 
          userId 
        });

        return this.formatSuccessResponse(null, '分类排序更新成功');

      } catch (error) {
        this.handleError(error, 'updateCategorySortOrder');
      }
    });
  }

  /**
   * 获取分类统计信息
   */
  async getCategoryStats() {
    return this.withPerformanceMonitoring('getCategoryStats', async () => {
      try {
        const cacheKey = 'categories:stats';

        return await this.getCached(cacheKey, async () => {
          const stats = await Category.getStats();
          
          return this.formatSuccessResponse(stats, '获取分类统计成功');
        }, 300);

      } catch (error) {
        this.handleError(error, 'getCategoryStats');
      }
    });
  }

  /**
   * 构建分类树形结构
   */
  buildCategoryTree(categories, parentId = null) {
    const tree = [];
    
    for (const category of categories) {
      if (category.parent_id === parentId) {
        const children = this.buildCategoryTree(categories, category.id);
        const categoryNode = {
          ...category,
          children
        };
        tree.push(categoryNode);
      }
    }

    return tree;
  }

  /**
   * 获取分类路径
   */
  async getCategoryPath(categoryId) {
    const path = [];
    let currentId = categoryId;

    while (currentId) {
      const category = await Category.findById(currentId);
      if (!category) break;

      path.unshift({
        id: category.id,
        name: category.name,
        slug: category.slug
      });

      currentId = category.parent_id;
    }

    return path;
  }

  /**
   * 获取分类层级深度
   */
  async getCategoryDepth(categoryId) {
    let depth = 0;
    let currentId = categoryId;

    while (currentId) {
      const category = await Category.findById(currentId);
      if (!category) break;

      depth++;
      currentId = category.parent_id;

      // 防止无限循环
      if (depth > 10) break;
    }

    return depth;
  }

  /**
   * 检查是否为子分类
   */
  async isDescendantCategory(ancestorId, descendantId) {
    const descendants = await this.getAllDescendants(ancestorId);
    return descendants.some(cat => cat.id === descendantId);
  }

  /**
   * 获取所有后代分类
   */
  async getAllDescendants(categoryId) {
    const descendants = [];
    const children = await Category.findAll({ includeInactive: true, parentId: categoryId });

    for (const child of children) {
      descendants.push(child);
      const childDescendants = await this.getAllDescendants(child.id);
      descendants.push(...childDescendants);
    }

    return descendants;
  }

  /**
   * 获取分类下的资源数量
   */
  async getResourceCountByCategory(categoryId) {
    // 这里应该查询Resource表，暂时返回0
    const Resource = require('../models/Resource');
    return await Resource.countByCategoryId(categoryId);
  }

  /**
   * 标准化分类过滤参数
   */
  normalizeCategoryFilters(filters) {
    const {
      parent_id,
      status,
      search,
      created_by,
      includeInactive
    } = filters;

    return {
      parent_id: parent_id ? parseInt(parent_id) : undefined,
      status,
      search,
      created_by: created_by ? parseInt(created_by) : undefined,
      includeInactive: includeInactive === true
    };
  }

  /**
   * 清除分类相关缓存
   */
  async clearCategoryCache() {
    await Promise.all([
      this.clearCache('categories:tree:*'),
      this.clearCache('categories:stats'),
      this.clearCache('category:*')
    ]);
  }
}

module.exports = new CategoryService();
