/**
 * 邀请与佣金数据模型
 * 负责管理邀请码生成、上下级绑定以及佣金记录
 */

const { query, getClient } = require('../config/database');

class Referral {
  /**
   * 生成邀请码字符串
   */
  static generateCode(length = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      const index = Math.floor(Math.random() * chars.length);
      code += chars[index];
    }
    return code;
  }

  /**
   * 获取用户当前邀请码
   */
  static async getUserCode(userId) {
    const result = await query(
      'SELECT referral_code FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('用户不存在');
    }

    return result.rows[0].referral_code;
  }

  /**
   * 确保用户拥有邀请码，如未生成则自动生成
   */
  static async ensureCode(userId, forceNew = false) {
    const existing = await this.getUserCode(userId).catch(() => null);

    if (existing && !forceNew) {
      return existing;
    }

    let attempts = 0;
    while (attempts < 5) {
      const newCode = this.generateCode();
      try {
        const result = await query(
          `UPDATE users
           SET referral_code = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1
           RETURNING referral_code`,
          [userId, newCode]
        );

        if (result.rows.length === 0) {
          throw new Error('用户不存在');
        }

        return result.rows[0].referral_code;
      } catch (error) {
        if (error.code === '23505') {
          // 唯一约束冲突时重新生成
          attempts += 1;
          continue;
        }
        throw error;
      }
    }

    throw new Error('生成邀请码失败，请稍后重试');
  }

  /**
   * 根据邀请码查找邀请人
   */
  static async findInviterByCode(code) {
    const normalizedCode = (code || '').trim().toUpperCase();
    if (!normalizedCode) {
      return null;
    }

    const result = await query(
      `SELECT id, username, email, nickname, status,
              commission_balance, total_commission_earned
       FROM users
       WHERE referral_code = $1`,
      [normalizedCode]
    );

    return result.rows[0] || null;
  }

  /**
   * 绑定上下级关系
   */
  static async bindInviter(inviteeId, inviterId, referralCode) {
    if (inviteeId === inviterId) {
      throw new Error('不能绑定自己为上级');
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      const inviteeResult = await client.query(
        'SELECT inviter_id FROM users WHERE id = $1 FOR UPDATE',
        [inviteeId]
      );

      if (inviteeResult.rows.length === 0) {
        throw new Error('用户不存在');
      }

      if (inviteeResult.rows[0].inviter_id) {
        throw new Error('用户已绑定上级');
      }

      await client.query(
        `UPDATE users
         SET inviter_id = $1,
             invited_at = COALESCE(invited_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [inviterId, inviteeId]
      );

      await client.query(
        `INSERT INTO user_referrals (inviter_id, invitee_id, referral_code)
         VALUES ($1, $2, $3)
         ON CONFLICT (invitee_id) DO NOTHING`,
        [inviterId, inviteeId, referralCode]
      );

      await client.query('COMMIT');
      return {
        inviter_id: inviterId,
        invitee_id: inviteeId
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取邀请人的统计数据
   */
  static async getInviteStats(inviterId) {
    const [countResult, commissionResult, summary, payoutSummary] = await Promise.all([
      query(
        'SELECT COUNT(*)::INTEGER AS invite_count FROM user_referrals WHERE inviter_id = $1',
        [inviterId]
      ),
      query(
        `SELECT commission_balance, total_commission_earned
         FROM users WHERE id = $1`,
        [inviterId]
      ),
      this.getCommissionSummary(inviterId),
      this.getPayoutSummary(inviterId)
    ]);

    return {
      invite_count: countResult.rows[0]?.invite_count || 0,
      commission_balance: Number(commissionResult.rows[0]?.commission_balance || 0),
      total_commission_earned: Number(summary.total_amount || 0),
      approved_amount: Number(summary.approved_amount || 0),
      pending_amount: Number(summary.pending_amount || 0),
      total_commission: Number(summary.total_amount || 0),
      payout_processing_amount: Number(payoutSummary.processing_amount || 0),
      payout_paid_amount: Number(payoutSummary.paid_amount || 0)
    };
  }

  /**
   * 获取邀请的用户列表
   */
  static async listInvitees(inviterId, limit = 20, offset = 0) {
    const result = await query(
      `SELECT 
         u.id,
         u.username,
         u.email,
         u.nickname,
         u.created_at,
         ur.created_at AS invited_at,
         u.is_vip,
         u.vip_level,
         u.vip_expire_at
       FROM user_referrals ur
       JOIN users u ON ur.invitee_id = u.id
       WHERE ur.inviter_id = $1
       ORDER BY ur.created_at DESC
       LIMIT $2 OFFSET $3`,
      [inviterId, limit, offset]
    );

    return result.rows;
  }

  /**
   * 获取下级用户的邀请人信息
   */
  static async getInviter(inviteeId) {
    const result = await query(
      `SELECT 
         u.inviter_id,
         inviter.username AS inviter_username,
         inviter.nickname AS inviter_nickname
       FROM users u
       LEFT JOIN users inviter ON u.inviter_id = inviter.id
       WHERE u.id = $1`,
      [inviteeId]
    );

    return result.rows[0] || null;
  }

  /**
   * 判断是否存在已完成的卡密VIP订单
   */
  static async hasPaidCardKeyOrder(userId, excludeOrderId = null) {
    const params = [userId];
    let queryStr = `
      SELECT COUNT(*)::INTEGER AS order_count
      FROM vip_orders
      WHERE user_id = $1
        AND payment_method = 'card_key'
        AND status = 'paid'
    `;

    if (excludeOrderId) {
      params.push(excludeOrderId);
      queryStr += ' AND id <> $2';
    }

    const result = await query(queryStr, params);
    return result.rows[0]?.order_count > 0;
  }

  /**
   * 创建佣金记录并更新余额
   */
  static async createCommissionRecord(recordData) {
    const {
      inviterId,
      inviteeId,
      orderId,
      orderAmount,
      commissionAmount,
      commissionRate,
      eventType
    } = recordData;

    const client = recordData.client || await getClient();
    const releaseClient = !recordData.client;

    try {
      if (releaseClient) {
        await client.query('BEGIN');
      }

      const insertResult = await client.query(
        `INSERT INTO referral_commissions (
           inviter_id, invitee_id, order_id,
           order_amount, commission_amount, commission_rate,
           event_type, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
         RETURNING *`,
        [
          inviterId,
          inviteeId,
          orderId,
          orderAmount,
          commissionAmount,
          commissionRate,
          eventType
        ]
      );

      await client.query(
        `UPDATE users
         SET total_commission_earned = total_commission_earned + $2,
             commission_pending_balance = commission_pending_balance + $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [inviterId, commissionAmount]
      );

      if (releaseClient) {
        await client.query('COMMIT');
      }

      return insertResult.rows[0];
    } catch (error) {
      if (releaseClient) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (releaseClient) {
        client.release();
      }
    }
  }

  /**
   * 判断订单是否已生成过佣金记录
   */
  static async hasCommissionRecord(orderId) {
    const result = await query(
      'SELECT COUNT(*)::INTEGER AS record_count FROM referral_commissions WHERE order_id = $1',
      [orderId]
    );

    return result.rows[0]?.record_count > 0;
  }

  static async getCommissionRecords(filters = {}) {
    const {
      inviterId = null,
      limit = 20,
      offset = 0,
      eventType = null,
      status = null
    } = filters;

    const values = [];
    let conditions = 'WHERE 1=1';
    let paramIndex = 1;

    if (inviterId) {
      conditions += ` AND rc.inviter_id = $${paramIndex}`;
      values.push(inviterId);
      paramIndex += 1;
    }

    if (eventType) {
      conditions += ` AND rc.event_type = $${paramIndex}`;
      values.push(eventType);
      paramIndex += 1;
    }

    if (status) {
      conditions += ` AND rc.status = $${paramIndex}`;
      values.push(status);
      paramIndex += 1;
    }

    values.push(limit, offset);

    const queryStr = `
      SELECT 
        rc.id,
        rc.inviter_id,
        rc.invitee_id,
        rc.order_id,
        rc.order_amount,
        rc.commission_amount,
        rc.commission_rate,
        rc.event_type,
        rc.status,
        rc.created_at,
        rc.settled_at,
        rc.review_notes
      FROM referral_commissions rc
      ${conditions}
      ORDER BY rc.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await query(queryStr, values);
    return result.rows;
  }

  static async countCommissionRecords(filters = {}) {
    const {
      inviterId = null,
      eventType = null,
      status = null
    } = filters;

    const values = [];
    let conditions = 'WHERE 1=1';
    let paramIndex = 1;

    if (inviterId) {
      conditions += ` AND inviter_id = $${paramIndex}`;
      values.push(inviterId);
      paramIndex += 1;
    }

    if (eventType) {
      conditions += ` AND event_type = $${paramIndex}`;
      values.push(eventType);
      paramIndex += 1;
    }

    if (status) {
      conditions += ` AND status = $${paramIndex}`;
      values.push(status);
    }

    const result = await query(
      `SELECT COUNT(*)::INTEGER AS total FROM referral_commissions ${conditions}`,
      values
    );

    return result.rows[0]?.total || 0;
  }

  static async getCommissionSummary(inviterId) {
    const result = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'approved' THEN commission_amount ELSE 0 END), 0) AS approved_amount,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0) AS pending_amount,
         COALESCE(SUM(commission_amount), 0) AS total_amount
       FROM referral_commissions
       WHERE inviter_id = $1`,
      [inviterId]
    );

    return result.rows[0] || { approved_amount: 0, pending_amount: 0, total_amount: 0 };
  }

  static async getPayoutSummary(userId) {
    const result = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN status IN ('pending', 'approved') THEN amount ELSE 0 END), 0) AS processing_amount,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid_amount
       FROM referral_payout_requests
       WHERE user_id = $1`,
      [userId]
    );

    return result.rows[0] || { processing_amount: 0, paid_amount: 0 };
  }

  static async updateCommissionStatus(commissionId, newStatus, options = {}) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      const commissionResult = await client.query(
        'SELECT * FROM referral_commissions WHERE id = $1 FOR UPDATE',
        [commissionId]
      );

      if (commissionResult.rows.length === 0) {
        throw new Error('佣金记录不存在');
      }

      const commission = commissionResult.rows[0];
      const prevStatus = commission.status;
      const amount = Number(commission.commission_amount);
      const inviterId = commission.inviter_id;

      if (!['pending', 'approved', 'rejected', 'paid'].includes(newStatus)) {
        throw new Error('无效的佣金状态');
      }

      const balanceStatuses = ['approved'];
      const settlementStatuses = ['approved', 'no_include'];
      let balanceDelta = 0;

      if (balanceStatuses.includes(prevStatus) && !balanceStatuses.includes(newStatus)) {
        balanceDelta -= amount;
      } else if (!balanceStatuses.includes(prevStatus) && balanceStatuses.includes(newStatus)) {
        balanceDelta += amount;
      }

      let pendingDelta = 0;
      if (prevStatus === 'pending' && newStatus !== 'pending') {
        pendingDelta -= amount;
      } else if (prevStatus !== 'pending' && newStatus === 'pending') {
        pendingDelta += amount;
      }

      if (balanceDelta !== 0 || pendingDelta !== 0) {
        await client.query(
          `UPDATE users
           SET commission_balance = commission_balance + $2,
               commission_pending_balance = commission_pending_balance + $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [inviterId, balanceDelta, pendingDelta]
        );
      }

      let settledAt = commission.settled_at;
      if (settlementStatuses.includes(newStatus)) {
        settledAt = settledAt || new Date();
      } else if (newStatus === 'pending') {
        settledAt = null;
      }

      const reviewNotes = options.reviewNotes !== undefined ? options.reviewNotes : commission.review_notes;

      const updateResult = await client.query(
        `UPDATE referral_commissions
         SET status = $2,
             settled_at = $3,
             review_notes = $4
         WHERE id = $1
         RETURNING *`,
        [
          commissionId,
          newStatus,
          settledAt,
          reviewNotes
        ]
      );

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getPayoutSetting(userId) {
    const result = await query(
      `SELECT id, method, account, account_name, extra, updated_at
       FROM referral_payout_settings
       WHERE user_id = $1`,
      [userId]
    );

    return result.rows[0] || null;
  }

  static async upsertPayoutSetting(userId, payload, updatedBy = null) {
    const {
      method,
      account,
      account_name = null,
      extra = {}
    } = payload;

    const result = await query(
      `INSERT INTO referral_payout_settings (user_id, method, account, account_name, extra, updated_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT (user_id)
       DO UPDATE SET
         method = EXCLUDED.method,
         account = EXCLUDED.account,
         account_name = EXCLUDED.account_name,
         extra = EXCLUDED.extra,
         updated_at = CURRENT_TIMESTAMP,
         updated_by = EXCLUDED.updated_by
       RETURNING *`,
      [userId, method, account, account_name, JSON.stringify(extra || {}), updatedBy]
    );

    return result.rows[0];
  }

  static async createPayoutRequest(userId, payload, operatorId = null) {
    const {
      amount,
      method = null,
      account = null,
      account_name = null,
      extra = {},
      requested_notes = null
    } = payload;

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      throw new Error('提现金额必须大于0');
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      const balanceResult = await client.query(
        'SELECT commission_balance FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (balanceResult.rows.length === 0) {
        throw new Error('用户不存在');
      }

      const balance = Number(balanceResult.rows[0].commission_balance || 0);
      if (numericAmount > balance) {
        throw new Error('可提现余额不足');
      }

      let finalMethod = method;
      let finalAccount = account;
      let finalAccountName = account_name;
      let finalExtra = extra || {};

      if (!finalMethod || !finalAccount) {
        const settingResult = await client.query(
          `SELECT method, account, account_name, extra
           FROM referral_payout_settings
           WHERE user_id = $1`,
          [userId]
        );

        if (settingResult.rows.length === 0) {
          throw new Error('请先配置提现账号');
        }

        const setting = settingResult.rows[0];
        if (!finalMethod) finalMethod = setting.method;
        if (!finalAccount) finalAccount = setting.account;
        if (!finalAccountName) finalAccountName = setting.account_name;
        if ((!extra || Object.keys(extra).length === 0) && setting.extra) {
          finalExtra = setting.extra;
        }
      }

      if (!finalMethod || !finalAccount) {
        throw new Error('提现方式或账号不能为空');
      }

      const insertResult = await client.query(
        `INSERT INTO referral_payout_requests
           (user_id, amount, method, account, account_name, extra, requested_notes)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
         RETURNING *`,
        [userId, numericAmount, finalMethod, finalAccount, finalAccountName, JSON.stringify(finalExtra || {}), requested_notes]
      );

      await client.query(
        `UPDATE users
         SET commission_balance = commission_balance - $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [userId, numericAmount]
      );

      await client.query('COMMIT');
      return insertResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getPayoutRequests(filters = {}) {
    const {
      userId = null,
      limit = 20,
      offset = 0,
      status = null
    } = filters;

    const values = [];
    let conditions = 'WHERE 1=1';
    let paramIndex = 1;

    if (userId) {
      conditions += ` AND pr.user_id = $${paramIndex}`;
      values.push(userId);
      paramIndex += 1;
    }

    if (status) {
      conditions += ` AND pr.status = $${paramIndex}`;
      values.push(status);
      paramIndex += 1;
    }

    values.push(limit, offset);

    const queryStr = `
      SELECT
        pr.*, u.username, u.email
      FROM referral_payout_requests pr
      JOIN users u ON pr.user_id = u.id
      ${conditions}
      ORDER BY pr.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await query(queryStr, values);
    return result.rows;
  }

  static async countPayoutRequests(filters = {}) {
    const {
      userId = null,
      status = null
    } = filters;

    const values = [];
    let conditions = 'WHERE 1=1';
    let paramIndex = 1;

    if (userId) {
      conditions += ` AND user_id = $${paramIndex}`;
      values.push(userId);
      paramIndex += 1;
    }

    if (status) {
      conditions += ` AND status = $${paramIndex}`;
      values.push(status);
    }

    const result = await query(
      `SELECT COUNT(*)::INTEGER AS total FROM referral_payout_requests ${conditions}`,
      values
    );

    return result.rows[0]?.total || 0;
  }

  static async updatePayoutRequestStatus(requestId, newStatus, reviewerId, options = {}) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      const requestResult = await client.query(
        'SELECT * FROM referral_payout_requests WHERE id = $1 FOR UPDATE',
        [requestId]
      );

      if (requestResult.rows.length === 0) {
        throw new Error('提现申请不存在');
      }

      const request = requestResult.rows[0];
      const validStatuses = ['pending', 'approved', 'rejected', 'paid'];
      if (!validStatuses.includes(newStatus)) {
        throw new Error('无效的提现状态');
      }

      const currentStatus = request.status;
      const amount = Number(request.amount);

      if (currentStatus === 'paid') {
        throw new Error('已打款的提现申请不可修改');
      }

      if (currentStatus === 'pending' && newStatus === 'pending') {
        throw new Error('状态未发生变化');
      }

      if (currentStatus === 'approved' && newStatus === 'pending') {
        throw new Error('已审批的提现申请不可重新置为待审批');
      }

      if (currentStatus === 'rejected' && newStatus !== 'rejected') {
        throw new Error('已驳回的提现申请不可再次处理');
      }

      if (currentStatus !== 'approved' && newStatus === 'paid') {
        throw new Error('请先审批通过再标记打款');
      }

      if (currentStatus === 'approved' && newStatus === 'approved') {
        throw new Error('状态未发生变化');
      }

      if (currentStatus === 'pending' && newStatus === 'rejected') {
        await client.query(
          `UPDATE users
           SET commission_balance = commission_balance + $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [request.user_id, amount]
        );
      }

      let paidAt = request.paid_at;
      if (newStatus === 'paid') {
        paidAt = new Date();
      }

      const updateResult = await client.query(
        `UPDATE referral_payout_requests
         SET status = $2,
             review_notes = COALESCE($3, review_notes),
             reviewed_at = CURRENT_TIMESTAMP,
             reviewed_by = $4,
             paid_at = $5
         WHERE id = $1
         RETURNING *`,
        [
          requestId,
          newStatus,
          options.reviewNotes || null,
          reviewerId,
          paidAt
        ]
      );

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Referral;
