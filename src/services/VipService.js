/**
 * VIP业务逻辑服务
 * 处理VIP会员管理相关的所有业务操作
 */

const BaseService = require('./BaseService');
const VIP = require('../models/VIP');
const User = require('../models/User');
const Points = require('../models/Points');

class VipService extends BaseService {
  constructor() {
    super();
  }

  /**
   * 获取VIP信息
   */
  async getVipInfo(userId) {
    return this.withPerformanceMonitoring('getVipInfo', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const cacheKey = `vip:info:${userId}`;

        return await this.getCached(cacheKey, async () => {
          const vipInfo = await VIP.findByUserId(userId);
          
          if (!vipInfo) {
            return this.formatSuccessResponse({
              isVip: false,
              level: 0,
              expire_at: null,
              benefits: this.getVipBenefits(0)
            }, '获取VIP信息成功');
          }

          const now = new Date();
          const isActive = vipInfo.expire_at && new Date(vipInfo.expire_at) > now;

          return this.formatSuccessResponse({
            isVip: isActive,
            level: isActive ? vipInfo.level : 0,
            expire_at: vipInfo.expire_at,
            days_remaining: isActive ? 
              Math.ceil((new Date(vipInfo.expire_at) - now) / (1000 * 60 * 60 * 24)) : 0,
            benefits: this.getVipBenefits(isActive ? vipInfo.level : 0),
            history: vipInfo
          }, '获取VIP信息成功');
        }, 300);

      } catch (error) {
        this.handleError(error, 'getVipInfo');
      }
    });
  }

  /**
   * 购买VIP
   */
  async purchaseVip(userId, packageData) {
    return this.withPerformanceMonitoring('purchaseVip', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);
        this.validateRequired(packageData, ['level', 'days', 'points_cost']);

        const { level, days, points_cost, package_name } = packageData;

        const user = await User.findById(userId);
        if (!user) {
          throw new Error('用户不存在');
        }

        const result = await this.executeInTransaction(async (client) => {
          // 检查积分是否足够
          const userPoints = await Points.getUserPoints(userId);
          if (userPoints.total_points < points_cost) {
            throw new Error(`积分不足，需要${points_cost}积分`);
          }

          // 扣除积分
          await Points.deductPoints(userId, {
            points: points_cost,
            source: 'vip_purchase',
            description: `购买${package_name || `VIP${level}`} ${days}天`
          }, client);

          // 获取现有VIP信息
          let existingVip = await VIP.findByUserId(userId);
          
          if (!existingVip) {
            // 新用户，创建VIP记录
            const expire_at = new Date();
            expire_at.setDate(expire_at.getDate() + days);

            existingVip = await VIP.create({
              user_id: userId,
              level,
              expire_at,
              total_days: days,
              created_at: new Date(),
              updated_at: new Date()
            }, client);
          } else {
            // 现有VIP，延长时间或升级等级
            const now = new Date();
            let newExpireAt = new Date(existingVip.expire_at);
            
            // 如果VIP已过期，从今天开始计算
            if (newExpireAt < now) {
              newExpireAt = new Date(now);
            }
            
            newExpireAt.setDate(newExpireAt.getDate() + days);

            existingVip = await VIP.updateById(existingVip.id, {
              level: Math.max(existingVip.level, level), // 取更高等级
              expire_at: newExpireAt,
              total_days: existingVip.total_days + days,
              updated_at: new Date()
            }, client);
          }

          // 记录购买历史
          await this.recordVipPurchase(userId, packageData, client);

          return existingVip;
        });

        // 清除相关缓存
        await this.clearVipCache(userId);

        this.log('info', 'VIP购买成功', { 
          userId, 
          level, 
          days, 
          points_cost 
        });

        return this.formatSuccessResponse(result, 'VIP购买成功');

      } catch (error) {
        this.handleError(error, 'purchaseVip');
      }
    });
  }

  /**
   * 升级VIP等级
   */
  async upgradeVipLevel(userId, targetLevel) {
    return this.withPerformanceMonitoring('upgradeVipLevel', async () => {
      try {
        this.validateRequired({ userId, targetLevel }, ['userId', 'targetLevel']);

        if (targetLevel < 1 || targetLevel > 5) {
          throw new Error('VIP等级必须在1-5之间');
        }

        const existingVip = await VIP.findByUserId(userId);
        if (!existingVip) {
          throw new Error('用户不是VIP会员');
        }

        const now = new Date();
        if (!existingVip.expire_at || new Date(existingVip.expire_at) <= now) {
          throw new Error('VIP已过期，无法升级');
        }

        if (existingVip.level >= targetLevel) {
          throw new Error('当前等级已经等于或高于目标等级');
        }

        const updatedVip = await VIP.updateById(existingVip.id, {
          level: targetLevel,
          updated_at: new Date()
        });

        // 清除相关缓存
        await this.clearVipCache(userId);

        this.log('info', 'VIP等级升级成功', { 
          userId, 
          fromLevel: existingVip.level,
          toLevel: targetLevel
        });

        return this.formatSuccessResponse(updatedVip, 'VIP等级升级成功');

      } catch (error) {
        this.handleError(error, 'upgradeVipLevel');
      }
    });
  }

  /**
   * 延长VIP时间
   */
  async extendVipDays(userId, days) {
    return this.withPerformanceMonitoring('extendVipDays', async () => {
      try {
        this.validateRequired({ userId, days }, ['userId', 'days']);

        if (days <= 0) {
          throw new Error('延长天数必须大于0');
        }

        let vipInfo = await VIP.findByUserId(userId);
        
        if (!vipInfo) {
          // 用户不是VIP，创建新记录
          const expire_at = new Date();
          expire_at.setDate(expire_at.getDate() + days);

          vipInfo = await VIP.create({
            user_id: userId,
            level: 1, // 默认等级1
            expire_at,
            total_days: days,
            created_at: new Date(),
            updated_at: new Date()
          });
        } else {
          // 延长现有VIP
          const now = new Date();
          let newExpireAt = new Date(vipInfo.expire_at);
          
          // 如果VIP已过期，从今天开始计算
          if (newExpireAt < now) {
            newExpireAt = new Date(now);
          }
          
          newExpireAt.setDate(newExpireAt.getDate() + days);

          vipInfo = await VIP.updateById(vipInfo.id, {
            expire_at: newExpireAt,
            total_days: vipInfo.total_days + days,
            updated_at: new Date()
          });
        }

        // 清除相关缓存
        await this.clearVipCache(userId);

        this.log('info', 'VIP时间延长成功', { userId, days });

        return this.formatSuccessResponse(vipInfo, `VIP时间延长${days}天`);

      } catch (error) {
        this.handleError(error, 'extendVipDays');
      }
    });
  }

  /**
   * 获取VIP套餐列表
   */
  async getVipPackages() {
    return this.withPerformanceMonitoring('getVipPackages', async () => {
      try {
        const cacheKey = 'vip:packages';

        return await this.getCached(cacheKey, async () => {
          const packages = this.getAvailablePackages();
          
          return this.formatSuccessResponse(packages, '获取VIP套餐成功');
        }, 3600); // 缓存1小时

      } catch (error) {
        this.handleError(error, 'getVipPackages');
      }
    });
  }

  /**
   * 获取VIP统计信息
   */
  async getVipStats(dateRange = {}) {
    return this.withPerformanceMonitoring('getVipStats', async () => {
      try {
        const cacheKey = `vip:stats:${JSON.stringify(dateRange)}`;

        return await this.getCached(cacheKey, async () => {
          const stats = await VIP.getStats(dateRange);
          
          return this.formatSuccessResponse(stats, '获取VIP统计成功');
        }, 300);

      } catch (error) {
        this.handleError(error, 'getVipStats');
      }
    });
  }

  /**
   * 检查VIP权限
   */
  async checkVipPermission(userId, requiredLevel = 1) {
    return this.withPerformanceMonitoring('checkVipPermission', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const vipInfo = await VIP.findByUserId(userId);
        
        if (!vipInfo) {
          return this.formatErrorResponse('用户不是VIP会员');
        }

        const now = new Date();
        const isActive = vipInfo.expire_at && new Date(vipInfo.expire_at) > now;

        if (!isActive) {
          return this.formatErrorResponse('VIP已过期');
        }

        if (vipInfo.level < requiredLevel) {
          return this.formatErrorResponse(`权限不足，需要VIP${requiredLevel}及以上`);
        }

        return this.formatSuccessResponse({
          hasPermission: true,
          level: vipInfo.level,
          expire_at: vipInfo.expire_at
        }, 'VIP权限验证通过');

      } catch (error) {
        this.handleError(error, 'checkVipPermission');
      }
    });
  }

  /**
   * 获取VIP权益
   */
  getVipBenefits(level) {
    const benefits = {
      0: {
        download_speed: '普通',
        daily_downloads: 5,
        resource_access: '基础资源',
        ad_free: false,
        priority_support: false
      },
      1: {
        download_speed: '快速',
        daily_downloads: 20,
        resource_access: 'VIP1资源',
        ad_free: true,
        priority_support: false
      },
      2: {
        download_speed: '高速',
        daily_downloads: 50,
        resource_access: 'VIP2资源',
        ad_free: true,
        priority_support: true
      },
      3: {
        download_speed: '超高速',
        daily_downloads: 100,
        resource_access: 'VIP3资源',
        ad_free: true,
        priority_support: true
      },
      4: {
        download_speed: '极速',
        daily_downloads: 200,
        resource_access: 'VIP4资源',
        ad_free: true,
        priority_support: true
      },
      5: {
        download_speed: '闪电',
        daily_downloads: -1, // 无限制
        resource_access: '所有资源',
        ad_free: true,
        priority_support: true
      }
    };

    return benefits[level] || benefits[0];
  }

  /**
   * 获取可用的VIP套餐
   */
  getAvailablePackages() {
    return [
      {
        id: 'vip1_7d',
        name: 'VIP1 周卡',
        level: 1,
        days: 7,
        points_cost: 50,
        original_price: 70,
        discount: 0.71
      },
      {
        id: 'vip1_30d',
        name: 'VIP1 月卡',
        level: 1,
        days: 30,
        points_cost: 200,
        original_price: 300,
        discount: 0.67
      },
      {
        id: 'vip2_30d',
        name: 'VIP2 月卡',
        level: 2,
        days: 30,
        points_cost: 400,
        original_price: 600,
        discount: 0.67
      },
      {
        id: 'vip3_30d',
        name: 'VIP3 月卡',
        level: 3,
        days: 30,
        points_cost: 800,
        original_price: 1200,
        discount: 0.67
      },
      {
        id: 'vip5_365d',
        name: 'VIP5 年卡',
        level: 5,
        days: 365,
        points_cost: 5000,
        original_price: 10000,
        discount: 0.5
      }
    ];
  }

  /**
   * 记录VIP购买历史
   */
  async recordVipPurchase(userId, packageData, client) {
    // 这里可以创建VIP购买历史表来记录
    this.log('info', 'VIP购买记录', {
      userId,
      package: packageData
    });
  }

  /**
   * 清除VIP相关缓存
   */
  async clearVipCache(userId) {
    await Promise.all([
      this.clearCache(`vip:info:${userId}`),
      this.clearCache('vip:stats:*')
    ]);
  }

  /**
   * 批量检查VIP过期
   */
  async checkExpiredVips() {
    return this.withPerformanceMonitoring('checkExpiredVips', async () => {
      try {
        const expiredVips = await VIP.findExpiredVips();
        
        for (const vip of expiredVips) {
          // 清除过期VIP的缓存
          await this.clearVipCache(vip.user_id);
          
          this.log('info', 'VIP已过期', { 
            userId: vip.user_id, 
            level: vip.level,
            expired_at: vip.expire_at
          });
        }

        return this.formatSuccessResponse({
          count: expiredVips.length,
          expired_vips: expiredVips
        }, `处理了${expiredVips.length}个过期VIP`);

      } catch (error) {
        this.handleError(error, 'checkExpiredVips');
      }
    });
  }
}

module.exports = new VipService();