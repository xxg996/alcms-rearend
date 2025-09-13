/**
 * 社区板块数据模型
 * 处理社区板块的CRUD操作和统计
 */

const { query } = require('../config/database');

class CommunityBoard {
  /**
   * 获取所有板块列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 板块列表
   */
  static async findAll(options = {}) {
    const { includeStats = false, activeOnly = true } = options;
    
    let sql = `
      SELECT 
        cb.*,
        ${includeStats ? `
        (SELECT COUNT(*) FROM community_posts cp WHERE cp.board_id = cb.id AND cp.status = 'published') as post_count,
        (SELECT COUNT(*) FROM community_posts cp 
         JOIN community_comments cc ON cp.id = cc.post_id 
         WHERE cp.board_id = cb.id AND cp.status = 'published') as comment_count
        ` : 'cb.post_count'}
      FROM community_boards cb
    `;
    
    const conditions = [];
    const params = [];
    
    if (activeOnly) {
      conditions.push('cb.is_active = $' + (params.length + 1));
      params.push(true);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY cb.sort_order ASC, cb.id ASC';
    
    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * 根据ID获取板块详情
   * @param {number} id - 板块ID
   * @returns {Promise<Object|null>} 板块详情
   */
  static async findById(id) {
    const sql = `
      SELECT 
        cb.*,
        (SELECT COUNT(*) FROM community_posts cp WHERE cp.board_id = cb.id AND cp.status = 'published') as post_count,
        (SELECT COUNT(*) FROM community_posts cp 
         JOIN community_comments cc ON cp.id = cc.post_id 
         WHERE cp.board_id = cb.id AND cp.status = 'published') as comment_count,
        (SELECT row_to_json(u) FROM (
          SELECT id, username, nickname, avatar_url 
          FROM users 
          WHERE id = (SELECT author_id FROM community_posts WHERE board_id = cb.id ORDER BY last_reply_time DESC LIMIT 1)
        ) u) as last_poster
      FROM community_boards cb
      WHERE cb.id = $1
    `;
    
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

  /**
   * 根据名称获取板块
   * @param {string} name - 板块名称
   * @returns {Promise<Object|null>} 板块信息
   */
  static async findByName(name) {
    const sql = 'SELECT * FROM community_boards WHERE name = $1';
    const result = await query(sql, [name]);
    return result.rows[0] || null;
  }

  /**
   * 创建新板块
   * @param {Object} boardData - 板块数据
   * @returns {Promise<Object>} 创建的板块
   */
  static async create(boardData) {
    const {
      name,
      displayName,
      description,
      iconUrl,
      coverImageUrl,
      sortOrder = 0,
      moderatorIds = []
    } = boardData;

    const sql = `
      INSERT INTO community_boards (
        name, display_name, description, icon_url, cover_image_url, 
        sort_order, moderator_ids
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const params = [
      name,
      displayName,
      description || null,
      iconUrl || null,
      coverImageUrl || null,
      sortOrder,
      moderatorIds
    ];

    const result = await query(sql, params);
    return result.rows[0];
  }

  /**
   * 更新板块信息
   * @param {number} id - 板块ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object|null>} 更新后的板块
   */
  static async update(id, updateData) {
    const allowedFields = [
      'display_name', 'description', 'icon_url', 'cover_image_url',
      'sort_order', 'is_active', 'moderator_ids'
    ];

    const updates = [];
    const params = [];
    let paramIndex = 1;

    Object.keys(updateData).forEach(key => {
      const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbField)) {
        updates.push(`${dbField} = $${paramIndex}`);
        params.push(updateData[key]);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      throw new Error('没有有效的更新字段');
    }

    params.push(id);
    const sql = `
      UPDATE community_boards 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  /**
   * 删除板块
   * @param {number} id - 板块ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  static async delete(id) {
    // 检查是否有帖子
    const postCheck = await query(
      'SELECT COUNT(*) as count FROM community_posts WHERE board_id = $1',
      [id]
    );

    if (parseInt(postCheck.rows[0].count) > 0) {
      throw new Error('该板块下还有帖子，无法删除');
    }

    const result = await query('DELETE FROM community_boards WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  /**
   * 更新板块帖子统计
   * @param {number} boardId - 板块ID
   * @returns {Promise<void>}
   */
  static async updatePostCount(boardId) {
    const sql = `
      UPDATE community_boards 
      SET post_count = (
        SELECT COUNT(*) FROM community_posts 
        WHERE board_id = $1 AND status = 'published'
      )
      WHERE id = $1
    `;
    
    await query(sql, [boardId]);
  }

  /**
   * 批量更新板块排序
   * @param {Array} sortData - 排序数据 [{id, sortOrder}]
   * @returns {Promise<void>}
   */
  static async batchUpdateSort(sortData) {
    if (!Array.isArray(sortData) || sortData.length === 0) {
      throw new Error('排序数据不能为空');
    }

    const updatePromises = sortData.map(item => {
      const { id, sortOrder } = item;
      return query(
        'UPDATE community_boards SET sort_order = $1 WHERE id = $2',
        [sortOrder, id]
      );
    });

    await Promise.all(updatePromises);
  }

  /**
   * 获取板块统计信息
   * @param {number} boardId - 板块ID
   * @returns {Promise<Object>} 统计信息
   */
  static async getStats(boardId) {
    const sql = `
      SELECT 
        cb.name,
        cb.display_name,
        COUNT(DISTINCT cp.id) as total_posts,
        COUNT(DISTINCT cc.id) as total_comments,
        COUNT(DISTINCT cp.author_id) as unique_authors,
        MAX(cp.created_at) as latest_post_time,
        AVG(cp.view_count) as avg_view_count
      FROM community_boards cb
      LEFT JOIN community_posts cp ON cb.id = cp.board_id AND cp.status = 'published'
      LEFT JOIN community_comments cc ON cp.id = cc.post_id
      WHERE cb.id = $1
      GROUP BY cb.id, cb.name, cb.display_name
    `;

    const result = await query(sql, [boardId]);
    return result.rows[0] || null;
  }

  /**
   * 搜索板块
   * @param {string} keyword - 搜索关键词
   * @returns {Promise<Array>} 搜索结果
   */
  static async search(keyword) {
    const sql = `
      SELECT * FROM community_boards 
      WHERE (display_name ILIKE $1 OR description ILIKE $1)
        AND is_active = true
      ORDER BY 
        CASE 
          WHEN display_name ILIKE $1 THEN 1 
          WHEN description ILIKE $1 THEN 2 
          ELSE 3 
        END,
        sort_order ASC
    `;

    const searchTerm = `%${keyword}%`;
    const result = await query(sql, [searchTerm]);
    return result.rows;
  }

  /**
   * 检查用户是否是板块版主
   * @param {number} boardId - 板块ID
   * @param {number} userId - 用户ID
   * @returns {Promise<boolean>} 是否为版主
   */
  static async isModerator(boardId, userId) {
    const sql = `
      SELECT moderator_ids FROM community_boards 
      WHERE id = $1 AND $2 = ANY(moderator_ids)
    `;
    
    const result = await query(sql, [boardId, userId]);
    return result.rows.length > 0;
  }

  /**
   * 添加版主
   * @param {number} boardId - 板块ID
   * @param {number} userId - 用户ID
   * @returns {Promise<void>}
   */
  static async addModerator(boardId, userId) {
    const sql = `
      UPDATE community_boards 
      SET moderator_ids = array_append(moderator_ids, $2)
      WHERE id = $1 AND NOT ($2 = ANY(moderator_ids))
    `;
    
    await query(sql, [boardId, userId]);
  }

  /**
   * 移除版主
   * @param {number} boardId - 板块ID
   * @param {number} userId - 用户ID
   * @returns {Promise<void>}
   */
  static async removeModerator(boardId, userId) {
    const sql = `
      UPDATE community_boards 
      SET moderator_ids = array_remove(moderator_ids, $2)
      WHERE id = $1
    `;
    
    await query(sql, [boardId, userId]);
  }
}

module.exports = CommunityBoard;
