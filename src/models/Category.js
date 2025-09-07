/**
 * 分类数据模型
 * 处理资源分类相关的数据库操作
 */

const { query } = require('../config/database');

class Category {
  /**
   * 创建新分类
   * @param {Object} categoryData - 分类数据
   * @returns {Promise<Object>} 创建的分类信息
   */
  static async create(categoryData) {
    const { name, displayName, description, parentId, sortOrder = 0, iconUrl } = categoryData;

    // 检查分类名称是否已存在
    const existingCategory = await query('SELECT id FROM categories WHERE name = $1', [name]);
    if (existingCategory.rows.length > 0) {
      throw new Error('分类名称已存在');
    }

    const result = await query(
      `INSERT INTO categories (name, display_name, description, parent_id, sort_order, icon_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, displayName, description, parentId, sortOrder, iconUrl]
    );

    return result.rows[0];
  }

  /**
   * 根据ID获取分类
   * @param {number} id - 分类ID
   * @returns {Promise<Object|null>} 分类信息
   */
  static async findById(id) {
    const result = await query(
      `SELECT 
        c.*,
        p.name as parent_name,
        p.display_name as parent_display_name,
        (SELECT COUNT(*) FROM resources WHERE category_id = c.id AND status = 'published') as resource_count
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const category = result.rows[0];

    // 获取子分类
    const childrenResult = await query(
      `SELECT id, name, display_name, description, sort_order, icon_url
       FROM categories 
       WHERE parent_id = $1 AND is_active = true
       ORDER BY sort_order ASC, display_name ASC`,
      [id]
    );

    category.children = childrenResult.rows;
    return category;
  }

  /**
   * 获取所有分类（树形结构）
   * @param {boolean} includeInactive - 是否包含未激活的分类
   * @returns {Promise<Array>} 分类树
   */
  static async findAllTree(includeInactive = false) {
    const whereClause = includeInactive ? '' : 'WHERE is_active = true';
    
    const result = await query(
      `SELECT 
        c.*,
        (SELECT COUNT(*) FROM resources WHERE category_id = c.id AND status = 'published') as resource_count
      FROM categories c
      ${whereClause}
      ORDER BY sort_order ASC, display_name ASC`
    );

    // 构建树形结构
    const categoryMap = new Map();
    const rootCategories = [];

    // 先创建所有分类的映射
    result.rows.forEach(category => {
      category.children = [];
      categoryMap.set(category.id, category);
    });

    // 构建父子关系
    result.rows.forEach(category => {
      if (category.parent_id) {
        const parent = categoryMap.get(category.parent_id);
        if (parent) {
          parent.children.push(category);
        }
      } else {
        rootCategories.push(category);
      }
    });

    return rootCategories;
  }

  /**
   * 获取扁平分类列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 分类列表
   */
  static async findAll(options = {}) {
    const { includeInactive = false, parentId } = options;
    
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (!includeInactive) {
      conditions.push('is_active = true');
    }

    if (parentId !== undefined) {
      if (parentId === null) {
        conditions.push('parent_id IS NULL');
      } else {
        conditions.push(`parent_id = $${paramIndex}`);
        values.push(parentId);
        paramIndex++;
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT 
        c.*,
        p.name as parent_name,
        p.display_name as parent_display_name,
        (SELECT COUNT(*) FROM resources WHERE category_id = c.id AND status = 'published') as resource_count
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      ${whereClause}
      ORDER BY sort_order ASC, display_name ASC`,
      values
    );

    return result.rows;
  }

  /**
   * 更新分类
   * @param {number} id - 分类ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} 更新后的分类信息
   */
  static async update(id, updateData) {
    const allowedFields = ['name', 'display_name', 'description', 'parent_id', 'sort_order', 'icon_url', 'is_active'];
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        values.push(updateData[field]);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      throw new Error('没有可更新的字段');
    }

    // 检查是否会造成循环引用
    if (updateData.parent_id) {
      const isCircular = await this.checkCircularReference(id, updateData.parent_id);
      if (isCircular) {
        throw new Error('不能将分类设置为自己或子分类的父分类');
      }
    }

    values.push(id);
    const result = await query(
      `UPDATE categories SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${paramIndex} 
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('分类不存在');
    }

    return result.rows[0];
  }

  /**
   * 删除分类
   * @param {number} id - 分类ID
   * @returns {Promise<boolean>} 删除是否成功
   */
  static async delete(id) {
    // 检查是否有子分类
    const childrenResult = await query('SELECT COUNT(*) as count FROM categories WHERE parent_id = $1', [id]);
    if (parseInt(childrenResult.rows[0].count) > 0) {
      throw new Error('存在子分类，无法删除');
    }

    // 检查是否有关联资源
    const resourcesResult = await query('SELECT COUNT(*) as count FROM resources WHERE category_id = $1', [id]);
    if (parseInt(resourcesResult.rows[0].count) > 0) {
      throw new Error('存在关联资源，无法删除');
    }

    const result = await query('DELETE FROM categories WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  /**
   * 检查循环引用
   * @param {number} categoryId - 分类ID
   * @param {number} parentId - 父分类ID
   * @returns {Promise<boolean>} 是否存在循环引用
   */
  static async checkCircularReference(categoryId, parentId) {
    if (categoryId === parentId) {
      return true;
    }

    let currentParentId = parentId;
    const visited = new Set();

    while (currentParentId && !visited.has(currentParentId)) {
      visited.add(currentParentId);

      if (currentParentId === categoryId) {
        return true;
      }

      const result = await query('SELECT parent_id FROM categories WHERE id = $1', [currentParentId]);
      if (result.rows.length === 0) {
        break;
      }

      currentParentId = result.rows[0].parent_id;
    }

    return false;
  }

  /**
   * 获取分类路径（面包屑）
   * @param {number} categoryId - 分类ID
   * @returns {Promise<Array>} 分类路径
   */
  static async getCategoryPath(categoryId) {
    const path = [];
    let currentId = categoryId;

    while (currentId) {
      const result = await query(
        'SELECT id, name, display_name, parent_id FROM categories WHERE id = $1',
        [currentId]
      );

      if (result.rows.length === 0) {
        break;
      }

      const category = result.rows[0];
      path.unshift({
        id: category.id,
        name: category.name,
        display_name: category.display_name
      });

      currentId = category.parent_id;
    }

    return path;
  }

  /**
   * 获取热门分类
   * @param {number} limit - 限制数量
   * @returns {Promise<Array>} 热门分类列表
   */
  static async getPopularCategories(limit = 10) {
    const result = await query(
      `SELECT 
        c.*,
        COUNT(r.id) as resource_count,
        SUM(r.view_count) as total_views
      FROM categories c
      LEFT JOIN resources r ON c.id = r.category_id AND r.status = 'published' AND r.is_public = true
      WHERE c.is_active = true
      GROUP BY c.id
      HAVING COUNT(r.id) > 0
      ORDER BY resource_count DESC, total_views DESC
      LIMIT $1`,
      [limit]
    );

    return result.rows;
  }
}

module.exports = Category;
