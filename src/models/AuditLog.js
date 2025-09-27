/**
 * 审计日志工具
 * 负责记录登录、操作和积分变更日志
 */

const { query } = require('../config/database');
const { logger } = require('../utils/logger');

const DEFAULT_PAGE_SIZE = 20;

const normalizePagination = (limit, offset) => {
  const normalizedLimit = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_PAGE_SIZE, 1), 100);
  const normalizedOffset = Math.max(parseInt(offset, 10) || 0, 0);
  return { limit: normalizedLimit, offset: normalizedOffset };
};

class AuditLog {
  static async createLoginLog({
    userId = null,
    identifier = '',
    status = 'success',
    failureReason = null,
    ipAddress = null,
    userAgent = null
  }) {
    try {
      await query(
        `INSERT INTO user_login_logs
         (user_id, identifier, status, failure_reason, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, identifier, status, failureReason, ipAddress, userAgent]
      );
    } catch (error) {
      logger.error('记录登录日志失败:', error);
    }
  }

  static async createSystemLog({
    operatorId = null,
    targetType,
    targetId = null,
    action,
    summary = null,
    detail = null,
    ipAddress = null,
    userAgent = null
  }) {
    try {
      await query(
        `INSERT INTO system_operation_logs
         (operator_id, target_type, target_id, action, summary, detail, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
        [
          operatorId,
          targetType,
          targetId,
          action,
          summary,
          detail ? JSON.stringify(detail) : null,
          ipAddress,
          userAgent
        ]
      );
    } catch (error) {
      logger.error('记录操作日志失败:', error);
    }
  }

  static async createPointsLog({
    userId,
    operatorId = null,
    changeAmount,
    balanceBefore = null,
    balanceAfter = null,
    source,
    description = null,
    relatedId = null,
    relatedType = null
  }, client = null) {
    
    try {
      const sql = `INSERT INTO points_audit_logs
         (user_id, operator_id, change_amount, balance_before, balance_after,
          source, description, related_id, related_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;

      const params = [
        userId,
        operatorId,
        changeAmount,
        balanceBefore,
        balanceAfter,
        source,
        description,
        relatedId,
        relatedType
      ];

      if (client) {
        await client.query(sql, params);
      } else {
        await query(sql, params);
      }
    } catch (error) {
      logger.error('记录积分日志失败:', error);
    }
  }

  /**
   * 查询登录日志
   */
  static async getLoginLogs(filters = {}) {
    const { limit, offset } = normalizePagination(filters.limit, filters.offset);
    const { clause, values } = this.#buildLoginLogFilters(filters);
    const params = [...values, limit, offset];

    const sql = `
      SELECT id, user_id, identifier, status, failure_reason, ip_address, user_agent, login_at
      FROM user_login_logs
      ${clause}
      ORDER BY login_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * 统计登录日志数量
   */
  static async countLoginLogs(filters = {}) {
    const { clause, values } = this.#buildLoginLogFilters(filters);
    const countResult = await query(`
      SELECT COUNT(*)::INTEGER AS total
      FROM user_login_logs
      ${clause}
    `, values);

    return countResult.rows[0]?.total || 0;
  }

  /**
   * 登录日志摘要统计
   */
  static async getLoginLogSummary(filters = {}) {
    const { clause, values } = this.#buildLoginLogFilters(filters);

    const statusResult = await query(`
      SELECT status, COUNT(*)::INTEGER AS count
      FROM user_login_logs
      ${clause}
      GROUP BY status
    `, values);

    const aggregateResult = await query(`
      SELECT
        COUNT(*)::INTEGER AS total,
        COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS unique_users,
        COUNT(DISTINCT COALESCE(ip_address, '')) FILTER (WHERE ip_address IS NOT NULL AND ip_address <> '') AS unique_ips,
        MAX(login_at) AS latest_login_at
      FROM user_login_logs
      ${clause}
    `, values);

    const statusMap = statusResult.rows.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {});

    const aggregate = aggregateResult.rows[0] || {};

    return {
      total: aggregate.total || 0,
      byStatus: statusMap,
      uniqueUsers: Number(aggregate.unique_users || 0),
      uniqueIps: Number(aggregate.unique_ips || 0),
      latestLoginAt: aggregate.latest_login_at || null
    };
  }

  /**
   * 清理审计日志
   * @param {Object} options
   * @param {string} options.logType - system | login | points | all
   * @param {string|null} options.beforeDate - ISO日期字符串，早于该时间的日志将被清理
   * @returns {Promise<Object>} 清理结果，包含各类型删除数量
   */
  static async clearLogs({ logType = 'system', beforeDate = null } = {}) {
    const tableConfig = {
      system: { table: 'system_operation_logs', dateColumn: 'created_at' },
      login: { table: 'user_login_logs', dateColumn: 'login_at' },
      points: { table: 'points_audit_logs', dateColumn: 'created_at' }
    };

    const normalizedType = logType.toLowerCase();
    const targetTypes = normalizedType === 'all'
      ? Object.keys(tableConfig)
      : tableConfig[normalizedType]
        ? [normalizedType]
        : null;

    if (!targetTypes) {
      throw new Error('不支持的日志类型');
    }

    const result = {
      clearedTypes: targetTypes,
      beforeDate: beforeDate ? new Date(beforeDate).toISOString() : null,
      counts: {},
      total: 0
    };

    for (const type of targetTypes) {
      const { table, dateColumn } = tableConfig[type];
      let sql = `DELETE FROM ${table}`;
      const params = [];

      if (beforeDate) {
        sql += ` WHERE ${dateColumn} < $1`;
        params.push(beforeDate);
      }

      const deleteResult = await query(sql, params);
      const deletedCount = deleteResult.rowCount || 0;
      result.counts[type] = deletedCount;
      result.total += deletedCount;
    }

    return result;
  }

  /**
   * 查询系统操作日志
   */
  static async getSystemLogs(filters = {}) {
    const { limit, offset } = normalizePagination(filters.limit, filters.offset);
    const { clause, values } = this.#buildSystemLogFilters(filters);
    const params = [...values, limit, offset];

    const sql = `
      SELECT id, operator_id, target_type, target_id, action, summary, detail, ip_address, user_agent, created_at
      FROM system_operation_logs
      ${clause}
      ORDER BY created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * 统计系统日志数量
   */
  static async countSystemLogs(filters = {}) {
    const { clause, values } = this.#buildSystemLogFilters(filters);
    const countResult = await query(`
      SELECT COUNT(*)::INTEGER AS total
      FROM system_operation_logs
      ${clause}
    `, values);

    return countResult.rows[0]?.total || 0;
  }

  /**
   * 系统日志摘要统计
   */
  static async getSystemLogSummary(filters = {}) {
    const { clause, values } = this.#buildSystemLogFilters(filters);

    const actionStats = await query(`
      SELECT action, COUNT(*)::INTEGER AS count
      FROM system_operation_logs
      ${clause}
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `, values);

    const aggregateResult = await query(`
      SELECT
        COUNT(*)::INTEGER AS total,
        COUNT(DISTINCT operator_id) FILTER (WHERE operator_id IS NOT NULL) AS unique_operators,
        COUNT(DISTINCT target_type) AS target_types,
        MAX(created_at) AS latest_created_at
      FROM system_operation_logs
      ${clause}
    `, values);

    const aggregate = aggregateResult.rows[0] || {};

    return {
      total: aggregate.total || 0,
      topActions: actionStats.rows,
      uniqueOperators: Number(aggregate.unique_operators || 0),
      targetTypeCount: Number(aggregate.target_types || 0),
      latestCreatedAt: aggregate.latest_created_at || null
    };
  }

  /**
   * 查询积分审计日志
   */
  static async getPointsLogs(filters = {}) {
    const { limit, offset } = normalizePagination(filters.limit, filters.offset);
    const { clause, values } = this.#buildPointsLogFilters(filters);
    const params = [...values, limit, offset];

    const sql = `
      SELECT id, user_id, operator_id, change_amount, balance_before, balance_after,
             source, description, related_id, related_type, created_at
      FROM points_audit_logs
      ${clause}
      ORDER BY created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * 统计积分日志数量
   */
  static async countPointsLogs(filters = {}) {
    const { clause, values } = this.#buildPointsLogFilters(filters);
    const countResult = await query(`
      SELECT COUNT(*)::INTEGER AS total
      FROM points_audit_logs
      ${clause}
    `, values);

    return countResult.rows[0]?.total || 0;
  }

  /**
   * 积分日志摘要统计
   */
  static async getPointsLogSummary(filters = {}) {
    const { clause, values } = this.#buildPointsLogFilters(filters);

    const aggregateResult = await query(`
      SELECT
        COUNT(*)::INTEGER AS total,
        SUM(CASE WHEN change_amount >= 0 THEN change_amount ELSE 0 END)::INTEGER AS total_increase,
        SUM(CASE WHEN change_amount < 0 THEN ABS(change_amount) ELSE 0 END)::INTEGER AS total_decrease,
        COUNT(DISTINCT user_id) AS unique_users,
        MAX(created_at) AS latest_created_at
      FROM points_audit_logs
      ${clause}
    `, values);

    const sourceStats = await query(`
      SELECT source, COUNT(*)::INTEGER AS count,
             SUM(change_amount)::INTEGER AS total_change
      FROM points_audit_logs
      ${clause}
      GROUP BY source
      ORDER BY count DESC
      LIMIT 10
    `, values);

    const aggregate = aggregateResult.rows[0] || {};

    return {
      total: aggregate.total || 0,
      totalIncrease: Number(aggregate.total_increase || 0),
      totalDecrease: Number(aggregate.total_decrease || 0),
      uniqueUsers: Number(aggregate.unique_users || 0),
      latestCreatedAt: aggregate.latest_created_at || null,
      topSources: sourceStats.rows
    };
  }

  static #buildLoginLogFilters(filters = {}) {
    const conditions = [];
    const values = [];
    let index = 1;

    if (filters.status) {
      conditions.push(`status = $${index}`);
      values.push(filters.status);
      index += 1;
    }

    if (filters.userId) {
      conditions.push(`user_id = $${index}`);
      values.push(Number(filters.userId));
      index += 1;
    }

    if (filters.identifier) {
      conditions.push(`identifier ILIKE $${index}`);
      values.push(`%${filters.identifier}%`);
      index += 1;
    }

    if (filters.keyword) {
      conditions.push(`(identifier ILIKE $${index} OR ip_address ILIKE $${index} OR user_agent ILIKE $${index})`);
      values.push(`%${filters.keyword}%`);
      index += 1;
    }

    if (filters.ipAddress) {
      conditions.push(`ip_address = $${index}`);
      values.push(filters.ipAddress);
      index += 1;
    }

    if (filters.dateFrom) {
      conditions.push(`login_at >= $${index}`);
      values.push(filters.dateFrom);
      index += 1;
    }

    if (filters.dateTo) {
      conditions.push(`login_at <= $${index}`);
      values.push(filters.dateTo);
      index += 1;
    }

    const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { clause, values };
  }

  static #buildSystemLogFilters(filters = {}) {
    const conditions = [];
    const values = [];
    let index = 1;

    if (filters.operatorId) {
      conditions.push(`operator_id = $${index}`);
      values.push(Number(filters.operatorId));
      index += 1;
    }

    if (filters.targetType) {
      conditions.push(`target_type = $${index}`);
      values.push(filters.targetType);
      index += 1;
    }

    if (filters.targetId !== undefined && filters.targetId !== null) {
      conditions.push(`target_id = $${index}`);
      values.push(Number(filters.targetId));
      index += 1;
    }

    if (filters.action) {
      conditions.push(`action = $${index}`);
      values.push(filters.action);
      index += 1;
    }

    if (filters.keyword) {
      conditions.push(`(summary ILIKE $${index} OR detail::text ILIKE $${index})`);
      values.push(`%${filters.keyword}%`);
      index += 1;
    }

    if (filters.dateFrom) {
      conditions.push(`created_at >= $${index}`);
      values.push(filters.dateFrom);
      index += 1;
    }

    if (filters.dateTo) {
      conditions.push(`created_at <= $${index}`);
      values.push(filters.dateTo);
      index += 1;
    }

    const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { clause, values };
  }

  static #buildPointsLogFilters(filters = {}) {
    const conditions = [];
    const values = [];
    let index = 1;

    if (filters.userId) {
      conditions.push(`user_id = $${index}`);
      values.push(Number(filters.userId));
      index += 1;
    }

    if (filters.operatorId) {
      conditions.push(`operator_id = $${index}`);
      values.push(Number(filters.operatorId));
      index += 1;
    }

    if (filters.source) {
      conditions.push(`source = $${index}`);
      values.push(filters.source);
      index += 1;
    }

    if (filters.relatedType) {
      conditions.push(`related_type = $${index}`);
      values.push(filters.relatedType);
      index += 1;
    }

    if (filters.minAmount) {
      conditions.push(`change_amount >= $${index}`);
      values.push(Number(filters.minAmount));
      index += 1;
    }

    if (filters.maxAmount) {
      conditions.push(`change_amount <= $${index}`);
      values.push(Number(filters.maxAmount));
      index += 1;
    }

    if (filters.dateFrom) {
      conditions.push(`created_at >= $${index}`);
      values.push(filters.dateFrom);
      index += 1;
    }

    if (filters.dateTo) {
      conditions.push(`created_at <= $${index}`);
      values.push(filters.dateTo);
      index += 1;
    }

    const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { clause, values };
  }
}

module.exports = AuditLog;
