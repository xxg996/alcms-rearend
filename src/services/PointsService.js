/**
 * 积分业务逻辑服务
 * 处理积分管理相关的所有业务操作
 */

const BaseService = require('./BaseService');
const Points = require('../models/Points');
const User = require('../models/User');

class PointsService extends BaseService {
  constructor() {
    super();
  }

  /**
   * 获取用户积分信息
   */
  async getUserPoints(userId) {
    return this.withPerformanceMonitoring('getUserPoints', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const cacheKey = `points:user:${userId}`;

        return await this.getCached(cacheKey, async () => {
          const pointsInfo = await Points.getUserPoints(userId);
          
          if (!pointsInfo) {
            // 如果用户没有积分记录，创建初始记录
            const initialPoints = await Points.create({
              user_id: userId,
              total_points: 0,
              available_points: 0,
              used_points: 0,
              created_at: new Date(),
              updated_at: new Date()
            });

            return this.formatSuccessResponse(initialPoints, '获取用户积分成功');
          }

          return this.formatSuccessResponse(pointsInfo, '获取用户积分成功');
        }, 300);

      } catch (error) {
        this.handleError(error, 'getUserPoints');
      }
    });
  }

  /**
   * 增加积分
   */
  async addPoints(userId, pointsData) {
    return this.withPerformanceMonitoring('addPoints', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);
        this.validateRequired(pointsData, ['points', 'source', 'description']);

        const { points, source, description, reference_id, expires_at } = pointsData;

        if (points <= 0) {
          throw new Error('积分数量必须大于0');
        }

        if (points > 10000) {
          throw new Error('单次增加积分不能超过10000');
        }

        const result = await this.executeInTransaction(async (client) => {
          // 记录积分变动历史
          const pointsTransaction = await Points.createTransaction({
            user_id: userId,
            type: 'earn',
            points,
            source,
            description,
            reference_id,
            expires_at,
            created_at: new Date()
          }, client);

          // 更新用户积分总额
          await Points.addPoints(userId, {
            points,
            source,
            description
          }, client);

          return pointsTransaction;
        });

        // 清除相关缓存
        await this.clearPointsCache(userId);

        this.log('info', '积分增加成功', { 
          userId, 
          points, 
          source, 
          transactionId: result.id 
        });

        return this.formatSuccessResponse(result, `成功增加 ${points} 积分`);

      } catch (error) {
        this.handleError(error, 'addPoints');
      }
    });
  }

  /**
   * 扣除积分
   */
  async deductPoints(userId, pointsData) {
    return this.withPerformanceMonitoring('deductPoints', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);
        this.validateRequired(pointsData, ['points', 'source', 'description']);

        const { points, source, description, reference_id } = pointsData;

        if (points <= 0) {
          throw new Error('扣除积分数量必须大于0');
        }

        // 检查用户积分是否足够
        const userPoints = await Points.getUserPoints(userId);
        if (!userPoints || userPoints.available_points < points) {
          throw new Error('积分余额不足');
        }

        const result = await this.executeInTransaction(async (client) => {
          // 记录积分变动历史
          const pointsTransaction = await Points.createTransaction({
            user_id: userId,
            type: 'spend',
            points: -points,
            source,
            description,
            reference_id,
            created_at: new Date()
          }, client);

          // 扣除用户积分
          await Points.deductPoints(userId, {
            points,
            source,
            description
          }, client);

          return pointsTransaction;
        });

        // 清除相关缓存
        await this.clearPointsCache(userId);

        this.log('info', '积分扣除成功', { 
          userId, 
          points, 
          source, 
          transactionId: result.id 
        });

        return this.formatSuccessResponse(result, `成功扣除 ${points} 积分`);

      } catch (error) {
        this.handleError(error, 'deductPoints');
      }
    });
  }

  /**
   * 转移积分
   */
  async transferPoints(fromUserId, toUserId, points, description = '用户转账') {
    return this.withPerformanceMonitoring('transferPoints', async () => {
      try {
        this.validateRequired({ fromUserId, toUserId, points }, 
          ['fromUserId', 'toUserId', 'points']);

        if (fromUserId === toUserId) {
          throw new Error('不能向自己转账');
        }

        if (points <= 0) {
          throw new Error('转账积分必须大于0');
        }

        if (points > 1000) {
          throw new Error('单次转账不能超过1000积分');
        }

        // 检查发送方积分是否足够
        const fromUserPoints = await Points.getUserPoints(fromUserId);
        if (!fromUserPoints || fromUserPoints.available_points < points) {
          throw new Error('发送方积分余额不足');
        }

        // 验证接收方用户是否存在
        const toUser = await User.findById(toUserId);
        if (!toUser) {
          throw new Error('接收方用户不存在');
        }

        const transferId = this.generateTransferId();

        const result = await this.executeInTransaction(async (client) => {
          // 扣除发送方积分
          const deductTransaction = await Points.createTransaction({
            user_id: fromUserId,
            type: 'transfer_out',
            points: -points,
            source: 'transfer',
            description: `转账给用户${toUser.username}: ${description}`,
            reference_id: transferId,
            created_at: new Date()
          }, client);

          await Points.deductPoints(fromUserId, {
            points,
            source: 'transfer',
            description: `转账给用户${toUser.username}`
          }, client);

          // 增加接收方积分
          const addTransaction = await Points.createTransaction({
            user_id: toUserId,
            type: 'transfer_in',
            points: points,
            source: 'transfer',
            description: `来自用户转账: ${description}`,
            reference_id: transferId,
            created_at: new Date()
          }, client);

          await Points.addPoints(toUserId, {
            points,
            source: 'transfer',
            description: '来自用户转账'
          }, client);

          return {
            transfer_id: transferId,
            from_transaction: deductTransaction,
            to_transaction: addTransaction
          };
        });

        // 清除相关缓存
        await Promise.all([
          this.clearPointsCache(fromUserId),
          this.clearPointsCache(toUserId)
        ]);

        this.log('info', '积分转账成功', { 
          fromUserId, 
          toUserId, 
          points, 
          transferId 
        });

        return this.formatSuccessResponse(result, '转账成功');

      } catch (error) {
        this.handleError(error, 'transferPoints');
      }
    });
  }

  /**
   * 获取积分交易历史
   */
  async getPointsHistory(userId, filters = {}, pagination = {}) {
    return this.withPerformanceMonitoring('getPointsHistory', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const { page, limit, offset } = this.normalizePaginationParams(
          pagination.page,
          pagination.limit
        );

        const normalizedFilters = {
          ...this.normalizePointsFilters(filters),
          user_id: userId
        };

        const [transactions, totalCount] = await Promise.all([
          Points.findTransactionsByFilters({ ...normalizedFilters, limit, offset }),
          Points.countTransactionsByFilters(normalizedFilters)
        ]);

        return this.formatPaginatedResponse(
          transactions,
          { page, limit },
          totalCount
        );

      } catch (error) {
        this.handleError(error, 'getPointsHistory');
      }
    });
  }

  /**
   * 获取积分排行榜
   */
  async getPointsLeaderboard(type = 'total', limit = 50) {
    return this.withPerformanceMonitoring('getPointsLeaderboard', async () => {
      try {
        const cacheKey = `points:leaderboard:${type}:${limit}`;

        return await this.getCached(cacheKey, async () => {
          let leaderboard;

          switch (type) {
            case 'total':
              leaderboard = await Points.getTotalPointsLeaderboard(limit);
              break;
            case 'weekly':
              leaderboard = await Points.getWeeklyPointsLeaderboard(limit);
              break;
            case 'monthly':
              leaderboard = await Points.getMonthlyPointsLeaderboard(limit);
              break;
            default:
              throw new Error('无效的排行榜类型');
          }

          return this.formatSuccessResponse({
            type,
            leaderboard
          }, '获取积分排行榜成功');
        }, 600);

      } catch (error) {
        this.handleError(error, 'getPointsLeaderboard');
      }
    });
  }

  /**
   * 获取积分统计
   */
  async getPointsStats(dateRange = {}) {
    return this.withPerformanceMonitoring('getPointsStats', async () => {
      try {
        const cacheKey = `points:stats:${JSON.stringify(dateRange)}`;

        return await this.getCached(cacheKey, async () => {
          const stats = await Points.getOverallStats(dateRange);
          
          return this.formatSuccessResponse(stats, '获取积分统计成功');
        }, 300);

      } catch (error) {
        this.handleError(error, 'getPointsStats');
      }
    });
  }

  /**
   * 处理过期积分
   */
  async processExpiredPoints() {
    return this.withPerformanceMonitoring('processExpiredPoints', async () => {
      try {
        const expiredTransactions = await Points.findExpiredTransactions();
        let totalExpiredPoints = 0;

        await this.executeInTransaction(async (client) => {
          for (const transaction of expiredTransactions) {
            // 扣除过期积分
            await Points.deductPoints(transaction.user_id, {
              points: transaction.points,
              source: 'expired',
              description: '积分过期自动扣除'
            }, client);

            // 记录过期交易
            await Points.createTransaction({
              user_id: transaction.user_id,
              type: 'expired',
              points: -transaction.points,
              source: 'system',
              description: `积分过期 - 原因: ${transaction.description}`,
              reference_id: transaction.id,
              created_at: new Date()
            }, client);

            totalExpiredPoints += transaction.points;
          }
        });

        this.log('info', '过期积分处理完成', { 
          expiredCount: expiredTransactions.length,
          totalExpiredPoints 
        });

        return this.formatSuccessResponse({
          expired_transactions: expiredTransactions.length,
          total_expired_points: totalExpiredPoints
        }, `处理了${expiredTransactions.length}条过期积分记录`);

      } catch (error) {
        this.handleError(error, 'processExpiredPoints');
      }
    });
  }

  /**
   * 积分兑换
   */
  async exchangePoints(userId, exchangeData) {
    return this.withPerformanceMonitoring('exchangePoints', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);
        this.validateRequired(exchangeData, ['type', 'points_cost', 'reward']);

        const { type, points_cost, reward, description } = exchangeData;

        // 检查积分是否足够
        const userPoints = await Points.getUserPoints(userId);
        if (!userPoints || userPoints.available_points < points_cost) {
          throw new Error('积分余额不足');
        }

        const result = await this.executeInTransaction(async (client) => {
          // 扣除积分
          await Points.deductPoints(userId, {
            points: points_cost,
            source: 'exchange',
            description: description || `兑换${type}`
          }, client);

          // 处理兑换奖励
          const rewardResult = await this.processExchangeReward(userId, type, reward, client);

          return {
            exchange_type: type,
            points_cost,
            reward: rewardResult
          };
        });

        // 清除相关缓存
        await this.clearPointsCache(userId);

        this.log('info', '积分兑换成功', { 
          userId, 
          type, 
          points_cost 
        });

        return this.formatSuccessResponse(result, '兑换成功');

      } catch (error) {
        this.handleError(error, 'exchangePoints');
      }
    });
  }

  /**
   * 处理兑换奖励
   */
  async processExchangeReward(userId, type, reward, client) {
    switch (type) {
      case 'vip_days':
        const VIP = require('../models/VIP');
        await VIP.extendVipDays(userId, reward.days, client);
        return { type: 'vip_days', value: reward.days };

      case 'download_quota':
        // 这里可以增加下载配额逻辑
        return { type: 'download_quota', value: reward.quota };

      default:
        throw new Error(`不支持的兑换类型: ${type}`);
    }
  }

  /**
   * 生成转账ID
   */
  generateTransferId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `TRANSFER_${timestamp}_${random}`;
  }

  /**
   * 标准化积分过滤参数
   */
  normalizePointsFilters(filters) {
    const {
      type,
      source,
      start_date,
      end_date
    } = filters;

    return {
      type,
      source,
      start_date,
      end_date
    };
  }

  /**
   * 清除积分相关缓存
   */
  async clearPointsCache(userId) {
    await Promise.all([
      this.clearCache(`points:user:${userId}`),
      this.clearCache('points:leaderboard:*'),
      this.clearCache('points:stats:*')
    ]);
  }

  /**
   * 批量发放积分奖励
   */
  async batchRewardPoints(userIds, pointsData) {
    return this.withPerformanceMonitoring('batchRewardPoints', async () => {
      try {
        this.validateRequired(pointsData, ['points', 'source', 'description']);

        if (!Array.isArray(userIds) || userIds.length === 0) {
          throw new Error('用户ID列表不能为空');
        }

        if (userIds.length > 1000) {
          throw new Error('一次最多给1000个用户发放积分');
        }

        const { points, source, description } = pointsData;
        const results = [];
        const errors = [];

        await this.executeInTransaction(async (client) => {
          for (const userId of userIds) {
            try {
              await Points.addPoints(userId, {
                points,
                source,
                description
              }, client);

              results.push({ userId, points });
            } catch (error) {
              errors.push({ userId, error: error.message });
            }
          }
        });

        this.log('info', '批量积分发放完成', { 
          total: userIds.length,
          success: results.length,
          failed: errors.length,
          totalPoints: results.length * points
        });

        return this.formatSuccessResponse({
          results,
          errors,
          summary: {
            total: userIds.length,
            success: results.length,
            failed: errors.length,
            total_points_distributed: results.length * points
          }
        }, '批量积分发放完成');

      } catch (error) {
        this.handleError(error, 'batchRewardPoints');
      }
    });
  }
}

module.exports = new PointsService();