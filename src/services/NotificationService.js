/**
 * 通知服务
 * 负责创建、发送和管理各类通知
 */

const { query } = require('../config/database');
const { logger } = require('../utils/logger');

class NotificationService {
  /**
   * 通知类型常量
   */
  static TYPES = {
    // 资源相关
    RESOURCE_COMMENT: 'resource_comment',
    RESOURCE_REPLY: 'resource_reply',
    RESOURCE_LIKE: 'resource_like',

    // 社区相关
    COMMUNITY_COMMENT: 'community_comment',
    COMMUNITY_REPLY: 'community_reply',
    COMMUNITY_LIKE: 'community_like',
    COMMUNITY_POST_FEATURED: 'community_post_featured',

    // 系统相关
    SYSTEM_ANNOUNCEMENT: 'system_announcement',
    SYSTEM_ORDER: 'system_order',
    SYSTEM_VIP_ORDER: 'system_vip_order',
    SYSTEM_CARD_KEY: 'system_card_key',
    SYSTEM_USER_STATUS: 'system_user_status'
  };

  /**
   * 创建单个通知
   * @param {Object} notification - 通知数据
   * @param {number} notification.user_id - 接收用户ID
   * @param {string} notification.type - 通知类型
   * @param {string} notification.title - 通知标题
   * @param {string} notification.content - 通知内容
   * @param {string} notification.related_type - 关联类型
   * @param {number} notification.related_id - 关联ID
   * @param {number} notification.sender_id - 发送者ID
   * @returns {Promise<Object|null>}
   */
  static async createNotification(notification) {
    try {
      const {
        user_id,
        type,
        title,
        content = null,
        related_type = null,
        related_id = null,
        sender_id = null
      } = notification;

      // 验证必填字段
      if (!user_id || !type || !title) {
        logger.warn('创建通知失败：缺少必填字段', { notification });
        return null;
      }

      // 避免自己给自己发通知
      if (sender_id && user_id === sender_id) {
        return null;
      }

      const sql = `
        INSERT INTO community_notifications (
          user_id, type, title, content, related_type, related_id, sender_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const params = [user_id, type, title, content, related_type, related_id, sender_id];
      const result = await query(sql, params);

      logger.info('通知创建成功', {
        notificationId: result.rows[0]?.id,
        userId: user_id,
        type,
        title
      });

      return result.rows[0] || null;
    } catch (error) {
      logger.error('创建通知失败', {
        error: error.message,
        notification
      });
      return null;
    }
  }

  /**
   * 批量创建通知
   * @param {Array<Object>} notifications - 通知数据数组
   * @returns {Promise<number>} 创建成功的通知数量
   */
  static async createBatchNotifications(notifications) {
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return 0;
    }

    let successCount = 0;
    const batchPromises = notifications.map(async (notification) => {
      const result = await this.createNotification(notification);
      if (result) successCount++;
      return result;
    });

    await Promise.allSettled(batchPromises);

    logger.info('批量创建通知完成', {
      total: notifications.length,
      success: successCount
    });

    return successCount;
  }

  /**
   * 创建资源评论通知
   * @param {Object} params
   * @param {number} params.resourceId - 资源ID
   * @param {string} params.resourceTitle - 资源标题
   * @param {number} params.authorId - 资源作者ID
   * @param {number} params.commenterId - 评论者ID
   * @param {string} params.commenterName - 评论者名称
   * @param {string} params.commentContent - 评论内容
   * @returns {Promise<Object|null>}
   */
  static async createResourceCommentNotification(params) {
    const { resourceId, resourceTitle, authorId, commenterId, commenterName, commentContent } = params;

    const title = `${commenterName} 评论了你的资源《${resourceTitle}》`;
    const content = JSON.stringify({
      comment_content: commentContent?.substring(0, 100) || '',
      resource_title: resourceTitle
    });

    return this.createNotification({
      user_id: authorId,
      type: this.TYPES.RESOURCE_COMMENT,
      title,
      content,
      related_type: 'resource',
      related_id: resourceId,
      sender_id: commenterId
    });
  }

  /**
   * 创建资源评论回复通知
   * @param {Object} params
   * @param {number} params.originalCommentId - 原评论ID
   * @param {number} params.originalCommenterId - 原评论者ID
   * @param {number} params.replierId - 回复者ID
   * @param {string} params.replierName - 回复者名称
   * @param {string} params.replyContent - 回复内容
   * @param {string} params.resourceTitle - 资源标题
   * @returns {Promise<Object|null>}
   */
  static async createResourceReplyNotification(params) {
    const { originalCommentId, originalCommenterId, replierId, replierName, replyContent, resourceTitle } = params;

    const title = `${replierName} 回复了你在《${resourceTitle}》下的评论`;
    const content = JSON.stringify({
      reply_content: replyContent?.substring(0, 100) || '',
      resource_title: resourceTitle
    });

    return this.createNotification({
      user_id: originalCommenterId,
      type: this.TYPES.RESOURCE_REPLY,
      title,
      content,
      related_type: 'resource_comment',
      related_id: originalCommentId,
      sender_id: replierId
    });
  }

  /**
   * 创建社区帖子评论通知
   * @param {Object} params
   * @param {number} params.postId - 帖子ID
   * @param {string} params.postTitle - 帖子标题
   * @param {number} params.authorId - 帖子作者ID
   * @param {number} params.commenterId - 评论者ID
   * @param {string} params.commenterName - 评论者名称
   * @param {string} params.commentContent - 评论内容
   * @returns {Promise<Object|null>}
   */
  static async createCommunityCommentNotification(params) {
    const { postId, postTitle, authorId, commenterId, commenterName, commentContent } = params;

    const title = `${commenterName} 评论了你的帖子《${postTitle}》`;
    const content = JSON.stringify({
      comment_content: commentContent?.substring(0, 100) || '',
      post_title: postTitle
    });

    return this.createNotification({
      user_id: authorId,
      type: this.TYPES.COMMUNITY_COMMENT,
      title,
      content,
      related_type: 'community_post',
      related_id: postId,
      sender_id: commenterId
    });
  }

  /**
   * 创建社区评论回复通知
   * @param {Object} params
   * @param {number} params.originalCommentId - 原评论ID
   * @param {number} params.originalCommenterId - 原评论者ID
   * @param {number} params.replierId - 回复者ID
   * @param {string} params.replierName - 回复者名称
   * @param {string} params.replyContent - 回复内容
   * @param {string} params.postTitle - 帖子标题
   * @returns {Promise<Object|null>}
   */
  static async createCommunityReplyNotification(params) {
    const { originalCommentId, originalCommenterId, replierId, replierName, replyContent, postTitle } = params;

    const title = `${replierName} 回复了你在《${postTitle}》下的评论`;
    const content = JSON.stringify({
      reply_content: replyContent?.substring(0, 100) || '',
      post_title: postTitle
    });

    return this.createNotification({
      user_id: originalCommenterId,
      type: this.TYPES.COMMUNITY_REPLY,
      title,
      content,
      related_type: 'community_comment',
      related_id: originalCommentId,
      sender_id: replierId
    });
  }

  /**
   * 创建点赞通知
   * @param {Object} params
   * @param {string} params.targetType - 目标类型 (post/comment)
   * @param {number} params.targetId - 目标ID
   * @param {string} params.targetTitle - 目标标题
   * @param {number} params.targetAuthorId - 目标作者ID
   * @param {number} params.likerId - 点赞者ID
   * @param {string} params.likerName - 点赞者名称
   * @param {string} params.category - 分类 (resource/community)
   * @returns {Promise<Object|null>}
   */
  static async createLikeNotification(params) {
    const { targetType, targetId, targetTitle, targetAuthorId, likerId, likerName, category } = params;

    const typeMap = {
      resource: this.TYPES.RESOURCE_LIKE,
      community: this.TYPES.COMMUNITY_LIKE
    };

    const targetTypeMap = {
      post: category === 'resource' ? 'resource' : 'community_post',
      comment: category === 'resource' ? 'resource_comment' : 'community_comment'
    };

    const titleMap = {
      post: `${likerName} 点赞了你的${category === 'resource' ? '资源' : '帖子'}《${targetTitle}》`,
      comment: `${likerName} 点赞了你的评论`
    };

    const type = typeMap[category];
    const relatedType = targetTypeMap[targetType];
    const title = titleMap[targetType];

    if (!type || !relatedType || !title) {
      logger.warn('创建点赞通知失败：参数无效', params);
      return null;
    }

    const content = JSON.stringify({
      target_title: targetTitle,
      target_type: targetType
    });

    return this.createNotification({
      user_id: targetAuthorId,
      type,
      title,
      content,
      related_type: relatedType,
      related_id: targetId,
      sender_id: likerId
    });
  }

  /**
   * 创建系统通知
   * @param {Object} params
   * @param {number|Array<number>} params.userIds - 用户ID或用户ID数组
   * @param {string} params.type - 通知类型
   * @param {string} params.title - 通知标题
   * @param {string} params.content - 通知内容
   * @param {string} params.relatedType - 关联类型
   * @param {number} params.relatedId - 关联ID
   * @returns {Promise<number>} 创建成功的通知数量
   */
  static async createSystemNotification(params) {
    const { userIds, type, title, content, relatedType, relatedId } = params;

    const userIdArray = Array.isArray(userIds) ? userIds : [userIds];

    const notifications = userIdArray.map(userId => ({
      user_id: userId,
      type,
      title,
      content,
      related_type: relatedType,
      related_id: relatedId,
      sender_id: null
    }));

    return this.createBatchNotifications(notifications);
  }

  /**
   * 创建VIP订单通知
   * @param {Object} params
   * @param {number} params.userId - 用户ID
   * @param {number} params.orderId - 订单ID
   * @param {string} params.status - 订单状态
   * @param {string} params.orderNo - 订单号
   * @returns {Promise<Object|null>}
   */
  static async createVipOrderNotification(params) {
    const { userId, orderId, status, orderNo } = params;

    const statusTexts = {
      paid: '支付成功',
      failed: '支付失败',
      refunded: '已退款'
    };

    const title = `VIP订单${statusTexts[status] || '状态更新'}`;
    const content = JSON.stringify({
      order_no: orderNo,
      status,
      order_id: orderId
    });

    return this.createNotification({
      user_id: userId,
      type: this.TYPES.SYSTEM_VIP_ORDER,
      title,
      content,
      related_type: 'vip_order',
      related_id: orderId,
      sender_id: null
    });
  }

  /**
   * 异步创建通知（避免阻塞主业务流程）
   * @param {Object} notification - 通知数据
   * @returns {Promise<void>}
   */
  static async createNotificationAsync(notification) {
    // 使用 setImmediate 确保在下一个事件循环中执行
    setImmediate(async () => {
      try {
        await this.createNotification(notification);
      } catch (error) {
        logger.error('异步创建通知失败', {
          error: error.message,
          notification
        });
      }
    });
  }

  /**
   * 批量异步创建通知
   * @param {Array<Object>} notifications - 通知数据数组
   * @returns {Promise<void>}
   */
  static async createBatchNotificationsAsync(notifications) {
    setImmediate(async () => {
      try {
        await this.createBatchNotifications(notifications);
      } catch (error) {
        logger.error('异步批量创建通知失败', {
          error: error.message,
          count: notifications?.length || 0
        });
      }
    });
  }
}

module.exports = NotificationService;