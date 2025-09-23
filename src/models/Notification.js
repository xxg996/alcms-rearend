/**
 * 通知数据模型
 * 负责处理用户消息通知的查询、分类与详情补充
 */

const { query } = require('../config/database');
const { logger } = require('../utils/logger');

class Notification {
  /**
   * 可识别的通知大类
   */
  static CATEGORY_SET = new Set(['resource', 'community', 'system']);

  /**
   * 规范化通知类别
   * @param {string} category - 原始类别
   * @returns {string|null} - 规范化的类别
   */
  static normalizeCategory(category) {
    if (!category) {
      return null;
    }
    return category.toString().trim().toLowerCase();
  }

  /**
   * 判断类别是否有效
   * @param {string} category - 待校验类别
   * @returns {boolean}
   */
  static isValidCategory(category) {
    const normalized = this.normalizeCategory(category);
    return normalized ? this.CATEGORY_SET.has(normalized) : false;
  }

  /**
   * 根据通知类型推断所属类别
   * @param {string} type - 通知类型
   * @returns {string}
   */
  static inferCategory(type) {
    if (!type) {
      return 'system';
    }
    const lower = type.toLowerCase();
    if (lower.startsWith('resource')) {
      return 'resource';
    }
    if (lower.startsWith('community')) {
      return 'community';
    }
    if (lower.startsWith('system')) {
      return 'system';
    }
    return 'system';
  }

  /**
   * 将字符串布尔值转换为布尔型
   * @param {*} value - 原始值
   * @returns {boolean|null}
   */
  static parseBoolean(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = value.toString().trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
    return null;
  }

  /**
   * 尝试解析通知内容的JSON数据
   * @param {string} content - 通知内容
   * @returns {Object|null}
   */
  static parseContent(content) {
    if (!content || typeof content !== 'string') {
      return null;
    }
    try {
      const parsed = JSON.parse(content);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 将数据库记录格式化为业务结构
   * @param {Object} row - 数据库行
   * @returns {Object}
   */
  static formatNotification(row) {
    const metadata = this.parseContent(row.content);
    const notification = {
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      category: this.inferCategory(row.type),
      title: row.title,
      content: row.content,
      metadata,
      related_type: row.related_type,
      related_id: row.related_id,
      sender_id: row.sender_id,
      is_read: row.is_read,
      created_at: row.created_at
    };

    if (row.sender_id) {
      notification.sender = {
        id: row.sender_id,
        username: row.sender_username,
        nickname: row.sender_nickname,
        avatar_url: row.sender_avatar
      };
    } else {
      notification.sender = null;
    }

    return notification;
  }

  /**
   * 获取用户通知列表
   * @param {number} userId - 用户ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>}
   */
  static async getUserNotifications(userId, options = {}) {
    const page = Math.max(parseInt(options.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(options.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const conditions = ['cn.user_id = $1'];
    const params = [userId];
    let paramIndex = 2;

    const category = this.normalizeCategory(options.category);
    if (category && this.CATEGORY_SET.has(category)) {
      conditions.push(`LOWER(cn.type) LIKE $${paramIndex}`);
      params.push(`${category}%`);
      paramIndex += 1;
    }

    const isRead = this.parseBoolean(options.isRead ?? options.read);
    if (isRead !== null) {
      conditions.push(`cn.is_read = $${paramIndex}`);
      params.push(isRead);
      paramIndex += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM community_notifications cn
      ${whereClause}
    `;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total, 10) || 0;

    const limitParamIndex = paramIndex;
    const offsetParamIndex = paramIndex + 1;

    const dataQuery = `
      SELECT
        cn.*,
        sender.username AS sender_username,
        sender.nickname AS sender_nickname,
        sender.avatar_url AS sender_avatar
      FROM community_notifications cn
      LEFT JOIN users sender ON cn.sender_id = sender.id
      ${whereClause}
      ORDER BY cn.created_at DESC
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `;

    const dataParams = [...params, limit, offset];
    const dataResult = await query(dataQuery, dataParams);
    const notifications = dataResult.rows.map((row) => this.formatNotification(row));

    return {
      data: notifications,
      pagination: {
        total,
        limit,
        page,
        totalPages: Math.ceil(total / limit) || 0,
        hasNext: offset + limit < total,
        hasPrev: offset > 0
      }
    };
  }

  /**
   * 根据通知ID获取详情
   * @param {number} id - 通知ID
   * @param {number} userId - 用户ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object|null>}
   */
  static async getNotificationById(id, userId, options = {}) {
    const detailQuery = `
      SELECT
        cn.*,
        sender.username AS sender_username,
        sender.nickname AS sender_nickname,
        sender.avatar_url AS sender_avatar
      FROM community_notifications cn
      LEFT JOIN users sender ON cn.sender_id = sender.id
      WHERE cn.id = $1 AND cn.user_id = $2
      LIMIT 1
    `;

    const result = await query(detailQuery, [id, userId]);
    if (result.rows.length === 0) {
      return null;
    }

    const notification = this.formatNotification(result.rows[0]);

    if (options.enrich) {
      await this.enrichNotification(notification);
    }

    if (options.markRead) {
      try {
        await this.updateReadState(id, userId, true);
        notification.is_read = true;
      } catch (error) {
        logger.warn('标记通知为已读失败', {
          notificationId: id,
          userId,
          error: error.message
        });
      }
    }

    return notification;
  }

  /**
   * 补充通知详情信息
   * @param {Object} notification - 通知对象
   * @returns {Promise<Object>}
   */
  static async enrichNotification(notification) {
    try {
      notification.detail = await this.buildDetail(notification);
    } catch (error) {
      logger.warn('补充通知详情失败', {
        notificationId: notification.id,
        relatedType: notification.related_type,
        relatedId: notification.related_id,
        error: error.message
      });
      notification.detail = null;
    }

    return notification;
  }

  /**
   * 根据通知类型获取补充详情
   * @param {Object} notification - 通知对象
   * @returns {Promise<Object|null>}
   */
  static async buildDetail(notification) {
    const { related_type: relatedType, related_id: relatedId } = notification;

    if (!relatedType || relatedId === null || relatedId === undefined) {
      return null;
    }

    const numericId = parseInt(relatedId, 10);
    if (Number.isNaN(numericId) || numericId <= 0) {
      return null;
    }

    const type = relatedType.toString().toLowerCase();

    if (type === 'resource_comment' || type === 'resource_reply') {
      return this.fetchResourceCommentDetail(numericId);
    }

    if (type === 'resource_like' || type === 'resource') {
      return this.fetchResourceDetail(numericId);
    }

    if (type === 'community_comment' || type === 'community_reply') {
      return this.fetchCommunityCommentDetail(numericId);
    }

    if (type === 'community_post' || type === 'community_like') {
      return this.fetchCommunityPostDetail(numericId);
    }

    if (type === 'system_order' || type === 'vip_order') {
      return this.fetchVipOrderDetail(numericId);
    }

    if (type === 'system_card_key' || type === 'card_key') {
      return this.fetchCardKeyDetail(numericId);
    }

    if (type === 'system_user_status' || type === 'user_status') {
      return this.fetchUserStatusDetail(numericId);
    }

    return null;
  }

  /**
   * 获取资源评论详情
   * @param {number} commentId - 评论ID
   * @returns {Promise<Object|null>}
   */
  static async fetchResourceCommentDetail(commentId) {
    const sql = `
      SELECT
        rc.id,
        rc.content,
        rc.user_id,
        rc.resource_id,
        rc.parent_id,
        rc.like_count,
        rc.created_at,
        rc.updated_at,
        u.username,
        u.nickname,
        u.avatar_url,
        r.title AS resource_title,
        r.slug AS resource_slug
      FROM resource_comments rc
      LEFT JOIN users u ON rc.user_id = u.id
      LEFT JOIN resources r ON rc.resource_id = r.id
      WHERE rc.id = $1
    `;

    const result = await query(sql, [commentId]);
    return result.rows[0] || null;
  }

  /**
   * 获取资源详情
   * @param {number} resourceId - 资源ID
   * @returns {Promise<Object|null>}
   */
  static async fetchResourceDetail(resourceId) {
    const sql = `
      SELECT
        r.id,
        r.title,
        r.slug,
        r.author_id,
        r.status,
        r.view_count,
        r.like_count,
        r.created_at,
        r.updated_at,
        u.username AS author_username,
        u.nickname AS author_nickname,
        u.avatar_url AS author_avatar
      FROM resources r
      LEFT JOIN users u ON r.author_id = u.id
      WHERE r.id = $1
    `;

    const result = await query(sql, [resourceId]);
    return result.rows[0] || null;
  }

  /**
   * 获取社区评论详情
   * @param {number} commentId - 评论ID
   * @returns {Promise<Object|null>}
   */
  static async fetchCommunityCommentDetail(commentId) {
    const sql = `
      SELECT
        cc.id,
        cc.content,
        cc.author_id,
        cc.post_id,
        cc.parent_id,
        cc.like_count,
        cc.created_at,
        cc.updated_at,
        u.username,
        u.nickname,
        u.avatar_url,
        cp.title AS post_title,
        cp.status AS post_status
      FROM community_comments cc
      LEFT JOIN users u ON cc.author_id = u.id
      LEFT JOIN community_posts cp ON cc.post_id = cp.id
      WHERE cc.id = $1
    `;

    const result = await query(sql, [commentId]);
    return result.rows[0] || null;
  }

  /**
   * 获取社区帖子详情
   * @param {number} postId - 帖子ID
   * @returns {Promise<Object|null>}
   */
  static async fetchCommunityPostDetail(postId) {
    const sql = `
      SELECT
        cp.id,
        cp.title,
        cp.author_id,
        cp.status,
        cp.view_count,
        cp.reply_count,
        cp.like_count,
        cp.created_at,
        cp.updated_at,
        u.username AS author_username,
        u.nickname AS author_nickname,
        u.avatar_url AS author_avatar
      FROM community_posts cp
      LEFT JOIN users u ON cp.author_id = u.id
      WHERE cp.id = $1
    `;

    const result = await query(sql, [postId]);
    return result.rows[0] || null;
  }

  /**
   * 获取VIP订单详情
   * @param {number} orderId - 订单ID
   * @returns {Promise<Object|null>}
   */
  static async fetchVipOrderDetail(orderId) {
    const sql = `
      SELECT
        vo.id,
        vo.order_no,
        vo.user_id,
        vo.status,
        vo.price,
        vo.vip_level,
        vo.duration_days,
        vo.expire_at,
        vo.payment_method,
        vo.created_at,
        vo.updated_at
      FROM vip_orders vo
      WHERE vo.id = $1
    `;

    const result = await query(sql, [orderId]);
    return result.rows[0] || null;
  }

  /**
   * 获取卡密详情
   * @param {number} cardKeyId - 卡密ID
   * @returns {Promise<Object|null>}
   */
  static async fetchCardKeyDetail(cardKeyId) {
    const sql = `
      SELECT
        ck.id,
        ck.code,
        ck.type,
        ck.vip_level,
        ck.vip_days,
        ck.points,
        ck.download_credits,
        ck.status,
        ck.used_by,
        ck.used_at,
        ck.expire_at,
        ck.value_amount,
        ck.created_at,
        ck.updated_at
      FROM card_keys ck
      WHERE ck.id = $1
    `;

    const result = await query(sql, [cardKeyId]);
    return result.rows[0] || null;
  }

  /**
   * 获取用户状态详情
   * @param {number} targetUserId - 用户ID
   * @returns {Promise<Object|null>}
   */
  static async fetchUserStatusDetail(targetUserId) {
    const sql = `
      SELECT
        u.id,
        u.username,
        u.nickname,
        u.status,
        u.is_vip,
        u.vip_level,
        u.vip_expire_at,
        u.created_at,
        u.updated_at
      FROM users u
      WHERE u.id = $1
    `;

    const result = await query(sql, [targetUserId]);
    return result.rows[0] || null;
  }

  /**
   * 更新通知已读状态
   * @param {number} id - 通知ID
   * @param {number} userId - 用户ID
   * @param {boolean} isRead - 是否标记为已读
   * @returns {Promise<boolean>}
   */
  static async updateReadState(id, userId, isRead = true) {
    const sql = `
      UPDATE community_notifications
      SET is_read = $3
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;

    const result = await query(sql, [id, userId, isRead]);
    return result.rows.length > 0;
  }

  /**
   * 批量更新通知已读状态
   * @param {number} userId - 用户ID
  * @param {Object} options - 过滤选项
   * @param {Array<number>} options.ids - 指定通知ID列表
   * @param {string} options.category - 按类别筛选
   * @param {boolean} options.isRead - 目标状态
   * @returns {Promise<number>} - 受影响行数
   */
  static async batchUpdateReadState(userId, options = {}) {
    const isRead = options.isRead === undefined ? true : !!options.isRead;

    const conditions = ['user_id = $1'];
    const params = [userId];
    let paramIndex = 2;

    if (Array.isArray(options.ids) && options.ids.length > 0) {
      conditions.push(`id = ANY($${paramIndex})`);
      params.push(options.ids);
      paramIndex += 1;
    }

    const category = this.normalizeCategory(options.category);
    if (category && this.CATEGORY_SET.has(category)) {
      conditions.push(`LOWER(type) LIKE $${paramIndex}`);
      params.push(`${category}%`);
      paramIndex += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      UPDATE community_notifications
      SET is_read = $${paramIndex}
      ${whereClause}
    `;

    params.push(isRead);

    const result = await query(sql, params);
    return result.rowCount || 0;
  }
}

module.exports = Notification;
