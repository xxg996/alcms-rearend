/**
 * 邀请与佣金业务服务
 * 封装邀请码生成、上下级绑定与佣金结算逻辑
 */

const BaseService = require('./BaseService');
const Referral = require('../models/Referral');
const SystemSetting = require('../models/SystemSetting');
const VIP = require('../models/VIP');

class ReferralService extends BaseService {
  constructor() {
    super();
  }

  /**
   * 获取当前用户的邀请面板信息
   */
  async getReferralDashboard(userId) {
    return this.withPerformanceMonitoring('getReferralDashboard', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const [code, stats, invitees, inviterInfo, summary, payoutSetting] = await Promise.all([
          Referral.getUserCode(userId).catch(() => null),
          Referral.getInviteStats(userId),
          Referral.listInvitees(userId, 20, 0),
          Referral.getInviter(userId),
          Referral.getCommissionSummary(userId),
          Referral.getPayoutSetting(userId)
        ]);

        const normalizedStats = {
          invite_count: stats.invite_count,
          commission_balance: Number(stats.commission_balance || 0),
          total_commission_earned: Number(summary.total_amount || 0),
          approved_amount: Number(summary.approved_amount || 0),
          pending_amount: Number(summary.pending_amount || 0),
          payout_processing_amount: Number(stats.payout_processing_amount || 0),
          payout_paid_amount: Number(stats.payout_paid_amount || 0)
        };

        return this.formatSuccessResponse({
          referral_code: code,
          stats: normalizedStats,
          invites: invitees,
          inviter: inviterInfo,
          payout_setting: payoutSetting
        }, '获取邀请信息成功');
      } catch (error) {
        this.handleError(error, 'getReferralDashboard');
      }
    });
  }

  /**
   * 生成或刷新邀请码
   */
  async generateCode(userId, options = {}) {
    return this.withPerformanceMonitoring('generateCode', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);
        const { force = false } = options;

        const newCode = await Referral.ensureCode(userId, force);

        this.log('info', '生成邀请码成功', { userId, force });

        return this.formatSuccessResponse({
          referral_code: newCode
        }, '邀请码生成成功');
      } catch (error) {
        this.handleError(error, 'generateCode');
      }
    });
  }

  /**
   * 获取佣金记录列表
   */
  async getCommissionRecords(userId, queryOptions = {}) {
    return this.withPerformanceMonitoring('getCommissionRecords', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const { page, limit, offset } = this.normalizePaginationParams(
          queryOptions.page,
          queryOptions.limit
        );

        const filters = {
          inviterId: userId,
          limit,
          offset,
          eventType: queryOptions.event_type || queryOptions.eventType || null,
          status: queryOptions.status || null
        };

        const [records, total] = await Promise.all([
          Referral.getCommissionRecords(filters),
          Referral.countCommissionRecords(filters)
        ]);

        const formatted = records.map(record => ({
          id: record.id,
          inviter_id: record.inviter_id,
          invitee_id: record.invitee_id,
          order_id: record.order_id,
          order_amount: record.order_amount ? Number(record.order_amount) : 0,
          commission_amount: record.commission_amount ? Number(record.commission_amount) : 0,
          commission_rate: record.commission_rate ? Number(record.commission_rate) : 0,
          event_type: record.event_type,
          status: record.status,
          created_at: record.created_at,
          settled_at: record.settled_at
        }));

        return this.formatPaginatedResponse(formatted, { page, limit }, total);
      } catch (error) {
        this.handleError(error, 'getCommissionRecords');
      }
    });
  }

  /**
   * 后台获取佣金记录列表
   */
  async getAdminCommissionRecords(queryOptions = {}) {
    return this.withPerformanceMonitoring('getAdminCommissionRecords', async () => {
      try {
        const { page, limit, offset } = this.normalizePaginationParams(
          queryOptions.page,
          queryOptions.limit
        );

        const filters = {
          inviterId: queryOptions.inviter_id ? Number(queryOptions.inviter_id) : null,
          limit,
          offset,
          eventType: queryOptions.event_type || null,
          status: queryOptions.status || null
        };

        const [records, total] = await Promise.all([
          Referral.getCommissionRecords(filters),
          Referral.countCommissionRecords(filters)
        ]);

        const formatted = records.map(record => ({
          id: record.id,
          inviter_id: record.inviter_id,
          invitee_id: record.invitee_id,
          order_id: record.order_id,
          order_amount: Number(record.order_amount || 0),
          commission_amount: Number(record.commission_amount || 0),
          commission_rate: Number(record.commission_rate || 0),
          event_type: record.event_type,
          status: record.status,
          created_at: record.created_at,
          settled_at: record.settled_at
        }));

        return this.formatPaginatedResponse(formatted, { page, limit }, total);
      } catch (error) {
        this.handleError(error, 'getAdminCommissionRecords');
      }
    });
  }

  /**
   * 审核佣金记录
   */
  async reviewCommission(commissionId, payload, reviewerId) {
    return this.withPerformanceMonitoring('reviewCommission', async () => {
      try {
        this.validateRequired({ commissionId, reviewerId }, ['commissionId', 'reviewerId']);

        const { status, review_notes } = payload || {};

        if (!status) {
          throw new Error('请提供目标状态');
        }

        const options = {
          reviewNotes: review_notes
        };

        const updated = await Referral.updateCommissionStatus(Number(commissionId), status, options);

        this.log('info', '佣金审核更新成功', {
          reviewerId,
          commissionId,
          status
        });

        return this.formatSuccessResponse(updated, '佣金状态已更新');
      } catch (error) {
        this.handleError(error, 'reviewCommission');
      }
    });
  }

  /**
   * 用户提交提现申请
   */
  async applyPayout(userId, payload) {
    return this.withPerformanceMonitoring('applyPayout', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);
        this.validateRequired(payload || {}, ['amount']);

        const request = await Referral.createPayoutRequest(userId, payload, userId);

        this.log('info', '发起提现申请', {
          userId,
          amount: request.amount,
          method: request.method
        });

        return this.formatSuccessResponse(request, '提现申请已提交');
      } catch (error) {
        this.handleError(error, 'applyPayout');
      }
    });
  }

  async getUserPayoutRequests(userId, queryOptions = {}) {
    return this.withPerformanceMonitoring('getUserPayoutRequests', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const { page, limit, offset } = this.normalizePaginationParams(
          queryOptions.page,
          queryOptions.limit
        );

        const filters = {
          userId,
          limit,
          offset,
          status: queryOptions.status || null
        };

        const [items, total] = await Promise.all([
          Referral.getPayoutRequests(filters),
          Referral.countPayoutRequests(filters)
        ]);

        const formatted = items.map(item => ({
          id: item.id,
          amount: Number(item.amount || 0),
          method: item.method,
          account: item.account,
          account_name: item.account_name,
          extra: item.extra,
          status: item.status,
          requested_notes: item.requested_notes,
          review_notes: item.review_notes,
          created_at: item.created_at,
          reviewed_at: item.reviewed_at,
          paid_at: item.paid_at
        }));

        return this.formatPaginatedResponse(formatted, { page, limit }, total);
      } catch (error) {
        this.handleError(error, 'getUserPayoutRequests');
      }
    });
  }

  async getAdminPayoutRequests(queryOptions = {}) {
    return this.withPerformanceMonitoring('getAdminPayoutRequests', async () => {
      try {
        const { page, limit, offset } = this.normalizePaginationParams(
          queryOptions.page,
          queryOptions.limit
        );

        const filters = {
          userId: queryOptions.user_id ? Number(queryOptions.user_id) : null,
          limit,
          offset,
          status: queryOptions.status || null
        };

        const [items, total] = await Promise.all([
          Referral.getPayoutRequests(filters),
          Referral.countPayoutRequests(filters)
        ]);

        const formatted = items.map(item => ({
          id: item.id,
          user_id: item.user_id,
          username: item.username,
          email: item.email,
          amount: Number(item.amount || 0),
          method: item.method,
          account: item.account,
          account_name: item.account_name,
          extra: item.extra,
          status: item.status,
          requested_notes: item.requested_notes,
          review_notes: item.review_notes,
          created_at: item.created_at,
          reviewed_at: item.reviewed_at,
          reviewed_by: item.reviewed_by,
          paid_at: item.paid_at
        }));

        return this.formatPaginatedResponse(formatted, { page, limit }, total);
      } catch (error) {
        this.handleError(error, 'getAdminPayoutRequests');
      }
    });
  }

  async reviewPayoutRequest(requestId, payload, reviewerId) {
    return this.withPerformanceMonitoring('reviewPayoutRequest', async () => {
      try {
        this.validateRequired({ requestId, reviewerId }, ['requestId', 'reviewerId']);

        const { status, review_notes } = payload || {};

        if (!status) {
          throw new Error('请提供目标状态');
        }

        const updated = await Referral.updatePayoutRequestStatus(Number(requestId), status, reviewerId, {
          reviewNotes: review_notes
        });

        this.log('info', '提现审核更新成功', {
          reviewerId,
          requestId,
          status
        });

        return this.formatSuccessResponse(updated, '提现状态已更新');
      } catch (error) {
        this.handleError(error, 'reviewPayoutRequest');
      }
    });
  }

  /**
   * 获取用户提现账号信息
   */
  async getPayoutSetting(userId) {
    return this.withPerformanceMonitoring('getPayoutSetting', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);
        const setting = await Referral.getPayoutSetting(userId);
        return this.formatSuccessResponse(setting, '获取提现账号成功');
      } catch (error) {
        this.handleError(error, 'getPayoutSetting');
      }
    });
  }

  /**
   * 更新提现账号信息
   */
  async updatePayoutSetting(userId, payload, operatorId = null) {
    return this.withPerformanceMonitoring('updatePayoutSetting', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const { method, account, account_name, usdt_network } = payload || {};

        if (!method || !['alipay', 'usdt'].includes(method)) {
          throw new Error('提现方式仅支持支付宝或USDT');
        }

        if (!account || account.trim().length === 0) {
          throw new Error('请输入提现账号');
        }

        const extra = {};
        if (method === 'usdt' && usdt_network) {
          extra.usdt_network = usdt_network;
        }

        const setting = await Referral.upsertPayoutSetting(userId, {
          method,
          account: account.trim(),
          account_name: account_name || null,
          extra
        }, operatorId);

        this.log('info', '更新提现账号成功', {
          userId,
          method
        });

        return this.formatSuccessResponse(setting, '提现账号已更新');
      } catch (error) {
        this.handleError(error, 'updatePayoutSetting');
      }
    });
  }

  /**
   * 获取邀请佣金配置
   */
  async getCommissionConfig() {
    return this.withPerformanceMonitoring('getCommissionConfig', async () => {
      try {
        const config = await SystemSetting.getReferralCommissionConfig();
        return this.formatSuccessResponse(config, '获取邀请佣金配置成功');
      } catch (error) {
        this.handleError(error, 'getCommissionConfig');
      }
    });
  }

  /**
   * 更新邀请佣金配置
   */
  async updateCommissionConfig(payload, userId) {
    return this.withPerformanceMonitoring('updateCommissionConfig', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const {
          enabled = true,
          first_rate = 0,
          renewal_rate = 0
        } = payload || {};

        const normalized = {
          enabled: Boolean(enabled),
          first_rate: Number(first_rate),
          renewal_rate: Number(renewal_rate)
        };

        if (Number.isNaN(normalized.first_rate) || normalized.first_rate < 0 || normalized.first_rate > 1) {
          throw new Error('首充佣金比例必须在0-1之间');
        }

        if (Number.isNaN(normalized.renewal_rate) || normalized.renewal_rate < 0 || normalized.renewal_rate > 1) {
          throw new Error('续费佣金比例必须在0-1之间');
        }

        await SystemSetting.upsertSetting(
          'referral_commission',
          normalized,
          '邀请分佣配置',
          userId
        );

        this.log('info', '更新邀请佣金配置', {
          userId,
          config: normalized
        });

        return this.formatSuccessResponse(normalized, '邀请佣金配置已更新');
      } catch (error) {
        this.handleError(error, 'updateCommissionConfig');
      }
    });
  }

  /**
   * 注册流程中绑定上级
   */
  async bindInviterForNewUser(userId, referralCode) {
    if (!referralCode) {
      return null;
    }

    return this.withPerformanceMonitoring('bindInviterForNewUser', async () => {
      try {
        const normalizedCode = referralCode.trim().toUpperCase();
        const inviter = await Referral.findInviterByCode(normalizedCode);

        if (!inviter) {
          throw new Error('邀请码无效');
        }

        await Referral.bindInviter(userId, inviter.id, normalizedCode);

        this.log('info', '绑定上级成功', { userId, inviterId: inviter.id });

        return inviter;
      } catch (error) {
        this.handleError(error, 'bindInviterForNewUser');
      }
    });
  }

  /**
   * 提前校验邀请码有效性
   */
  async validateReferralCode(referralCode) {
    if (!referralCode) {
      return null;
    }

    const normalizedCode = referralCode.trim().toUpperCase();
    const inviter = await Referral.findInviterByCode(normalizedCode);

    if (!inviter) {
      throw new Error('邀请码不存在');
    }

    if (inviter.status !== 'normal') {
      throw new Error('邀请码对应的用户状态异常');
    }

    return inviter;
  }

  /**
   * 卡密兑换成功后处理佣金结算
   */
  async handleVipCardCommission({ inviteeId, order, cardKey }) {
    return this.withPerformanceMonitoring('handleVipCardCommission', async () => {
      try {
        if (!order || !inviteeId) {
          return null;
        }

        const config = await SystemSetting.getReferralCommissionConfig();
        if (!config || !config.enabled) {
          return null;
        }

        const inviter = await Referral.getInviter(inviteeId);
        if (!inviter || !inviter.inviter_id) {
          return null;
        }

        const inviterId = inviter.inviter_id;

        const hasPrevious = await Referral.hasPaidCardKeyOrder(inviteeId, order.id);
        const eventType = hasPrevious ? 'renewal' : 'first_recharge';
        const rate = eventType === 'first_recharge' ? config.first_rate : config.renewal_rate;

        if (!rate || rate <= 0) {
          return null;
        }

        const alreadyRecorded = await Referral.hasCommissionRecord(order.id);
        if (alreadyRecorded) {
          this.log('warn', '订单已存在佣金记录，跳过重复结算', {
            orderId: order.id,
            inviteeId,
            inviterId
          });
          return null;
        }

        const orderAmount = await this.calculateOrderAmount(order, cardKey);
        if (!orderAmount || orderAmount <= 0) {
          this.log('warn', '订单金额为0，跳过佣金结算', { orderId: order.id });
          return null;
        }

        const commissionAmount = Number((orderAmount * rate).toFixed(2));

        if (commissionAmount <= 0) {
          return null;
        }

        const record = await Referral.createCommissionRecord({
          inviterId,
          inviteeId,
          orderId: order.id,
          orderAmount,
          commissionAmount,
          commissionRate: rate,
          eventType
        });

        this.log('info', '佣金结算成功', {
          inviterId,
          inviteeId,
          orderId: order.id,
          commissionAmount,
          rate,
          eventType
        });

        return record;
      } catch (error) {
        this.handleError(error, 'handleVipCardCommission');
      }
    });
  }

  /**
   * 通用佣金处理方法
   */
  async processCommission(inviteeId, order = null, cardKey = null, eventType = 'card_redeem') {
    return this.withPerformanceMonitoring('processCommission', async () => {
      try {
        if (!inviteeId) {
          return null;
        }

        const config = await SystemSetting.getReferralCommissionConfig();
        if (!config || !config.enabled) {
          return null;
        }

        const inviter = await Referral.getInviter(inviteeId);
        if (!inviter || !inviter.inviter_id) {
          return null;
        }

        const inviterId = inviter.inviter_id;

        // 对于卡密兑换，直接使用卡密价值
        let orderAmount = 0;
        if (cardKey && cardKey.value_amount) {
          orderAmount = Number(cardKey.value_amount);
        } else if (order) {
          orderAmount = await this.calculateOrderAmount(order, cardKey);
        }

        if (!orderAmount || orderAmount <= 0) {
          this.log('info', '订单金额为0，跳过佣金结算', {
            inviteeId,
            eventType,
            cardKeyId: cardKey?.id
          });
          return null;
        }

        // 根据事件类型确定佣金比例
        const hasPrevious = order ? await Referral.hasPaidCardKeyOrder(inviteeId, order.id) :
                           await Referral.hasPaidCardKeyOrder(inviteeId);
        const finalEventType = hasPrevious ? 'renewal' : 'first_recharge';
        const rate = finalEventType === 'first_recharge' ? config.first_rate : config.renewal_rate;

        if (!rate || rate <= 0) {
          return null;
        }

        const commissionAmount = Number((orderAmount * rate).toFixed(2));
        if (commissionAmount <= 0) {
          return null;
        }

        const record = await Referral.createCommissionRecord({
          inviterId,
          inviteeId,
          orderId: order?.id || null,
          orderAmount,
          commissionAmount,
          commissionRate: rate,
          eventType: finalEventType,
          cardKeyId: cardKey?.id
        });

        this.log('info', '佣金结算成功', {
          inviteeId,
          inviterId,
          orderAmount,
          commissionAmount,
          rate,
          eventType: finalEventType,
          cardKeyId: cardKey?.id
        });

        return record;
      } catch (error) {
        this.handleError(error, 'processCommission');
      }
    });
  }

  /**
   * 计算卡密订单的参考金额
  */
  async calculateOrderAmount(order, cardKey) {
    if (cardKey) {
      // 优先使用卡密的价值字段
      if (cardKey.value_amount && cardKey.value_amount > 0) {
        return Number(cardKey.value_amount);
      }
      // 回退到传统计算方式
      return await VIP.calculateCardKeyPrice(cardKey);
    }

    const vipLevel = await VIP.getLevelById(order.vip_level);
    const price = Number(vipLevel?.price || 0);
    return price > 0 ? Number(price.toFixed(2)) : 0;
  }
}

module.exports = new ReferralService();
