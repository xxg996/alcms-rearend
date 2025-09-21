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
}

module.exports = new AuditLogService();
