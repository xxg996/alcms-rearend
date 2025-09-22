/**
 * 卡密系统数据模型
 * 处理卡密生成、兑换、查询等相关数据操作
 */

const { query, getClient } = require('../config/database');
const crypto = require('crypto');

class CardKey {
  /**
   * 生成卡密代码
   */
  static generateCode(length = 16) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆字符
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // 格式化为 XXXX-XXXX-XXXX-XXXX
    return result.match(/.{1,4}/g).join('-');
  }

  /**
   * 生成批次ID
   */
  static generateBatchId() {
    return 'BATCH_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  /**
   * 计算卡密价值
   */
  static async calculateCardValue(cardData) {
    const { type, vip_level, vip_days, points } = cardData;

    let value = 0;

    if (type === 'vip' && vip_level > 0) {
      // 获取VIP等级配置
      const VIP = require('./VIP');
      const vipLevel = await VIP.getLevelById(vip_level);

      if (vipLevel && vipLevel.price) {
        // 按天数比例计算价值
        const basePrice = Number(vipLevel.price) || 0;
        const baseDays = 30; // 基础价格通常按30天计算
        value = basePrice * (vip_days / baseDays);
      }
    } else if (type === 'points' && points > 0) {
      // 积分卡密，可以设置积分兑换比例（比如100积分=1元）
      const pointsToMoneyRate = 0.01; // 1积分=0.01元，可配置
      value = points * pointsToMoneyRate;
    }

    return Number(value.toFixed(2));
  }

  /**
   * 创建单个卡密
   */
  static async createCardKey(cardData, createdBy = null) {
    const {
      type = 'vip',
      vip_level = 1,
      vip_days = 30,
      points = 0,
      expire_at = null,
      batch_id = null,
      value_amount = null
    } = cardData;

    const code = this.generateCode();

    // 如果没有指定价值金额，自动计算
    let finalValueAmount = value_amount;
    if (finalValueAmount === null) {
      finalValueAmount = await this.calculateCardValue(cardData);
    }

    const queryStr = `
      INSERT INTO card_keys
      (code, type, vip_level, vip_days, points, expire_at, batch_id, created_by, value_amount)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const values = [code, type, vip_level, vip_days, points, expire_at, batch_id, createdBy, finalValueAmount];
    const result = await query(queryStr, values);
    return result.rows[0];
  }

  /**
   * 批量生成卡密
   */
  static async createBatchCardKeys(cardData, count, createdBy = null) {
    const batchId = this.generateBatchId();
    const cardKeys = [];
    const client = await getClient();

    try {
      await client.query('BEGIN');

      for (let i = 0; i < count; i++) {
        const cardKey = await this.createCardKey({
          ...cardData,
          batch_id: batchId
        }, createdBy);
        cardKeys.push(cardKey);
      }

      await client.query('COMMIT');
      return {
        batch_id: batchId,
        count: cardKeys.length,
        card_keys: cardKeys
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 根据代码查询卡密
   */
  static async getByCode(code) {
    const queryStr = `
      SELECT 
        ck.*,
        u.username as used_by_username,
        c.username as created_by_username
      FROM card_keys ck
      LEFT JOIN users u ON ck.used_by = u.id
      LEFT JOIN users c ON ck.created_by = c.id
      WHERE ck.code = $1
    `;
    const result = await query(queryStr, [code]);
    return result.rows[0];
  }

  /**
   * 兑换卡密
   */
  static async redeemCardKey(code, userId) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');

      // 查询卡密信息
      const cardKey = await this.getByCode(code);
      if (!cardKey) {
        throw new Error('卡密不存在');
      }

      if (cardKey.status !== 'unused') {
        throw new Error('卡密已被使用或已失效');
      }

      // 检查卡密是否过期
      if (cardKey.expire_at && new Date(cardKey.expire_at) < new Date()) {
        throw new Error('卡密已过期');
      }

      // 标记卡密为已使用
      const updateQueryStr = `
        UPDATE card_keys 
        SET status = 'used', used_by = $2, used_at = CURRENT_TIMESTAMP
        WHERE code = $1
        RETURNING *
      `;
      await client.query(updateQueryStr, [code, userId]);

      // 根据卡密类型执行相应操作
      let result = { cardKey };

      if (cardKey.type === 'vip') {
        // 设置或延长VIP
        const VIP = require('./VIP');
        const user = await VIP.getUserVIPInfo(userId);

        let vipOperationResult;
        if (user.is_vip && user.vip_level >= cardKey.vip_level) {
          // 如果用户已经是VIP且等级不低于卡密等级，则延长时间
          vipOperationResult = await VIP.extendUserVIP(userId, cardKey.vip_days);
        } else {
          // 设置新的VIP等级
          vipOperationResult = await VIP.setUserVIP(userId, cardKey.vip_level, cardKey.vip_days);
        }

        // 过滤敏感信息，只返回必要的字段
        result.vipResult = {
          id: vipOperationResult.id,
          username: vipOperationResult.username,
          is_vip: vipOperationResult.is_vip,
          vip_level: vipOperationResult.vip_level,
          vip_expire_at: vipOperationResult.vip_expire_at,
          vip_activated_at: vipOperationResult.vip_activated_at
        };

        const orderPrice = await VIP.calculateCardKeyPrice(cardKey);

        // 创建订单记录
        const orderData = {
          user_id: userId,
          vip_level: cardKey.vip_level,
          price: orderPrice,
          duration_days: cardKey.vip_days,
          payment_method: 'card_key',
          order_no: 'CARD_' + Date.now() + '_' + userId,
          card_key_code: code
        };
        const createdOrder = await VIP.createOrder(orderData);
        result.order = await VIP.updateOrderStatus(createdOrder.id, 'paid');
      }

      if (cardKey.type === 'points' && cardKey.points > 0) {
        // 添加积分
        const Points = require('./Points');
        result.pointsResult = await Points.addPoints(
          userId,
          cardKey.points,
          'card_key',
          `兑换卡密获得${cardKey.points}积分`,
          cardKey.id,
          'card_key'
        );

        // 为积分卡密也创建订单记录
        const VIP = require('./VIP');
        const orderData = {
          user_id: userId,
          vip_level: 0, // 积分卡密VIP等级为0
          price: cardKey.value_amount || 0,
          duration_days: 0, // 积分卡密持续天数为0
          payment_method: 'card_key',
          order_no: 'CARD_POINTS_' + Date.now() + '_' + userId,
          card_key_code: code
        };
        const createdOrder = await VIP.createOrder(orderData);
        result.order = await VIP.updateOrderStatus(createdOrder.id, 'paid');
      }

      // 处理佣金分配（如果卡密有价值且用户有邀请人）
      if (cardKey.value_amount > 0 && result.order) {
        try {
          const { services } = require('../services');
          result.commission = await services.referral.processCommission(userId, result.order, cardKey, 'card_redeem');
        } catch (commissionError) {
          // 佣金处理失败不影响卡密兑换，只记录日志
          const { logger } = require('../utils/logger');
          logger.error('卡密兑换佣金处理失败:', commissionError);
          result.commission = null;
        }
      }

      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取卡密列表
   */
  static async getCardKeys(options = {}) {
    const {
      status = null,
      type = null,
      batch_id = null,
      created_by = null,
      limit = 20,
      offset = 0
    } = options;

    let whereConditions = [];
    let values = [];
    let paramCount = 1;

    if (status) {
      whereConditions.push(`ck.status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (type) {
      whereConditions.push(`ck.type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }

    if (batch_id) {
      whereConditions.push(`ck.batch_id = $${paramCount}`);
      values.push(batch_id);
      paramCount++;
    }

    if (created_by) {
      whereConditions.push(`ck.created_by = $${paramCount}`);
      values.push(created_by);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // 获取总数
    const countQueryStr = `
      SELECT COUNT(*) as total
      FROM card_keys ck
      ${whereClause}
    `;
    const countResult = await query(countQueryStr, values.slice(0, paramCount - 1));
    const total = parseInt(countResult.rows[0].total);

    // 获取分页数据
    values.push(limit, offset);
    const queryStr = `
      SELECT
        ck.*,
        u.username as used_by_username,
        c.username as created_by_username
      FROM card_keys ck
      LEFT JOIN users u ON ck.used_by = u.id
      LEFT JOIN users c ON ck.created_by = c.id
      ${whereClause}
      ORDER BY ck.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const result = await query(queryStr, values);

    return {
      data: result.rows,
      pagination: {
        total,
        limit,
        offset,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: offset > 0
      }
    };
  }

  /**
   * 获取卡密统计信息
   */
  static async getStatistics(batchId = null) {
    let whereClause = '';
    let values = [];

    if (batchId) {
      whereClause = 'WHERE batch_id = $1';
      values.push(batchId);
    }

    const queryStr = `
      SELECT 
        type,
        status,
        COUNT(*) as count
      FROM card_keys
      ${whereClause}
      GROUP BY type, status
      ORDER BY type, status
    `;

    const result = await query(queryStr, values);
    return result.rows;
  }

  /**
   * 获取批次列表
   */
  static async getBatches(createdBy = null, limit = 20, offset = 0) {
    let whereClause = 'WHERE ck.batch_id IS NOT NULL';
    let values = [];
    let paramCount = 1;

    if (createdBy) {
      whereClause += ' AND ck.created_by = $1';
      values.push(createdBy);
      paramCount = 2;
    }

    // 获取批次总数
    const countQueryStr = `
      SELECT COUNT(DISTINCT ck.batch_id) as total
      FROM card_keys ck
      LEFT JOIN users c ON ck.created_by = c.id
      ${whereClause}
    `;
    const countResult = await query(countQueryStr, values.slice(0, paramCount - 1));
    const total = parseInt(countResult.rows[0].total);

    // 获取分页数据
    values.push(limit, offset);

    const queryStr = `
      SELECT
        ck.batch_id,
        ck.type,
        ck.vip_level,
        ck.vip_days,
        ck.points,
        COUNT(*) as total_count,
        COUNT(CASE WHEN ck.status = 'unused' THEN 1 END) as unused_count,
        COUNT(CASE WHEN ck.status = 'used' THEN 1 END) as used_count,
        MIN(ck.created_at) as created_at,
        c.username as created_by_username
      FROM card_keys ck
      LEFT JOIN users c ON ck.created_by = c.id
      ${whereClause}
      GROUP BY ck.batch_id, ck.type, ck.vip_level, ck.vip_days, ck.points, c.username
      ORDER BY MIN(ck.created_at) DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const result = await query(queryStr, values);

    return {
      data: result.rows,
      pagination: {
        total,
        limit,
        offset,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: offset > 0
      }
    };
  }

  /**
   * 更新卡密状态
   */
  static async updateStatus(id, status) {
    const queryStr = `
      UPDATE card_keys 
      SET status = $2
      WHERE id = $1
      RETURNING *
    `;
    const result = await query(queryStr, [id, status]);
    return result.rows[0];
  }

  /**
   * 删除卡密
   */
  static async deleteCardKey(id) {
    const queryStr = `
      DELETE FROM card_keys 
      WHERE id = $1 AND status = 'unused'
      RETURNING *
    `;
    const result = await query(queryStr, [id]);
    return result.rows[0];
  }

  /**
   * 删除整个批次
   */
  static async deleteBatch(batchId) {
    const queryStr = `
      DELETE FROM card_keys 
      WHERE batch_id = $1 AND status = 'unused'
      RETURNING *
    `;
    const result = await query(queryStr, [batchId]);
    return result.rows;
  }
}

module.exports = CardKey;
