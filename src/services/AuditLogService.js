/**
 * 审计日志服务
 * 提供登录日志、系统操作日志与积分日志的查询能力
 */

const BaseService = require('./BaseService');
const AuditLog = require('../models/AuditLog');

const LOGIN_STATUS = ['success', 'failure'];

class AuditLogService extends BaseService {
  constructor() {
    super();
  }

  /**
   * 查询登录日志
   */
  async getLoginLogs(query = {}) {
    return this.withPerformanceMonitoring('getLoginLogs', async () => {
      try {
        const { page, limit, offset } = this.normalizePaginationParams(query.page, query.limit);

        const filters = this.#buildLoginFilters(query, { limit, offset });

        const [items, total, summary] = await Promise.all([
          AuditLog.getLoginLogs(filters),
          AuditLog.countLoginLogs(filters),
          AuditLog.getLoginLogSummary(filters)
        ]);

        const response = this.formatPaginatedResponse(items, { page, limit }, total);
        response.data.summary = summary;

        return response;
      } catch (error) {
        this.handleError(error, 'getLoginLogs');
      }
    });
  }

  /**
   * 查询系统操作日志
   */
  async getSystemLogs(query = {}) {
    return this.withPerformanceMonitoring('getSystemLogs', async () => {
      try {
        const { page, limit, offset } = this.normalizePaginationParams(query.page, query.limit);
        const filters = this.#buildSystemFilters(query, { limit, offset });

        const [items, total, summary] = await Promise.all([
          AuditLog.getSystemLogs(filters),
          AuditLog.countSystemLogs(filters),
          AuditLog.getSystemLogSummary(filters)
        ]);

        const response = this.formatPaginatedResponse(items, { page, limit }, total);
        response.data.summary = summary;

        return response;
      } catch (error) {
        this.handleError(error, 'getSystemLogs');
      }
    });
  }

  /**
   * 查询积分审计日志
   */
  async getPointsLogs(query = {}) {
    return this.withPerformanceMonitoring('getPointsLogs', async () => {
      try {
        const { page, limit, offset } = this.normalizePaginationParams(query.page, query.limit);
        const filters = this.#buildPointsFilters(query, { limit, offset });

        const [items, total, summary] = await Promise.all([
          AuditLog.getPointsLogs(filters),
          AuditLog.countPointsLogs(filters),
          AuditLog.getPointsLogSummary(filters)
        ]);

        const response = this.formatPaginatedResponse(items, { page, limit }, total);
        response.data.summary = summary;

        return response;
      } catch (error) {
        this.handleError(error, 'getPointsLogs');
      }
    });
  }

  /**
   * 清理审计日志
   */
  async clearLogs(payload = {}) {
    return this.withPerformanceMonitoring('clearLogs', async () => {
      try {
        const { logType, beforeDate } = this.#normalizeClearParams(payload);
        const clearResult = await AuditLog.clearLogs({ logType, beforeDate });
        return this.formatSuccessResponse(clearResult, '日志清理成功');
      } catch (error) {
        this.handleError(error, 'clearLogs');
      }
    });
  }

  #buildLoginFilters(query, pagination = {}) {
    const filters = { ...pagination };

    if (query.status) {
      if (!LOGIN_STATUS.includes(query.status)) {
        throw new Error('登录状态参数无效');
      }
      filters.status = query.status;
    }

    if (query.user_id) {
      const userId = Number(query.user_id);
      if (Number.isNaN(userId)) {
        throw new Error('用户ID格式不正确');
      }
      filters.userId = userId;
    }

    if (query.identifier) {
      filters.identifier = query.identifier.trim();
    }

    if (query.keyword) {
      filters.keyword = query.keyword.trim();
    }

    if (query.ip || query.ip_address) {
      filters.ipAddress = (query.ip || query.ip_address).trim();
    }

    if (query.start_at || query.date_from) {
      filters.dateFrom = query.start_at || query.date_from;
    }

    if (query.end_at || query.date_to) {
      filters.dateTo = query.end_at || query.date_to;
    }

    return filters;
  }

  #buildSystemFilters(query, pagination = {}) {
    const filters = { ...pagination };

    if (query.operator_id) {
      const operatorId = Number(query.operator_id);
      if (Number.isNaN(operatorId)) {
        throw new Error('操作人ID格式不正确');
      }
      filters.operatorId = operatorId;
    }

    if (query.target_type) {
      filters.targetType = query.target_type.trim();
    }

    if (query.target_id) {
      const targetId = Number(query.target_id);
      if (Number.isNaN(targetId)) {
        throw new Error('目标ID格式不正确');
      }
      filters.targetId = targetId;
    }

    if (query.action) {
      filters.action = query.action.trim();
    }

    if (query.keyword) {
      filters.keyword = query.keyword.trim();
    }

    if (query.start_at || query.date_from) {
      filters.dateFrom = query.start_at || query.date_from;
    }

    if (query.end_at || query.date_to) {
      filters.dateTo = query.end_at || query.date_to;
    }

    return filters;
  }

  #buildPointsFilters(query, pagination = {}) {
    const filters = { ...pagination };

    if (query.user_id) {
      const userId = Number(query.user_id);
      if (Number.isNaN(userId)) {
        throw new Error('用户ID格式不正确');
      }
      filters.userId = userId;
    }

    if (query.operator_id) {
      const operatorId = Number(query.operator_id);
      if (Number.isNaN(operatorId)) {
        throw new Error('操作者ID格式不正确');
      }
      filters.operatorId = operatorId;
    }

    if (query.source) {
      filters.source = query.source.trim();
    }

    if (query.related_type) {
      filters.relatedType = query.related_type.trim();
    }

    if (query.min_amount) {
      const minAmount = Number(query.min_amount);
      if (Number.isNaN(minAmount)) {
        throw new Error('积分变动最小值格式不正确');
      }
      filters.minAmount = minAmount;
    }

    if (query.max_amount) {
      const maxAmount = Number(query.max_amount);
      if (Number.isNaN(maxAmount)) {
        throw new Error('积分变动最大值格式不正确');
      }
      filters.maxAmount = maxAmount;
    }

    if (query.start_at || query.date_from) {
      filters.dateFrom = query.start_at || query.date_from;
    }

    if (query.end_at || query.date_to) {
      filters.dateTo = query.end_at || query.date_to;
    }

    return filters;
  }

  /**
   * 查询用户VIP变更日志
   */
  async getVipChangeLogs(query = {}) {
    return this.withPerformanceMonitoring('getVipChangeLogs', async () => {
      try {
        const { page, limit, offset } = this.normalizePaginationParams(query.page, query.limit);
        const normalizedQuery = { ...query };
        normalizedQuery.target_type = normalizedQuery.target_type || 'vip_user';

        if (normalizedQuery.user_id && !normalizedQuery.target_id) {
          const targetId = Number(normalizedQuery.user_id);
          if (Number.isNaN(targetId)) {
            throw new Error('用户ID格式不正确');
          }
          normalizedQuery.target_id = targetId;
        }

        const filters = this.#buildSystemFilters(normalizedQuery, { limit, offset });

        const [items, total, summary] = await Promise.all([
          AuditLog.getSystemLogs(filters),
          AuditLog.countSystemLogs(filters),
          AuditLog.getSystemLogSummary(filters)
        ]);

        const response = this.formatPaginatedResponse(items, { page, limit }, total);
        response.data.summary = summary;

        return response;
      } catch (error) {
        this.handleError(error, 'getVipChangeLogs');
      }
    });
  }

  /**
   * 查询卡密使用日志
   */
  async getCardKeyUsageLogs(query = {}) {
    return this.withPerformanceMonitoring('getCardKeyUsageLogs', async () => {
      try {
        const { page, limit, offset } = this.normalizePaginationParams(query.page, query.limit);
        const normalizedQuery = { ...query };
        normalizedQuery.target_type = normalizedQuery.target_type || 'card_key';

        if (!normalizedQuery.action) {
          normalizedQuery.action = 'card_key_redeem';
        }

        if (normalizedQuery.user_id && !normalizedQuery.operator_id) {
          const operatorId = Number(normalizedQuery.user_id);
          if (Number.isNaN(operatorId)) {
            throw new Error('用户ID格式不正确');
          }
          normalizedQuery.operator_id = operatorId;
        }

        const filters = this.#buildSystemFilters(normalizedQuery, { limit, offset });

        const [items, total, summary] = await Promise.all([
          AuditLog.getSystemLogs(filters),
          AuditLog.countSystemLogs(filters),
          AuditLog.getSystemLogSummary(filters)
        ]);

        const response = this.formatPaginatedResponse(items, { page, limit }, total);
        response.data.summary = summary;

        return response;
      } catch (error) {
        this.handleError(error, 'getCardKeyUsageLogs');
      }
    });
  }

  #normalizeClearParams(params = {}) {
    const rawType = params.log_type || params.logType || 'system';
    const normalizedType = String(rawType).toLowerCase();
    const supportedTypes = ['system', 'login', 'points', 'all'];

    if (!supportedTypes.includes(normalizedType)) {
      throw new Error('不支持的日志类型，请传入 system、login、points 或 all');
    }

    let beforeDate = params.before_date || params.beforeDate || null;
    if (beforeDate) {
      const date = new Date(beforeDate);
      if (Number.isNaN(date.getTime())) {
        throw new Error('before_date 参数格式不正确，应为合法日期');
      }
      beforeDate = date.toISOString();
    }

    return {
      logType: normalizedType,
      beforeDate
    };
  }
}

module.exports = new AuditLogService();
