/**
 * 资源收藏数据模型
 * 处理用户收藏资源相关的数据库操作
 */

const { query } = require('../config/database');

class Favorite {
  /**
   * 切换收藏状态（收藏/取消收藏）
   * @param {number} userId - 用户ID
   * @param {number} resourceId - 资源ID
   * @returns {Promise<Object>} 操作结果
   */
  static async toggleFavorite(userId, resourceId) {
    // 检查是否已收藏
    const existingFavorite = await this.checkFavoriteStatus(userId, resourceId);
    
    if (existingFavorite) {
      // 已收藏，执行取消收藏
      return await this.removeFavorite(userId, resourceId);
    } else {
      // 未收藏，执行收藏
      return await this.addFavorite(userId, resourceId);
    }
  }

  /**
   * 添加收藏
   * @param {number} userId - 用户ID
   * @param {number} resourceId - 资源ID
   * @returns {Promise<Object>} 收藏记录
   */
  static async addFavorite(userId, resourceId) {
    const queryStr = `
      INSERT INTO user_favorites (user_id, resource_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, resource_id) DO NOTHING
      RETURNING *
    `;
    const result = await query(queryStr, [userId, resourceId]);
    return result.rows[0];
  }

  /**
   * 取消收藏
   * @param {number} userId - 用户ID
   * @param {number} resourceId - 资源ID
   * @returns {Promise<Object>} 被删除的收藏记录
   */
  static async removeFavorite(userId, resourceId) {
    const queryStr = `
      DELETE FROM user_favorites 
      WHERE user_id = $1 AND resource_id = $2
      RETURNING *
    `;
    const result = await query(queryStr, [userId, resourceId]);
    return result.rows[0];
  }

  /**
   * 检查收藏状态
   * @param {number} userId - 用户ID
   * @param {number} resourceId - 资源ID
   * @returns {Promise<Object|null>} 收藏记录或null
   */
  static async checkFavoriteStatus(userId, resourceId) {
    const queryStr = `
      SELECT * FROM user_favorites 
      WHERE user_id = $1 AND resource_id = $2
    `;
    const result = await query(queryStr, [userId, resourceId]);
    return result.rows[0] || null;
  }

  /**
   * 批量检查收藏状态
   * @param {number} userId - 用户ID
   * @param {Array<number>} resourceIds - 资源ID数组
   * @returns {Promise<Object>} 收藏状态映射对象
   */
  static async batchCheckFavoriteStatus(userId, resourceIds) {
    if (!resourceIds || resourceIds.length === 0) {
      return {};
    }

    const placeholders = resourceIds.map((_, index) => `$${index + 2}`).join(',');
    const queryStr = `
      SELECT resource_id FROM user_favorites 
      WHERE user_id = $1 AND resource_id IN (${placeholders})
    `;
    const params = [userId, ...resourceIds];
    const result = await query(queryStr, params);
    
    // 转换为便于查找的对象格式
    const favoriteMap = {};
    resourceIds.forEach(id => {
      favoriteMap[id] = false;
    });
    result.rows.forEach(row => {
      favoriteMap[row.resource_id] = true;
    });
    
    return favoriteMap;
  }

  /**
   * 获取用户收藏的资源列表
   * @param {number} userId - 用户ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 收藏的资源列表
   */
  static async getUserFavorites(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      categoryId = null,
      resourceTypeId = null,
      search = null
    } = options;

    const offset = (page - 1) * limit;
    let whereConditions = ['uf.user_id = $1'];
    let params = [userId];
    let paramCount = 2;

    if (categoryId) {
      whereConditions.push(`r.category_id = $${paramCount}`);
      params.push(categoryId);
      paramCount++;
    }

    if (resourceTypeId) {
      whereConditions.push(`r.resource_type_id = $${paramCount}`);
      params.push(resourceTypeId);
      paramCount++;
    }

    if (search) {
      whereConditions.push(`(r.title ILIKE $${paramCount} OR r.description ILIKE $${paramCount})`);
      params.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = whereConditions.join(' AND ');
    
    // Store original param count before adding limit/offset
    const originalParamCount = paramCount;
    
    // Add limit and offset parameters
    const limitParam = paramCount;
    const offsetParam = paramCount + 1;
    params.push(limit, offset);

    const queryStr = `
      SELECT 
        uf.id as favorite_id,
        uf.created_at as favorited_at,
        r.id,
        r.title,
        r.slug,
        r.description,
        r.summary,
        r.cover_image_url,
        r.is_free,
        r.required_points,
        r.status,
        r.view_count,
        r.download_count,
        r.like_count,
        r.created_at,
        r.updated_at,
        c.display_name as category_name,
        rt.display_name as resource_type_name,
        u.username as author_username,
        u.nickname as author_nickname
      FROM user_favorites uf
      JOIN resources r ON uf.resource_id = r.id
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN resource_types rt ON r.resource_type_id = rt.id
      LEFT JOIN users u ON r.author_id = u.id
      WHERE ${whereClause}
        AND r.status = 'published'
        AND r.is_public = TRUE
      ORDER BY uf.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    // 获取总数
    const countQueryStr = `
      SELECT COUNT(*) as total
      FROM user_favorites uf
      JOIN resources r ON uf.resource_id = r.id
      WHERE ${whereClause}
        AND r.status = 'published'
        AND r.is_public = TRUE
    `;

    const [resourcesResult, countResult] = await Promise.all([
      query(queryStr, params),
      query(countQueryStr, params.slice(0, originalParamCount - 1)) // 移除limit和offset参数
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    return {
      resources: resourcesResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    };
  }

  /**
   * 获取用户收藏统计信息
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>} 统计信息
   */
  static async getUserFavoriteStats(userId) {
    const queryStr = `
      SELECT 
        COUNT(*) as total_favorites,
        COUNT(CASE WHEN r.is_free = FALSE THEN 1 END) as paid_favorites,
        0 as vip_favorites,
        COUNT(CASE WHEN c.id IS NOT NULL THEN 1 END) as categorized_favorites
      FROM user_favorites uf
      JOIN resources r ON uf.resource_id = r.id
      LEFT JOIN categories c ON r.category_id = c.id
      WHERE uf.user_id = $1
        AND r.status = 'published'
        AND r.is_public = TRUE
    `;

    const result = await query(queryStr, [userId]);
    return result.rows[0];
  }

  /**
   * 获取资源的收藏统计信息
   * @param {number} resourceId - 资源ID
   * @returns {Promise<Object>} 资源收藏统计
   */
  static async getResourceFavoriteStats(resourceId) {
    const queryStr = `
      SELECT 
        COUNT(*) as favorite_count,
        COUNT(CASE WHEN uf.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recent_favorites
      FROM user_favorites uf
      WHERE uf.resource_id = $1
    `;

    const result = await query(queryStr, [resourceId]);
    return result.rows[0];
  }

  /**
   * 获取热门收藏资源（管理员功能）
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 热门收藏资源列表
   */
  static async getPopularFavorites(options = {}) {
    const { limit = 20, days = 30 } = options;

    const queryStr = `
      SELECT 
        r.id,
        r.title,
        r.cover_image_url,
        COUNT(uf.id) as favorite_count,
        r.view_count,
        r.download_count,
        u.username as author_username,
        c.display_name as category_name
      FROM resources r
      JOIN user_favorites uf ON r.id = uf.resource_id
      LEFT JOIN users u ON r.author_id = u.id
      LEFT JOIN categories c ON r.category_id = c.id
      WHERE r.status = 'published'
        AND r.is_public = TRUE
        AND uf.created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY r.id, r.title, r.cover_image_url, r.view_count, r.download_count, u.username, c.display_name
      ORDER BY favorite_count DESC, r.view_count DESC
      LIMIT $1
    `;

    const result = await query(queryStr, [limit]);
    return result.rows;
  }
}

module.exports = Favorite;
