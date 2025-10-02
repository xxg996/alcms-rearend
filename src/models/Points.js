/**
 * 积分系统数据模型
 * 处理用户积分管理、积分记录等相关数据操作
 */

const { query, getClient } = require('../config/database');
const AuditLog = require('./AuditLog');
const { logger } = require('../utils/logger');

class Points {
  /**
   * 获取用户积分信息
   */
  static async getUserPoints(userId) {
    const queryStr = `
      SELECT 
        id,
        username,
        points,
        total_points,
        created_at
      FROM users 
      WHERE id = $1
    `;
    const result = await query(queryStr, [userId]);
    return result.rows[0];
  }

  /**
   * 增加用户积分
   */
  static async addPoints(userId, amount, source, description = '', relatedId = null, relatedType = null, operatorId = null) {
    if (typeof amount === 'object' && amount !== null) {
      const opts = amount;
      return this.addPoints(
        userId,
        opts.points,
        opts.source,
        opts.description || '',
        opts.reference_id || null,
        opts.reference_type || null,
        opts.operator_id || operatorId || null
      );
    }
    const client = await getClient();
    
    try {
      await client.query('BEGIN');

      // 获取当前积分
      const userQuery = 'SELECT points, total_points FROM users WHERE id = $1';
      const userResult = await client.query(userQuery, [userId]);
      
      if (userResult.rows.length === 0) {
        throw new Error('用户不存在');
      }

      const currentPoints = userResult.rows[0].points || 0;
      const currentTotalPoints = userResult.rows[0].total_points || 0;
      const newPoints = currentPoints + amount;
      const newTotalPoints = currentTotalPoints + amount;

      if (newPoints < 0) {
        throw new Error('积分余额不足');
      }

      // 更新用户积分
      const updateQuery = `
        UPDATE users 
        SET points = $2, total_points = $3
        WHERE id = $1
        RETURNING points, total_points
      `;
      const updateResult = await client.query(updateQuery, [userId, newPoints, newTotalPoints]);

      // 记录积分变更
      const recordQuery = `
        INSERT INTO points_records 
        (user_id, type, amount, source, description, related_id, related_type, balance_before, balance_after)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const recordValues = [
        userId, 
        'earn', 
        amount, 
        source, 
        description, 
        relatedId, 
        relatedType, 
        currentPoints, 
        newPoints
      ];
      const recordResult = await client.query(recordQuery, recordValues);

      await AuditLog.createPointsLog({
        userId,
        operatorId,
        changeAmount: amount,
        balanceBefore: currentPoints,
        balanceAfter: newPoints,
        source,
        description,
        relatedId,
        relatedType
      }, client);

      await client.query('COMMIT');
      
      return {
        user: updateResult.rows[0],
        record: recordResult.rows[0]
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 扣除用户积分
   */
  static async deductPoints(userId, amount, source, description = '', relatedId = null, relatedType = null, operatorId = null, clientArg = null) {
    if (typeof amount === 'object' && amount !== null) {
      const opts = amount;
      return this.deductPoints(
        userId,
        opts.points,
        opts.source,
        opts.description || '',
        opts.reference_id || opts.related_id || null,
        opts.reference_type || opts.related_type || null,
        opts.operator_id || operatorId || null,
        opts.client || clientArg || null
      );
    }

    let client = clientArg;
    let releaseClient = false;

    if (!client) {
      client = await getClient();
      releaseClient = true;
    }
    
    try {
      if (releaseClient) {
        await client.query('BEGIN');
      }

      // 获取当前积分
      const userQuery = 'SELECT points FROM users WHERE id = $1';
      const userResult = await client.query(userQuery, [userId]);
      
      if (userResult.rows.length === 0) {
        throw new Error('用户不存在');
      }

      const currentPoints = userResult.rows[0].points || 0;
      if (currentPoints < amount) {
        throw new Error('积分余额不足');
      }

      const newPoints = currentPoints - amount;

      // 更新用户积分
      const updateQuery = `
        UPDATE users 
        SET points = $2
        WHERE id = $1
        RETURNING points, total_points
      `;
      const updateResult = await client.query(updateQuery, [userId, newPoints]);

      // 记录积分变更
      const recordQuery = `
        INSERT INTO points_records 
        (user_id, type, amount, source, description, related_id, related_type, balance_before, balance_after)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const recordValues = [
        userId, 
        'spend', 
        -amount, 
        source, 
        description, 
        relatedId, 
        relatedType, 
        currentPoints, 
        newPoints
      ];
      const recordResult = await client.query(recordQuery, recordValues);

      await AuditLog.createPointsLog({
        userId,
        operatorId,
        changeAmount: -amount,
        balanceBefore: currentPoints,
        balanceAfter: newPoints,
        source,
        description,
        relatedId,
        relatedType
      }, client);

      if (releaseClient) {
        await client.query('COMMIT');
      }
      
      return {
        user: updateResult.rows[0],
        record: recordResult.rows[0]
      };
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
   * 管理员调整用户积分
   */
  static async adjustPoints(userId, amount, description = '', adminId = null) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');

      // 获取当前积分
      const userQuery = 'SELECT points, total_points FROM users WHERE id = $1';
      const userResult = await client.query(userQuery, [userId]);
      
      if (userResult.rows.length === 0) {
        throw new Error('用户不存在');
      }

      const currentPoints = userResult.rows[0].points || 0;
      const currentTotalPoints = userResult.rows[0].total_points || 0;
      const newPoints = Math.max(0, currentPoints + amount); // 确保积分不为负数
      const newTotalPoints = amount > 0 ? currentTotalPoints + amount : currentTotalPoints;

      // 更新用户积分
      const updateQuery = `
        UPDATE users 
        SET points = $2, total_points = $3
        WHERE id = $1
        RETURNING points, total_points
      `;
      const updateResult = await client.query(updateQuery, [userId, newPoints, newTotalPoints]);

      // 记录积分变更
      const recordQuery = `
        INSERT INTO points_records 
        (user_id, type, amount, source, description, related_id, related_type, balance_before, balance_after)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const recordValues = [
        userId, 
        'admin_adjust', 
        amount, 
        'admin', 
        description, 
        adminId, 
        'admin_user', 
        currentPoints, 
        newPoints
      ];
      const recordResult = await client.query(recordQuery, recordValues);

      await AuditLog.createPointsLog({
        userId,
        operatorId: adminId,
        changeAmount: amount,
        balanceBefore: currentPoints,
        balanceAfter: newPoints,
        source: 'admin_adjust',
        description,
        relatedId: adminId,
        relatedType: 'admin_user'
      }, client);

      await client.query('COMMIT');
      
      return {
        user: updateResult.rows[0],
        record: recordResult.rows[0]
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取用户积分记录
   */
  static async getUserPointsRecords(userId, limit = 20, offset = 0) {
    const queryStr = `
      SELECT 
        pr.*,
        u.username
      FROM points_records pr
      LEFT JOIN users u ON pr.user_id = u.id
      WHERE pr.user_id = $1
      ORDER BY pr.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await query(queryStr, [userId, limit, offset]);
    return result.rows;
  }

  /**
   * 获取积分记录统计
   */
  static async getPointsStatistics(userId = null, dateFrom = null, dateTo = null) {
    let whereConditions = [];
    let values = [];
    let paramCount = 1;

    if (userId) {
      whereConditions.push(`user_id = $${paramCount}`);
      values.push(userId);
      paramCount++;
    }

    if (dateFrom) {
      whereConditions.push(`created_at >= $${paramCount}`);
      values.push(dateFrom);
      paramCount++;
    }

    if (dateTo) {
      whereConditions.push(`created_at <= $${paramCount}`);
      values.push(dateTo);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    const queryStr = `
      SELECT 
        type,
        source,
        COUNT(*) as count,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_earned,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_spent
      FROM points_records
      ${whereClause}
      GROUP BY type, source
      ORDER BY type, source
    `;

    const result = await query(queryStr, values);
    return result.rows;
  }

  /**
   * 获取积分排行榜
   */
  static async getPointsLeaderboard(type = 'current', limit = 50) {
    const pointsField = type === 'total' ? 'total_points' : 'points';
    
    const queryStr = `
      SELECT 
        id,
        username,
        nickname,
        points,
        total_points,
        ROW_NUMBER() OVER (ORDER BY ${pointsField} DESC) as rank
      FROM users 
      WHERE status = 'normal' AND ${pointsField} > 0
      ORDER BY ${pointsField} DESC
      LIMIT $1
    `;
    const result = await query(queryStr, [limit]);
    return result.rows;
  }

  /**
   * 获取用户积分排名
   */
  static async getUserPointsRank(userId, type = 'current') {
    const pointsField = type === 'total' ? 'total_points' : 'points';
    
    const queryStr = `
      WITH ranked_users AS (
        SELECT 
          id,
          username,
          points,
          total_points,
          ROW_NUMBER() OVER (ORDER BY ${pointsField} DESC) as rank
        FROM users 
        WHERE status = 'normal' AND ${pointsField} > 0
      )
      SELECT * FROM ranked_users WHERE id = $1
    `;
    const result = await query(queryStr, [userId]);
    return result.rows[0];
  }

  /**
   * 批量转移积分（管理员功能）
   */
  static async transferPointsBatch(transfers, adminId) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      const results = [];

      for (const transfer of transfers) {
        const { fromUserId, toUserId, amount, description } = transfer;

        // 扣除发送方积分
        await this.deductPoints(fromUserId, amount, 'transfer_out', `转账给用户${toUserId}: ${description}`, toUserId, 'transfer');
        
        // 增加接收方积分
        const result = await this.addPoints(toUserId, amount, 'transfer_in', `来自用户${fromUserId}: ${description}`, fromUserId, 'transfer');
        
        results.push({
          from: fromUserId,
          to: toUserId,
          amount,
          result
        });
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 系统批量发放积分
   */
  static async batchGrantPoints(userIds, amount, source, description = '') {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      const results = [];

      for (const userId of userIds) {
        try {
          const result = await this.addPoints(userId, amount, source, description);
          results.push({
            userId,
            success: true,
            result
          });
        } catch (error) {
          results.push({
            userId,
            success: false,
            error: error.message
          });
        }
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Points;
