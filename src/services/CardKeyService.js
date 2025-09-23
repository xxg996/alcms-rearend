/**
 * 卡密业务逻辑服务
 * 处理卡密管理相关的所有业务操作
 */

const BaseService = require('./BaseService');
const CardKey = require('../models/CardKey');
const User = require('../models/User');

class CardKeyService extends BaseService {
  constructor() {
    super();
  }

  /**
   * 生成卡密
   */
  async generateCardKeys(keyData, adminUserId) {
    return this.withPerformanceMonitoring('generateCardKeys', async () => {
      try {
        this.validateRequired({ adminUserId }, ['adminUserId']);

        const payload = keyData || {};
        const {
          type = 'vip',
          count,
          vip_level,
          vip_days,
          points,
          value,
          value_amount,
          expire_at,
          expire_days
        } = payload;

        const normalizedCount = parseInt(count, 10);
        if (Number.isNaN(normalizedCount) || normalizedCount <= 0 || normalizedCount > 1000) {
          throw new Error('卡密数量必须在1-1000之间');
        }

        const normalizedType = typeof type === 'string' ? type.toLowerCase() : 'vip';

        const cardData = {
          type: normalizedType,
          vip_level: vip_level !== undefined ? parseInt(vip_level, 10) : 1,
          vip_days: vip_days !== undefined ? parseInt(vip_days, 10) : 30,
          points: points !== undefined ? parseInt(points, 10) : undefined,
          expire_at: null,
          value_amount: null
        };

        if (expire_at) {
          cardData.expire_at = new Date(expire_at);
        } else if (expire_days && Number(expire_days) > 0) {
          const days = Number(expire_days);
          cardData.expire_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        }

        const resolvedValue = value_amount !== undefined ? Number(value_amount) : (value !== undefined ? Number(value) : null);
        if (resolvedValue !== null && !Number.isNaN(resolvedValue)) {
          cardData.value_amount = resolvedValue;
        }

        if (normalizedType === 'vip') {
          if (!cardData.vip_level || cardData.vip_level < 1) {
            throw new Error('VIP类型卡密必须指定有效的VIP等级');
          }

          if (cardData.vip_days < 0) {
            throw new Error('VIP天数不能为负数');
          }
        } else {
          const normalizedPoints = cardData.points !== undefined ? cardData.points : (resolvedValue !== null ? Math.round(resolvedValue) : 0);
          if (!normalizedPoints || normalizedPoints <= 0) {
            throw new Error('非VIP类型卡密必须指定有效的积分数量');
          }
          cardData.points = normalizedPoints;
          // 非VIP类型不需要VIP字段
          cardData.vip_level = 0;
          cardData.vip_days = 0;
        }

        const batchResult = await CardKey.createBatchCardKeys(cardData, normalizedCount, adminUserId);

        this.log('info', '批量生成卡密成功', {
          adminUserId,
          batchId: batchResult.batch_id,
          count: batchResult.count,
          type: normalizedType
        });

        return this.formatSuccessResponse({
          batch_id: batchResult.batch_id,
          count: batchResult.count,
          card_keys: batchResult.card_keys
        }, `成功生成 ${batchResult.count} 个卡密`);

      } catch (error) {
        this.handleError(error, 'generateCardKeys');
      }
    });
  }

  /**
   * 使用卡密
   */
  async useCardKey(keyCode, userId) {
    return this.withPerformanceMonitoring('useCardKey', async () => {
      try {
        this.validateRequired({ keyCode, userId }, ['keyCode', 'userId']);

        const normalizedCode = (keyCode || '').trim().toUpperCase();
        if (!normalizedCode) {
          throw new Error('请输入有效的卡密代码');
        }

        const user = await User.findById(userId);
        if (!user) {
          throw new Error('用户不存在');
        }

        // 调用模型层统一的兑换逻辑，确保事务一致性
        const redeemResult = await CardKey.redeemCardKey(normalizedCode, userId);

        // 重新获取最新的卡密信息并进行脱敏处理
        const updatedCardKey = await CardKey.getByCode(normalizedCode);
        const sanitizedCardKey = updatedCardKey ? {
          ...updatedCardKey,
          code: this.maskCardCode(updatedCardKey.code)
        } : null;

        const responsePayload = {
          cardKey: sanitizedCardKey,
          reward: this.processCardKeyReward(updatedCardKey || redeemResult.cardKey, redeemResult),
          vipResult: redeemResult.vipResult || null,
          pointsResult: redeemResult.pointsResult || null,
          order: redeemResult.order || null,
          commission: redeemResult.commission || null
        };

        this.log('info', '卡密使用成功', {
          keyCode: this.maskCardCode(normalizedCode),
          userId,
          type: updatedCardKey?.type || null,
          value: updatedCardKey?.value_amount || null
        });

        return this.formatSuccessResponse(responsePayload, '卡密使用成功');

      } catch (error) {
        this.handleError(error, 'useCardKey');
      }
    });
  }

  /**
   * 获取卡密列表
   */
  async getCardKeyList(filters = {}, pagination = {}) {
    return this.withPerformanceMonitoring('getCardKeyList', async () => {
      try {
        const { page, limit, offset } = this.normalizePaginationParams(
          pagination.page,
          pagination.limit
        );

        const normalizedFilters = this.normalizeCardKeyFilters(filters);

        const [cardKeys, totalCount] = await Promise.all([
          CardKey.findByFilters({ ...normalizedFilters, limit, offset }),
          CardKey.countByFilters(normalizedFilters)
        ]);

        // 脱敏处理
        const sanitizedKeys = cardKeys.map(key => ({
          ...key,
          key_code: key.key_code.substring(0, 6) + '***' + key.key_code.substring(key.key_code.length - 3)
        }));

        return this.formatPaginatedResponse(
          sanitizedKeys,
          { page, limit },
          totalCount
        );

      } catch (error) {
        this.handleError(error, 'getCardKeyList');
      }
    });
  }

  /**
   * 禁用卡密
   */
  async disableCardKey(keyId, adminUserId, reason) {
    return this.withPerformanceMonitoring('disableCardKey', async () => {
      try {
        this.validateRequired({ keyId, adminUserId }, ['keyId', 'adminUserId']);

        const cardKey = await CardKey.findById(keyId);
        if (!cardKey) {
          throw new Error('卡密不存在');
        }

        if (cardKey.status === 'used') {
          throw new Error('已使用的卡密无法禁用');
        }

        await CardKey.updateStatus(keyId, 'disabled', {
          disabled_by: adminUserId,
          disabled_at: new Date(),
          disable_reason: reason,
          updated_at: new Date()
        });

        this.log('info', '卡密禁用成功', { 
          keyId, 
          adminUserId, 
          reason 
        });

        return this.formatSuccessResponse(null, '卡密禁用成功');

      } catch (error) {
        this.handleError(error, 'disableCardKey');
      }
    });
  }

  /**
   * 获取卡密统计
   */
  async getCardKeyStats(dateRange = {}) {
    return this.withPerformanceMonitoring('getCardKeyStats', async () => {
      try {
        const cacheKey = `cardkey:stats:${JSON.stringify(dateRange)}`;

        return await this.getCached(cacheKey, async () => {
          const stats = await CardKey.getStats(dateRange);
          
          return this.formatSuccessResponse(stats, '获取卡密统计成功');
        }, 300);

      } catch (error) {
        this.handleError(error, 'getCardKeyStats');
      }
    });
  }

  /**
   * 处理卡密奖励
   */
  processCardKeyReward(cardKey, redeemContext = {}) {
    if (!cardKey) {
      return null;
    }

    const { vipResult = null, pointsResult = null } = redeemContext;

    if (cardKey.type === 'vip') {
      return {
        type: 'vip',
        vip_level: cardKey.vip_level,
        vip_days: cardKey.vip_days,
        vip_result: vipResult
      };
    }

    if (cardKey.type === 'points') {
      return {
        type: 'points',
        points: cardKey.points,
        points_result: pointsResult
      };
    }

    return {
      type: cardKey.type,
      value_amount: cardKey.value_amount || null
    };
  }

  /**
   * 脱敏展示卡密代码
   */
  maskCardCode(code = '') {
    if (typeof code !== 'string' || code.length <= 6) {
      return code;
    }

    return `${code.slice(0, 6)}***${code.slice(-3)}`;
  }

  /**
   * 奖励积分
   */
  async rewardPoints(userId, points, client) {
    const Points = require('../models/Points');
    
    await Points.addPoints(userId, {
      points,
      source: 'cardkey',
      description: `卡密兑换获得 ${points} 积分`
    }, client);

    return { type: 'points', value: points };
  }

  /**
   * 奖励VIP天数
   */
  async rewardVipDays(userId, days, client) {
    const VIP = require('../models/VIP');
    
    await VIP.extendVipDays(userId, days, client);

    return { type: 'vip_days', value: days };
  }

  /**
   * 升级VIP等级
   */
  async upgradeVipLevel(userId, level, client) {
    const VIP = require('../models/VIP');
    
    await VIP.upgradeVipLevel(userId, level, client);

    return { type: 'vip_level', value: level };
  }

  /**
   * 生成卡密代码
   */
  generateKeyCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) {
        result += '-';
      }
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 生成批次ID
   */
  generateBatchId() {
    const now = new Date();
    const timestamp = now.getTime();
    const random = Math.floor(Math.random() * 1000);
    return `BATCH_${timestamp}_${random}`;
  }

  /**
   * 标准化卡密过滤参数
   */
  normalizeCardKeyFilters(filters) {
    const {
      type,
      status,
      batch_id,
      created_by,
      used_by,
      start_date,
      end_date
    } = filters;

    return {
      type,
      status,
      batch_id,
      created_by: created_by ? parseInt(created_by) : undefined,
      used_by: used_by ? parseInt(used_by) : undefined,
      start_date,
      end_date
    };
  }
}

module.exports = new CardKeyService();
