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
        this.validateRequired(keyData, ['type', 'value', 'count']);

        const { type, value, count, expire_days, remark } = keyData;

        if (count <= 0 || count > 1000) {
          throw new Error('卡密数量必须在1-1000之间');
        }

        const keys = [];
        const batch_id = this.generateBatchId();
        const expire_at = expire_days ? new Date(Date.now() + expire_days * 24 * 60 * 60 * 1000) : null;

        for (let i = 0; i < count; i++) {
          keys.push({
            key_code: this.generateKeyCode(),
            type,
            value: parseFloat(value),
            status: 'unused',
            batch_id,
            expire_at,
            remark,
            created_by: adminUserId,
            created_at: new Date(),
            updated_at: new Date()
          });
        }

        const createdKeys = await CardKey.createBatch(keys);

        this.log('info', '批量生成卡密成功', { 
          count, 
          batch_id, 
          adminUserId 
        });

        return this.formatSuccessResponse({
          keys: createdKeys,
          batch_id,
          count: createdKeys.length
        }, `成功生成 ${count} 个卡密`);

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

        const cardKey = await CardKey.findByKeyCode(keyCode);
        if (!cardKey) {
          throw new Error('卡密不存在');
        }

        if (cardKey.status === 'used') {
          throw new Error('卡密已被使用');
        }

        if (cardKey.status === 'disabled') {
          throw new Error('卡密已被禁用');
        }

        if (cardKey.expire_at && new Date() > cardKey.expire_at) {
          throw new Error('卡密已过期');
        }

        const user = await User.findById(userId);
        if (!user) {
          throw new Error('用户不存在');
        }

        const result = await this.executeInTransaction(async (client) => {
          // 标记卡密为已使用
          await CardKey.markAsUsed(cardKey.id, userId, client);

          // 根据卡密类型执行相应操作
          const rewardResult = await this.processCardKeyReward(cardKey, user, client);

          return {
            cardKey: await CardKey.findById(cardKey.id, client),
            reward: rewardResult
          };
        });

        this.log('info', '卡密使用成功', { 
          keyCode: keyCode.substring(0, 6) + '***',
          userId,
          type: cardKey.type,
          value: cardKey.value
        });

        return this.formatSuccessResponse(result, '卡密使用成功');

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
  async processCardKeyReward(cardKey, user, client) {
    const { type, value } = cardKey;

    switch (type) {
      case 'points':
        return await this.rewardPoints(user.id, value, client);
      case 'vip_days':
        return await this.rewardVipDays(user.id, value, client);
      case 'vip_level':
        return await this.upgradeVipLevel(user.id, value, client);
      default:
        throw new Error(`不支持的卡密类型: ${type}`);
    }
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