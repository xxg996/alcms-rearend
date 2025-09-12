/**
 * 签到业务逻辑服务
 * 处理用户签到相关的所有业务操作
 */

const BaseService = require('./BaseService');
const Checkin = require('../models/Checkin');
const User = require('../models/User');
const Points = require('../models/Points');

class CheckinService extends BaseService {
  constructor() {
    super();
  }

  /**
   * 用户签到
   */
  async checkin(userId) {
    return this.withPerformanceMonitoring('checkin', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const user = await User.findById(userId);
        if (!user) {
          throw new Error('用户不存在');
        }

        // 检查今天是否已经签到
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const existingCheckin = await Checkin.findTodayCheckin(userId);
        if (existingCheckin) {
          throw new Error('今天已经签到过了');
        }

        const result = await this.executeInTransaction(async (client) => {
          // 获取连续签到天数
          const continuousDays = await this.calculateContinuousDays(userId);
          
          // 计算签到奖励
          const reward = this.calculateCheckinReward(continuousDays + 1);

          // 创建签到记录
          const checkinRecord = await Checkin.create({
            user_id: userId,
            checkin_date: today,
            continuous_days: continuousDays + 1,
            reward_points: reward.points,
            reward_type: reward.type,
            created_at: new Date()
          }, client);

          // 发放积分奖励
          if (reward.points > 0) {
            await Points.addPoints(userId, {
              points: reward.points,
              source: 'checkin',
              description: `签到奖励 - 连续${continuousDays + 1}天`
            }, client);
          }

          // 处理特殊奖励
          if (reward.extraReward) {
            await this.processExtraReward(userId, reward.extraReward, client);
          }

          return {
            checkin: checkinRecord,
            reward
          };
        });

        // 清除相关缓存
        await this.clearCheckinCache(userId);

        this.log('info', '用户签到成功', { 
          userId, 
          continuousDays: result.checkin.continuous_days,
          rewardPoints: result.reward.points
        });

        return this.formatSuccessResponse(result, '签到成功');

      } catch (error) {
        this.handleError(error, 'checkin');
      }
    });
  }

  /**
   * 补签
   */
  async makeupCheckin(userId, targetDate, cost = null) {
    return this.withPerformanceMonitoring('makeupCheckin', async () => {
      try {
        this.validateRequired({ userId, targetDate }, ['userId', 'targetDate']);

        const user = await User.findById(userId);
        if (!user) {
          throw new Error('用户不存在');
        }

        const target = new Date(targetDate);
        target.setHours(0, 0, 0, 0);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 验证补签日期
        if (target >= today) {
          throw new Error('只能补签过去的日期');
        }

        const daysDiff = Math.floor((today - target) / (1000 * 60 * 60 * 24));
        if (daysDiff > 7) {
          throw new Error('只能补签7天内的记录');
        }

        // 检查是否已经签到
        const existingCheckin = await Checkin.findByUserAndDate(userId, target);
        if (existingCheckin) {
          throw new Error('该日期已有签到记录');
        }

        // 计算补签成本
        const makeupCost = cost || this.calculateMakeupCost(daysDiff);

        const result = await this.executeInTransaction(async (client) => {
          // 检查积分是否足够
          const userPoints = await Points.getUserPoints(userId);
          if (userPoints.total_points < makeupCost) {
            throw new Error(`积分不足，需要${makeupCost}积分`);
          }

          // 扣除积分
          await Points.deductPoints(userId, {
            points: makeupCost,
            source: 'makeup_checkin',
            description: `补签消耗 - ${target.toISOString().split('T')[0]}`
          }, client);

          // 重新计算连续天数
          const continuousDays = await this.calculateContinuousDaysForMakeup(userId, target);

          // 创建补签记录
          const checkinRecord = await Checkin.create({
            user_id: userId,
            checkin_date: target,
            continuous_days: continuousDays,
            is_makeup: true,
            makeup_cost: makeupCost,
            created_at: new Date()
          }, client);

          return {
            checkin: checkinRecord,
            cost: makeupCost
          };
        });

        // 清除相关缓存
        await this.clearCheckinCache(userId);

        this.log('info', '用户补签成功', { 
          userId, 
          targetDate: target.toISOString().split('T')[0],
          cost: makeupCost
        });

        return this.formatSuccessResponse(result, '补签成功');

      } catch (error) {
        this.handleError(error, 'makeupCheckin');
      }
    });
  }

  /**
   * 获取用户签到状态
   */
  async getCheckinStatus(userId) {
    return this.withPerformanceMonitoring('getCheckinStatus', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const cacheKey = `checkin:status:${userId}`;

        return await this.getCached(cacheKey, async () => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const [todayCheckin, continuousDays, recentCheckins] = await Promise.all([
            Checkin.findTodayCheckin(userId),
            this.calculateContinuousDays(userId),
            Checkin.findRecentCheckins(userId, 30)
          ]);

          const status = {
            hasCheckedIn: !!todayCheckin,
            continuousDays,
            totalCheckins: recentCheckins.length,
            todayReward: todayCheckin ? {
              points: todayCheckin.reward_points,
              type: todayCheckin.reward_type
            } : null,
            nextReward: this.calculateCheckinReward(continuousDays + 1),
            recentCheckins: recentCheckins.map(checkin => ({
              date: checkin.checkin_date,
              points: checkin.reward_points,
              isToday: checkin.checkin_date.toDateString() === today.toDateString(),
              isMakeup: checkin.is_makeup
            }))
          };

          return this.formatSuccessResponse(status, '获取签到状态成功');
        }, 300);

      } catch (error) {
        this.handleError(error, 'getCheckinStatus');
      }
    });
  }

  /**
   * 获取签到历史
   */
  async getCheckinHistory(userId, filters = {}, pagination = {}) {
    return this.withPerformanceMonitoring('getCheckinHistory', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const { page, limit, offset } = this.normalizePaginationParams(
          pagination.page,
          pagination.limit
        );

        const normalizedFilters = {
          ...filters,
          user_id: userId
        };

        const [checkins, totalCount] = await Promise.all([
          Checkin.findByFilters({ ...normalizedFilters, limit, offset }),
          Checkin.countByFilters(normalizedFilters)
        ]);

        return this.formatPaginatedResponse(
          checkins,
          { page, limit },
          totalCount
        );

      } catch (error) {
        this.handleError(error, 'getCheckinHistory');
      }
    });
  }

  /**
   * 获取签到排行榜
   */
  async getCheckinLeaderboard(type = 'continuous', limit = 50) {
    return this.withPerformanceMonitoring('getCheckinLeaderboard', async () => {
      try {
        const cacheKey = `checkin:leaderboard:${type}:${limit}`;

        return await this.getCached(cacheKey, async () => {
          let leaderboard;

          switch (type) {
            case 'continuous':
              leaderboard = await Checkin.getContinuousLeaderboard(limit);
              break;
            case 'total':
              leaderboard = await Checkin.getTotalLeaderboard(limit);
              break;
            case 'monthly':
              leaderboard = await Checkin.getMonthlyLeaderboard(limit);
              break;
            default:
              throw new Error('无效的排行榜类型');
          }

          return this.formatSuccessResponse({
            type,
            leaderboard
          }, '获取签到排行榜成功');
        }, 600);

      } catch (error) {
        this.handleError(error, 'getCheckinLeaderboard');
      }
    });
  }

  /**
   * 获取签到统计
   */
  async getCheckinStats(dateRange = {}) {
    return this.withPerformanceMonitoring('getCheckinStats', async () => {
      try {
        const cacheKey = `checkin:stats:${JSON.stringify(dateRange)}`;

        return await this.getCached(cacheKey, async () => {
          const stats = await Checkin.getStats(dateRange);
          
          return this.formatSuccessResponse(stats, '获取签到统计成功');
        }, 300);

      } catch (error) {
        this.handleError(error, 'getCheckinStats');
      }
    });
  }

  /**
   * 计算连续签到天数
   */
  async calculateContinuousDays(userId) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const recentCheckins = await Checkin.findRecentCheckins(userId, 365);
    
    let continuousDays = 0;
    let currentDate = new Date(yesterday);

    for (const checkin of recentCheckins) {
      const checkinDate = new Date(checkin.checkin_date);
      checkinDate.setHours(0, 0, 0, 0);

      if (checkinDate.getTime() === currentDate.getTime()) {
        continuousDays++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return continuousDays;
  }

  /**
   * 计算补签时的连续天数
   */
  async calculateContinuousDaysForMakeup(userId, targetDate) {
    // 这里需要更复杂的逻辑来重新计算连续天数
    // 暂时返回1，实际应该根据补签日期前后的签到记录计算
    return 1;
  }

  /**
   * 计算签到奖励
   */
  calculateCheckinReward(continuousDays) {
    let points = 10; // 基础积分
    let type = 'normal';
    let extraReward = null;

    // 连续签到奖励递增
    if (continuousDays <= 7) {
      points = 10 + (continuousDays - 1) * 2;
    } else if (continuousDays <= 30) {
      points = 24 + Math.floor((continuousDays - 7) / 3) * 5;
    } else {
      points = 50;
    }

    // 特殊日期奖励
    if (continuousDays % 7 === 0) {
      type = 'weekly';
      points *= 2;
    }

    if (continuousDays % 30 === 0) {
      type = 'monthly';
      points *= 3;
      extraReward = {
        type: 'vip_days',
        value: 1
      };
    }

    return { points, type, extraReward };
  }

  /**
   * 计算补签成本
   */
  calculateMakeupCost(daysDiff) {
    return Math.min(daysDiff * 10, 50); // 每天10积分，最多50积分
  }

  /**
   * 处理额外奖励
   */
  async processExtraReward(userId, extraReward, client) {
    switch (extraReward.type) {
      case 'vip_days':
        const VIP = require('../models/VIP');
        await VIP.extendVipDays(userId, extraReward.value, client);
        break;
      default:
        this.log('warn', '未处理的额外奖励类型', { 
          userId, 
          rewardType: extraReward.type 
        });
    }
  }

  /**
   * 清除签到相关缓存
   */
  async clearCheckinCache(userId) {
    await Promise.all([
      this.clearCache(`checkin:status:${userId}`),
      this.clearCache('checkin:leaderboard:*'),
      this.clearCache('checkin:stats:*')
    ]);
  }
}

module.exports = new CheckinService();