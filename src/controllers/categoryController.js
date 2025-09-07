/**
 * 分类管理控制器
 * 处理分类相关的HTTP请求
 */

const Category = require('../models/Category');

class CategoryController {
  /**
   * 获取分类列表（树形结构）
   */
  static async getCategories(req, res) {
    try {
      const { tree = 'true', includeInactive = 'false', parentId } = req.query;

      let categories;
      
      if (tree === 'true' && parentId === undefined) {
        // 返回树形结构
        categories = await Category.findAllTree(includeInactive === 'true');
      } else {
        // 返回扁平列表
        const options = {
          includeInactive: includeInactive === 'true',
          parentId: parentId === 'null' ? null : (parentId ? parseInt(parentId) : undefined)
        };
        categories = await Category.findAll(options);
      }

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('获取分类列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取分类列表失败',
        error: error.message
      });
    }
  }

  /**
   * 获取单个分类详情
   */
  static async getCategory(req, res) {
    try {
      const { id } = req.params;

      const category = await Category.findById(parseInt(id));

      if (!category) {
        return res.status(404).json({
          success: false,
          message: '分类不存在'
        });
      }

      // 获取分类路径（面包屑）
      const categoryPath = await Category.getCategoryPath(parseInt(id));

      res.json({
        success: true,
        data: {
          ...category,
          path: categoryPath
        }
      });
    } catch (error) {
      console.error('获取分类详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取分类详情失败',
        error: error.message
      });
    }
  }

  /**
   * 创建新分类
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

      const category = await Category.create(categoryData);

      res.status(201).json({
        success: true,
        message: '分类创建成功',
        data: category
      });
    } catch (error) {
      console.error('创建分类失败:', error);
      
      if (error.message === '分类名称已存在') {
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
   * 更新分类
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

      const category = await Category.findById(parseInt(id));

      if (!category) {
        return res.status(404).json({
          success: false,
          message: '分类不存在'
        });
      }

      // 数据预处理
      if (updateData.name) {
        updateData.name = updateData.name.toLowerCase().trim();
      }
      if (updateData.displayName) {
        updateData.displayName = updateData.displayName.trim();
      }
      if (updateData.parentId !== undefined) {
        updateData.parentId = updateData.parentId ? parseInt(updateData.parentId) : null;
      }
      if (updateData.sortOrder !== undefined) {
        updateData.sortOrder = parseInt(updateData.sortOrder);
      }

      const updatedCategory = await Category.update(parseInt(id), updateData);

      res.json({
        success: true,
        message: '分类更新成功',
        data: updatedCategory
      });
    } catch (error) {
      console.error('更新分类失败:', error);
      
      if (error.message.includes('循环引用') || error.message.includes('不能将分类设置为')) {
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
   * 删除分类
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

      const category = await Category.findById(parseInt(id));

      if (!category) {
        return res.status(404).json({
          success: false,
          message: '分类不存在'
        });
      }

      await Category.delete(parseInt(id));

      res.json({
        success: true,
        message: '分类删除成功'
      });
    } catch (error) {
      console.error('删除分类失败:', error);
      
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
   * 获取热门分类
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
      console.error('获取热门分类失败:', error);
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
