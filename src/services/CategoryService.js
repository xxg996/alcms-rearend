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
        const { include_disabled = false } = options;
        const cacheKey = `categories:tree:${include_disabled}`;

        return await this.getCached(cacheKey, async () => {
          const categories = await Category.findAll({
            status: include_disabled ? undefined : 'active',
            order_by: 'sort_order',
            order_direction: 'ASC'
          });

          const categoryTree = this.buildCategoryTree(categories);
          
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
        const { page, limit, offset } = this.normalizePaginationParams(
          pagination.page,
          pagination.limit
        );

        const normalizedFilters = this.normalizeCategoryFilters(filters);

        const [categories, totalCount] = await Promise.all([
          Category.findByFilters({ ...normalizedFilters, limit, offset }),
          Category.countByFilters(normalizedFilters)
        ]);

        return this.formatPaginatedResponse(
          categories,
          { page, limit },
          totalCount
        );

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

          // 获取子分类
          const children = await Category.findByParentId(categoryId);
          
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
        this.validateRequired(categoryData, ['name', 'slug']);

        const { name, slug, description, parent_id, icon, sort_order = 0 } = categoryData;

        // 验证slug唯一性
        const existingCategory = await Category.findBySlug(slug);
        if (existingCategory) {
          throw new Error('分类标识已存在');
        }

        // 验证父分类
        if (parent_id) {
          const parentCategory = await Category.findById(parent_id);
          if (!parentCategory) {
            throw new Error('父分类不存在');
          }
          
          // 检查层级深度
          const depth = await this.getCategoryDepth(parent_id);
          if (depth >= 3) {
            throw new Error('分类层级不能超过3级');
          }
        }

        const newCategory = await Category.create({
          name,
          slug,
          description,
          parent_id,
          icon,
          sort_order,
          status: 'active',
          created_by: userId,
          created_at: new Date(),
          updated_at: new Date()
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

        const { name, slug, description, parent_id, icon, sort_order, status } = updateData;

        // 验证slug唯一性（排除当前分类）
        if (slug && slug !== existingCategory.slug) {
          const duplicateCategory = await Category.findBySlug(slug);
          if (duplicateCategory && duplicateCategory.id !== categoryId) {
            throw new Error('分类标识已存在');
          }
        }

        // 验证父分类变更
        if (parent_id !== undefined && parent_id !== existingCategory.parent_id) {
          if (parent_id) {
            // 不能将分类设为自己的子分类
            if (parent_id === categoryId) {
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
          }
        }

        const updatedCategory = await Category.updateById(categoryId, {
          ...(name !== undefined && { name }),
          ...(slug !== undefined && { slug }),
          ...(description !== undefined && { description }),
          ...(parent_id !== undefined && { parent_id }),
          ...(icon !== undefined && { icon }),
          ...(sort_order !== undefined && { sort_order }),
          ...(status !== undefined && { status }),
          updated_at: new Date()
        });

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

        // 检查是否有子分类
        const children = await Category.findByParentId(categoryId);
        if (children.length > 0) {
          throw new Error('该分类下还有子分类，无法删除');
        }

        // 检查是否有关联资源
        const resourceCount = await this.getResourceCountByCategory(categoryId);
        if (resourceCount > 0) {
          throw new Error(`该分类下还有 ${resourceCount} 个资源，无法删除`);
        }

        await Category.deleteById(categoryId);

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
            await Category.updateById(id, { sort_order }, client);
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
    const children = await Category.findByParentId(categoryId);

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
      created_by
    } = filters;

    return {
      parent_id: parent_id ? parseInt(parent_id) : undefined,
      status,
      search,
      created_by: created_by ? parseInt(created_by) : undefined
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