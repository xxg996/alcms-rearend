/**
 * VIP系统数据模型
 * 处理VIP等级、购买记录等相关数据操作
 */

const { query } = require('../config/database');
const User = require('./User');

class VIP {
  /**
   * 获取所有VIP等级配置
   * @param {boolean} includeInactive - 是否包含禁用的配置
   */
  static async getAllLevels(includeInactive = false) {
    let queryStr = `
      SELECT * FROM vip_levels
    `;

    if (!includeInactive) {
      queryStr += ` WHERE is_active = true`;
    }

    queryStr += ` ORDER BY level ASC`;

    const result = await query(queryStr);
    return result.rows;
  }

  /**
   * 根据等级获取VIP配置
   */
  static async getLevelById(level) {
    const queryStr = `
      SELECT * FROM vip_levels 
      WHERE level = $1 AND is_active = true
    `;
    const result = await query(queryStr, [level]);
    return result.rows[0];
  }

  /**
   * 创建VIP等级配置
   */
  static async createLevel(levelData) {
    const {
      level,
      name,
      display_name,
      description,
      benefits,
      price,
      duration_days
    } = levelData;

    const queryStr = `
      INSERT INTO vip_levels (level, name, display_name, description, benefits, price, duration_days)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [level, name, display_name, description, benefits, price, duration_days];
    const result = await query(queryStr, values);
    return result.rows[0];
  }

  /**
   * 更新VIP等级配置
   */
  static async updateLevel(level, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('没有提供更新数据');
    }

    values.push(level);
    const queryStr = `
      UPDATE vip_levels 
      SET ${fields.join(', ')}
      WHERE level = $${paramCount}
      RETURNING *
    `;

    const result = await query(queryStr, values);
    return result.rows[0];
  }

  /**
   * 切换VIP等级状态（启用/禁用）
   */
  static async toggleLevelStatus(level) {
    const queryStr = `
      UPDATE vip_levels
      SET is_active = NOT is_active
      WHERE level = $1
      RETURNING *
    `;
    const result = await query(queryStr, [level]);
    return result.rows[0];
  }

  /**
   * 设置VIP等级状态
   */
  static async setLevelStatus(level, isActive) {
    const queryStr = `
      UPDATE vip_levels
      SET is_active = $2
      WHERE level = $1
      RETURNING *
    `;
    const result = await query(queryStr, [level, isActive]);
    return result.rows[0];
  }

  /**
   * 删除VIP等级配置（软删除）
   */
  static async deleteLevel(level) {
    const queryStr = `
      UPDATE vip_levels
      SET is_active = false
      WHERE level = $1
      RETURNING *
    `;
    const result = await query(queryStr, [level]);
    return result.rows[0];
  }

  /**
   * 获取用户VIP信息
   */
  static async getUserVIPInfo(userId) {
    const queryStr = `
      SELECT 
        u.id,
        u.username,
        u.is_vip,
        u.vip_level,
        u.vip_expire_at,
        u.vip_activated_at,
        vl.name as vip_name,
        vl.display_name as vip_display_name,
        vl.benefits as vip_benefits
      FROM users u
      LEFT JOIN vip_levels vl ON u.vip_level = vl.level
      WHERE u.id = $1
    `;
    const result = await query(queryStr, [userId]);
    return result.rows[0];
  }

  /**
   * 为用户设置VIP
   */
  static async setUserVIP(userId, vipLevel, days = 30) {
    let expireAt = null;

    // 如果days为0，表示无限期VIP
    if (days > 0) {
      expireAt = new Date();
      expireAt.setDate(expireAt.getDate() + days);
    }

    const queryStr = `
      UPDATE users
      SET
        is_vip = true,
        vip_level = $2,
        vip_expire_at = $3,
        vip_activated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await query(queryStr, [userId, vipLevel, expireAt]);

    // 自动分配VIP角色
    try {
      await User.assignRole(userId, 'vip');
    } catch (error) {
      // 如果角色已存在或其他错误，记录但不影响主流程
      console.warn(`为用户 ${userId} 分配VIP角色失败:`, error.message);
    }

    return result.rows[0];
  }

  /**
   * 延长用户VIP时间
   */
  static async extendUserVIP(userId, days) {
    // 如果days为0，设置为无限期
    if (days === 0) {
      const queryStr = `
        UPDATE users
        SET vip_expire_at = NULL
        WHERE id = $1
        RETURNING *
      `;
      const result = await query(queryStr, [userId]);

      // 确保用户有VIP角色
      try {
        await User.assignRole(userId, 'vip');
      } catch (error) {
        console.warn(`为用户 ${userId} 分配VIP角色失败:`, error.message);
      }

      return result.rows[0];
    }

    const queryStr = `
      UPDATE users
      SET vip_expire_at = CASE
        WHEN vip_expire_at IS NULL OR vip_expire_at < CURRENT_TIMESTAMP
        THEN CURRENT_TIMESTAMP + INTERVAL '${days} days'
        ELSE vip_expire_at + INTERVAL '${days} days'
      END
      WHERE id = $1
      RETURNING *
    `;
    const result = await query(queryStr, [userId]);

    // 确保用户有VIP角色
    try {
      await User.assignRole(userId, 'vip');
    } catch (error) {
      console.warn(`为用户 ${userId} 分配VIP角色失败:`, error.message);
    }

    return result.rows[0];
  }

  /**
   * 取消用户VIP
   */
  static async cancelUserVIP(userId) {
    const queryStr = `
      UPDATE users
      SET
        is_vip = false,
        vip_level = 0,
        vip_expire_at = NULL
      WHERE id = $1
      RETURNING *
    `;
    const result = await query(queryStr, [userId]);

    // 移除VIP角色
    try {
      await User.removeRole(userId, 'vip');
    } catch (error) {
      // 如果用户没有VIP角色或其他错误，记录但不影响主流程
      console.warn(`为用户 ${userId} 移除VIP角色失败:`, error.message);
    }

    return result.rows[0];
  }

  /**
   * 检查并更新过期的VIP用户
   */
  static async updateExpiredVIP() {
    const queryStr = `
      UPDATE users
      SET is_vip = false, vip_level = 0
      WHERE is_vip = true
        AND vip_expire_at IS NOT NULL
        AND vip_expire_at < CURRENT_TIMESTAMP
      RETURNING id, username, vip_expire_at
    `;
    const result = await query(queryStr);

    // 为所有过期的VIP用户移除VIP角色
    for (const expiredUser of result.rows) {
      try {
        await User.removeRole(expiredUser.id, 'vip');
      } catch (error) {
        console.warn(`为过期用户 ${expiredUser.id} 移除VIP角色失败:`, error.message);
      }
    }

    return result.rows;
  }

  /**
   * 创建VIP购买订单
   */
  static async createOrder(orderData) {
    const {
      user_id,
      vip_level,
      price,
      duration_days,
      payment_method,
      order_no,
      card_key_code
    } = orderData;

    let expireAt = null;
    if (duration_days > 0) {
      expireAt = new Date();
      expireAt.setDate(expireAt.getDate() + duration_days);
    }

    const queryStr = `
      INSERT INTO vip_orders 
      (user_id, vip_level, price, duration_days, expire_at, payment_method, order_no, card_key_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [user_id, vip_level, price, duration_days, expireAt, payment_method, order_no, card_key_code];
    const result = await query(queryStr, values);
    return result.rows[0];
  }

  /**
   * 更新订单状态
   */
  static async updateOrderStatus(orderId, status) {
    const queryStr = `
      UPDATE vip_orders 
      SET status = $2
      WHERE id = $1
      RETURNING *
    `;
    const result = await query(queryStr, [orderId, status]);
    return result.rows[0];
  }

  /**
   * 获取用户订单历史
   */
  static async getUserOrders(userId, limit = 10, offset = 0) {
    const queryStr = `
      SELECT 
        vo.*,
        vl.name as vip_name,
        vl.display_name as vip_display_name
      FROM vip_orders vo
      LEFT JOIN vip_levels vl ON vo.vip_level = vl.level
      WHERE vo.user_id = $1
      ORDER BY vo.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await query(queryStr, [userId, limit, offset]);
    return result.rows;
  }

  /**
   * 获取订单详情
   */
  static async getOrderById(orderId) {
    const queryStr = `
      SELECT 
        vo.*,
        u.username,
        u.email,
        vl.name as vip_name,
        vl.display_name as vip_display_name
      FROM vip_orders vo
      LEFT JOIN users u ON vo.user_id = u.id
      LEFT JOIN vip_levels vl ON vo.vip_level = vl.level
      WHERE vo.id = $1
    `;
    const result = await query(queryStr, [orderId]);
    return result.rows[0];
  }
}

module.exports = VIP;
