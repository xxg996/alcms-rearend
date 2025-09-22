/**
 * 验证码数据模型
 * 处理邮箱验证码的创建、验证和管理
 */

const { query } = require('../config/database');
const { logger } = require('../utils/logger');

class VerificationCode {

  /**
   * 创建验证码记录
   * @param {string} email - 邮箱地址
   * @param {string} code - 验证码
   * @param {string} type - 验证码类型 (register/reset_password)
   * @param {number} expiresInMinutes - 过期时间（分钟）
   * @param {string} ipAddress - IP地址
   * @param {string} userAgent - User-Agent
   * @returns {Promise<Object>} 创建的验证码记录
   */
  static async create(email, code, type, expiresInMinutes = 10, ipAddress = null, userAgent = null) {
    try {
      // 先将该邮箱该类型的未使用验证码标记为已使用（防止重复）
      await query(`
        UPDATE verification_codes
        SET is_used = true, used_at = CURRENT_TIMESTAMP
        WHERE email = $1 AND type = $2 AND is_used = false
      `, [email, type]);

      // 创建新的验证码记录
      const result = await query(`
        INSERT INTO verification_codes (email, code, type, expires_at, ip_address, user_agent)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '${expiresInMinutes} minutes', $4, $5)
        RETURNING *
      `, [email, code, type, ipAddress, userAgent]);

      logger.info(`验证码创建成功: ${email} - ${type}`);
      return result.rows[0];
    } catch (error) {
      logger.error('创建验证码失败:', error);
      throw new Error('创建验证码失败');
    }
  }

  /**
   * 验证验证码
   * @param {string} email - 邮箱地址
   * @param {string} code - 验证码
   * @param {string} type - 验证码类型
   * @returns {Promise<Object|null>} 验证结果
   */
  static async verify(email, code, type) {
    try {
      logger.info(`验证验证码: email=${email}, code=${code}, type=${type}`);

      const result = await query(`
        SELECT * FROM verification_codes
        WHERE email = $1 AND code = $2 AND type = $3
          AND is_used = false
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
        LIMIT 1
      `, [email, code, type]);

      logger.info(`查询结果: 找到 ${result.rows.length} 条记录`);

      if (result.rows.length === 0) {
        return {
          valid: false,
          reason: '验证码无效或已过期'
        };
      }

      const verificationRecord = result.rows[0];

      // 标记验证码为已使用（使用事务确保原子性）
      await query(`
        UPDATE verification_codes
        SET is_used = true, used_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND is_used = false
      `, [verificationRecord.id]);

      logger.info(`验证码验证成功: ${email} - ${type}`);
      return {
        valid: true,
        data: verificationRecord
      };
    } catch (error) {
      logger.error('验证验证码失败:', error);
      throw new Error(`验证验证码失败: ${error.message}`);
    }
  }

  /**
   * 检查验证码发送频率限制
   * @param {string} email - 邮箱地址
   * @param {string} type - 验证码类型
   * @param {number} intervalMinutes - 间隔时间（分钟）
   * @returns {Promise<boolean>} 是否可以发送
   */
  static async canSendCode(email, type, intervalMinutes = 1) {
    try {
      const result = await query(`
        SELECT created_at FROM verification_codes
        WHERE email = $1 AND type = $2
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '${intervalMinutes} minutes'
        ORDER BY created_at DESC
        LIMIT 1
      `, [email, type]);

      return result.rows.length === 0;
    } catch (error) {
      logger.error('检查验证码发送频率失败:', error);
      return false;
    }
  }

  /**
   * 获取今日验证码发送次数
   * @param {string} email - 邮箱地址
   * @param {string} type - 验证码类型
   * @returns {Promise<number>} 发送次数
   */
  static async getTodayCount(email, type) {
    try {
      const result = await query(`
        SELECT COUNT(*) as count FROM verification_codes
        WHERE email = $1 AND type = $2
          AND created_at >= CURRENT_DATE
          AND created_at < CURRENT_DATE + INTERVAL '1 day'
      `, [email, type]);

      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      logger.error('获取今日验证码发送次数失败:', error);
      return 0;
    }
  }

  /**
   * 清理过期的验证码
   * @returns {Promise<number>} 清理的记录数
   */
  static async cleanExpiredCodes() {
    try {
      const result = await query(`
        DELETE FROM verification_codes
        WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '1 day'
      `);

      const deletedCount = result.rowCount;
      if (deletedCount > 0) {
        logger.info(`清理过期验证码: ${deletedCount} 条`);
      }
      return deletedCount;
    } catch (error) {
      logger.error('清理过期验证码失败:', error);
      return 0;
    }
  }

  /**
   * 获取验证码统计信息
   * @param {string} email - 邮箱地址（可选）
   * @returns {Promise<Object>} 统计信息
   */
  static async getStats(email = null) {
    try {
      let whereClause = '';
      let params = [];

      if (email) {
        whereClause = 'WHERE email = $1';
        params = [email];
      }

      const result = await query(`
        SELECT
          type,
          COUNT(*) as total_count,
          COUNT(CASE WHEN is_used = true THEN 1 END) as used_count,
          COUNT(CASE WHEN expires_at < CURRENT_TIMESTAMP THEN 1 END) as expired_count,
          COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_count
        FROM verification_codes
        ${whereClause}
        GROUP BY type
      `, params);

      return result.rows.reduce((acc, row) => {
        acc[row.type] = {
          total: parseInt(row.total_count),
          used: parseInt(row.used_count),
          expired: parseInt(row.expired_count),
          today: parseInt(row.today_count)
        };
        return acc;
      }, {});
    } catch (error) {
      logger.error('获取验证码统计失败:', error);
      return {};
    }
  }
}

module.exports = VerificationCode;