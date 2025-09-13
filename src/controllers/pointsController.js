/**
 * @fileoverview 积分系统控制器
 * @description 处理用户积分管理、积分记录查询、积分转账、排行榜等操作
 * @module pointsController
 * @requires ../models/Points
 * @requires ../utils/logger
 * @author AI Assistant
 * @version 1.0.0
 */

const Points = require('../models/Points');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/points/my-info:
 *   get:
 *     tags: [积分系统]
 *     summary: 获取当前用户积分信息
 *     description: 获取登录用户的详细积分信息，包括当前积分、累计获得、累计消费等
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 积分信息获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserPoints'
 *             example:
 *               success: true
 *               message: "积分信息获取成功"
 *               data:
 *                 user_id: 1
 *                 username: "testuser"
 *                 nickname: "测试用户"
 *                 current_points: 2500
 *                 total_earned: 5000
 *                 total_spent: 2500
 *                 last_updated: "2025-09-12T10:30:00.000Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: 用户不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "用户不存在"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getMyPoints = async (req, res) => {
  try {
    const userId = req.user.id;
    const pointsInfo = await Points.getUserPoints(userId);
    
    if (!pointsInfo) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      message: '积分信息获取成功',
      data: pointsInfo
    });
  } catch (error) {
    logger.error('获取积分信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取积分信息失败'
    });
  }
};

/**
 * @swagger
 * /api/points/my-records:
 *   get:
 *     tags: [积分系统]
 *     summary: 获取当前用户积分记录
 *     description: 分页获取登录用户的积分变动记录，包括获得、消费、转账等操作记录
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 每页记录数
 *         example: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: 偏移量
 *         example: 0
 *     responses:
 *       200:
 *         description: 积分记录获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         records:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/PointsRecord'
 *                         total:
 *                           type: integer
 *                           description: 总记录数
 *                         has_more:
 *                           type: boolean
 *                           description: 是否还有更多记录
 *             example:
 *               success: true
 *               message: "积分记录获取成功"
 *               data:
 *                 records:
 *                   - id: 1001
 *                     user_id: 1
 *                     amount: 100
 *                     balance_after: 2500
 *                     type: "checkin"
 *                     description: "每日签到奖励"
 *                     created_at: "2025-09-12T10:30:00.000Z"
 *                 total: 150
 *                 has_more: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getMyPointsRecords = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;
    
    const records = await Points.getUserPointsRecords(userId, parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      message: '积分记录获取成功',
      data: records
    });
  } catch (error) {
    logger.error('获取积分记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取积分记录失败'
    });
  }
};

/**
 * @swagger
 * /api/points/users/{userId}/info:
 *   get:
 *     tags: [积分管理]
 *     summary: 获取用户积分信息
 *     description: 管理员功能，获取指定用户的详细积分信息
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: 用户ID
 *         example: 123
 *     responses:
 *       200:
 *         description: 用户积分信息获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserPoints'
 *             example:
 *               success: true
 *               message: "用户积分信息获取成功"
 *               data:
 *                 user_id: 123
 *                 username: "targetuser"
 *                 nickname: "目标用户"
 *                 current_points: 1500
 *                 total_earned: 3000
 *                 total_spent: 1500
 *                 last_updated: "2025-09-12T09:15:00.000Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: 用户不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "用户不存在"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getUserPoints = async (req, res) => {
  try {
    const { userId } = req.params;
    const pointsInfo = await Points.getUserPoints(parseInt(userId));
    
    if (!pointsInfo) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      message: '用户积分信息获取成功',
      data: pointsInfo
    });
  } catch (error) {
    logger.error('获取用户积分信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户积分信息失败'
    });
  }
};

/**
 * @swagger
 * /api/points/users/{userId}/records:
 *   get:
 *     tags: [积分管理]
 *     summary: 获取用户积分记录
 *     description: 管理员功能，分页获取指定用户的积分变动记录
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: 用户ID
 *         example: 123
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 每页记录数
 *         example: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: 偏移量
 *         example: 0
 *     responses:
 *       200:
 *         description: 用户积分记录获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         records:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/PointsRecord'
 *                         total:
 *                           type: integer
 *                           description: 总记录数
 *                         has_more:
 *                           type: boolean
 *                           description: 是否还有更多记录
 *             example:
 *               success: true
 *               message: "用户积分记录获取成功"
 *               data:
 *                 records:
 *                   - id: 2001
 *                     user_id: 123
 *                     amount: -500
 *                     balance_after: 1000
 *                     type: "resource_download"
 *                     description: "下载资源扣费"
 *                     related_id: 456
 *                     created_at: "2025-09-11T14:20:00.000Z"
 *                 total: 75
 *                 has_more: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getUserPointsRecords = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    const records = await Points.getUserPointsRecords(parseInt(userId), parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      message: '用户积分记录获取成功',
      data: records
    });
  } catch (error) {
    logger.error('获取用户积分记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户积分记录失败'
    });
  }
};

/**
 * @swagger
 * /api/points/users/{userId}/adjust:
 *   post:
 *     tags: [积分管理]
 *     summary: 调整用户积分
 *     description: 管理员功能，手动调整指定用户的积分数量，可以增加或扣除积分
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: 用户ID
 *         example: 123
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdjustPointsRequest'
 *           example:
 *             amount: 500
 *             description: "管理员手动调整积分"
 *     responses:
 *       200:
 *         description: 积分调整成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         record_id:
 *                           type: integer
 *                           description: 积分记录ID
 *                         balance_after:
 *                           type: integer
 *                           description: 调整后的积分余额
 *                         adjustment_amount:
 *                           type: integer
 *                           description: 调整量
 *             example:
 *               success: true
 *               message: "积分调整成功：增加500积分"
 *               data:
 *                 record_id: 3001
 *                 balance_after: 2000
 *                 adjustment_amount: 500
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "积分数量必须是有效数字"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: 用户不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "用户不存在"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const adjustUserPoints = async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, description = '' } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({
        success: false,
        message: '积分数量必须是有效数字'
      });
    }

    const adminId = req.user.id;
    const result = await Points.adjustPoints(parseInt(userId), parseInt(amount), description, adminId);
    
    res.json({
      success: true,
      message: `积分调整成功：${amount > 0 ? '增加' : '扣除'}${Math.abs(amount)}积分`,
      data: result
    });
  } catch (error) {
    logger.error('调整用户积分失败:', error);
    
    if (error.message === '用户不存在') {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '调整用户积分失败'
    });
  }
};

/**
 * @swagger
 * /api/points/batch/grant:
 *   post:
 *     tags: [积分管理]
 *     summary: 批量发放积分
 *     description: 管理员功能，一次性向多个用户发放相同数量的积分，单次最备1000个用户
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BatchGrantPointsRequest'
 *           example:
 *             user_ids: [1, 2, 3, 4, 5]
 *             amount: 100
 *             description: "活动奖励发放"
 *     responses:
 *       200:
 *         description: 批量发放完成
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/BatchGrantResult'
 *             example:
 *               success: true
 *               message: "批量发放完成：成功4个，失葥1个"
 *               data:
 *                 total: 5
 *                 success_count: 4
 *                 fail_count: 1
 *                 results:
 *                   - user_id: 1
 *                     success: true
 *                     error: null
 *                     points_after: 1600
 *                   - user_id: 2
 *                     success: false
 *                     error: "用户不存在"
 *                     points_after: null
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               empty_users:
 *                 summary: 用户列表为空
 *                 value:
 *                   success: false
 *                   message: "用户ID列表不能为空"
 *               invalid_amount:
 *                 summary: 积分数量无效
 *                 value:
 *                   success: false
 *                   message: "积分数量必须大于0"
 *               too_many_users:
 *                 summary: 用户数量超限
 *                 value:
 *                   success: false
 *                   message: "单次批量操作用户数量不能超过1000"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const batchGrantPoints = async (req, res) => {
  try {
    const { user_ids, amount, description = '' } = req.body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '用户ID列表不能为空'
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: '积分数量必须大于0'
      });
    }

    if (user_ids.length > 1000) {
      return res.status(400).json({
        success: false,
        message: '单次批量操作用户数量不能超过1000'
      });
    }

    const results = await Points.batchGrantPoints(user_ids, parseInt(amount), 'admin_batch', description);
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    res.json({
      success: true,
      message: `批量发放完成：成功${successCount}个，失败${failCount}个`,
      data: {
        total: results.length,
        success_count: successCount,
        fail_count: failCount,
        results
      }
    });
  } catch (error) {
    logger.error('批量发放积分失败:', error);
    res.status(500).json({
      success: false,
      message: '批量发放积分失败'
    });
  }
};

/**
 * @swagger
 * /api/points/leaderboard:
 *   get:
 *     tags: [积分系统]
 *     summary: 获取积分排行榜
 *     description: 获取系统积分排行榜，支持按当前积分或累计积分排名
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [current, total]
 *           default: current
 *         description: 排行榜类型
 *         example: current
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: 返回的排行榜数量
 *         example: 50
 *     responses:
 *       200:
 *         description: 积分排行榜获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         type:
 *                           type: string
 *                           enum: [current, total]
 *                           description: 排行榜类型
 *                         list:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/PointsLeaderboardItem'
 *             example:
 *               success: true
 *               message: "积分排行榜获取成功"
 *               data:
 *                 type: "current"
 *                 list:
 *                   - rank: 1
 *                     user_id: 1
 *                     username: "topuser"
 *                     nickname: "积分达人"
 *                     avatar_url: "https://example.com/avatar.jpg"
 *                     points: 10000
 *                     points_type: "current"
 *                   - rank: 2
 *                     user_id: 2
 *                     username: "runner_up"
 *                     nickname: "第二名"
 *                     points: 8500
 *                     points_type: "current"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "type参数只能是current或total"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getPointsLeaderboard = async (req, res) => {
  try {
    const { type = 'current', limit = 50 } = req.query;
    
    if (!['current', 'total'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type参数只能是current或total'
      });
    }

    const leaderboard = await Points.getPointsLeaderboard(type, parseInt(limit));
    
    res.json({
      success: true,
      message: '积分排行榜获取成功',
      data: {
        type,
        list: leaderboard
      }
    });
  } catch (error) {
    logger.error('获取积分排行榜失败:', error);
    res.status(500).json({
      success: false,
      message: '获取积分排行榜失败'
    });
  }
};

/**
 * @swagger
 * /api/points/my-rank:
 *   get:
 *     tags: [积分系统]
 *     summary: 获取当前用户积分排名
 *     description: 获取登录用户的积分排名信息，包括排名、积分数、百分位排名等
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [current, total]
 *           default: current
 *         description: 排名类型
 *         example: current
 *     responses:
 *       200:
 *         description: 积分排名获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       oneOf:
 *                         - $ref: '#/components/schemas/PointsRank'
 *                         - type: object
 *                           properties:
 *                             rank:
 *                               type: null
 *                               example: null
 *                             message:
 *                               type: string
 *                               example: "暂无排名（积分为0或用户状态异常）"
 *             examples:
 *               with_rank:
 *                 summary: 有排名的情况
 *                 value:
 *                   success: true
 *                   message: "积分排名获取成功"
 *                   data:
 *                     rank: 15
 *                     total_users: 1000
 *                     current_points: 2500
 *                     points_type: "current"
 *                     percentile: 85.5
 *               no_rank:
 *                 summary: 没有排名的情况
 *                 value:
 *                   success: true
 *                   message: "积分排名获取成功"
 *                   data:
 *                     rank: null
 *                     message: "暂无排名（积分为0或用户状态异常）"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "type参数只能是current或total"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getMyPointsRank = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type = 'current' } = req.query;
    
    if (!['current', 'total'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type参数只能是current或total'
      });
    }

    const rank = await Points.getUserPointsRank(userId, type);
    
    if (!rank) {
      return res.json({
        success: true,
        message: '积分排名获取成功',
        data: {
          rank: null,
          message: '暂无排名（积分为0或用户状态异常）'
        }
      });
    }
    
    res.json({
      success: true,
      message: '积分排名获取成功',
      data: rank
    });
  } catch (error) {
    logger.error('获取积分排名失败:', error);
    res.status(500).json({
      success: false,
      message: '获取积分排名失败'
    });
  }
};

/**
 * @swagger
 * /api/points/statistics:
 *   get:
 *     tags: [积分管理]
 *     summary: 获取积分统计
 *     description: 管理员功能，获取系统积分的统计信息，包括总体积分情况、日常数据和分类统计
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: 指定用户ID（可选）
 *         example: 123
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: 统计起始日期
 *         example: "2025-09-01"
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: 统计结束日期
 *         example: "2025-09-30"
 *     responses:
 *       200:
 *         description: 积分统计获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/PointsStatistics'
 *             example:
 *               success: true
 *               message: "积分统计获取成功"
 *               data:
 *                 total_users: 1000
 *                 total_points_issued: 1000000
 *                 total_points_spent: 600000
 *                 current_circulating: 400000
 *                 avg_user_points: 400.5
 *                 daily_stats:
 *                   today_earned: 5000
 *                   today_spent: 3000
 *                   active_users: 150
 *                 by_type:
 *                   checkin: 100000
 *                   system_reward: 200000
 *                   transfer_in: 50000
 *                   admin_adjust: 30000
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getPointsStatistics = async (req, res) => {
  try {
    const { user_id, date_from, date_to } = req.query;
    
    const statistics = await Points.getPointsStatistics(
      user_id ? parseInt(user_id) : null,
      date_from,
      date_to
    );
    
    res.json({
      success: true,
      message: '积分统计获取成功',
      data: statistics
    });
  } catch (error) {
    logger.error('获取积分统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取积分统计失败'
    });
  }
};

/**
 * @swagger
 * /api/points/transfer:
 *   post:
 *     tags: [积分系统]
 *     summary: 积分转账
 *     description: 用户功能，将自己的积分转账给其他用户，单次转账上限为10000积分
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransferPointsRequest'
 *           example:
 *             to_user_id: 123
 *             amount: 500
 *             description: "感谢帮助"
 *     responses:
 *       200:
 *         description: 积分转账成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         from_user_id:
 *                           type: integer
 *                           description: 转出用户ID
 *                         to_user_id:
 *                           type: integer
 *                           description: 转入用户ID
 *                         amount:
 *                           type: integer
 *                           description: 转账金额
 *                         from_balance_after:
 *                           type: integer
 *                           description: 转出方余额
 *                         to_balance_after:
 *                           type: integer
 *                           description: 转入方余额
 *                         from_record_id:
 *                           type: integer
 *                           description: 转出记录ID
 *                         to_record_id:
 *                           type: integer
 *                           description: 转入记录ID
 *             example:
 *               success: true
 *               message: "积分转账成功"
 *               data:
 *                 from_user_id: 1
 *                 to_user_id: 123
 *                 amount: 500
 *                 from_balance_after: 2000
 *                 to_balance_after: 1500
 *                 from_record_id: 4001
 *                 to_record_id: 4002
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalid_target:
 *                 summary: 目标用户无效
 *                 value:
 *                   success: false
 *                   message: "目标用户ID无效或不能转账给自己"
 *               invalid_amount:
 *                 summary: 金额无效
 *                 value:
 *                   success: false
 *                   message: "转账金额必须大于0"
 *               amount_limit:
 *                 summary: 金额超限
 *                 value:
 *                   success: false
 *                   message: "单次转账金额不能超过10000积分"
 *               insufficient_balance:
 *                 summary: 余额不足
 *                 value:
 *                   success: false
 *                   message: "积分余额不足"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: 目标用户不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "目标用户不存在"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const transferPoints = async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { to_user_id, amount, description = '' } = req.body;

    if (!to_user_id || to_user_id === fromUserId) {
      return res.status(400).json({
        success: false,
        message: '目标用户ID无效或不能转账给自己'
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: '转账金额必须大于0'
      });
    }

    if (amount > 10000) {
      return res.status(400).json({
        success: false,
        message: '单次转账金额不能超过10000积分'
      });
    }

    const transfers = [{
      fromUserId,
      toUserId: parseInt(to_user_id),
      amount: parseInt(amount),
      description
    }];

    const results = await Points.transferPointsBatch(transfers, fromUserId);
    
    res.json({
      success: true,
      message: '积分转账成功',
      data: results[0]
    });
  } catch (error) {
    logger.error('积分转账失败:', error);
    
    if (error.message === '积分余额不足') {
      return res.status(400).json({
        success: false,
        message: '积分余额不足'
      });
    }

    if (error.message === '用户不存在') {
      return res.status(404).json({
        success: false,
        message: '目标用户不存在'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '积分转账失败'
    });
  }
};

module.exports = {
  getMyPoints,
  getMyPointsRecords,
  getUserPoints,
  getUserPointsRecords,
  adjustUserPoints,
  batchGrantPoints,
  getPointsLeaderboard,
  getMyPointsRank,
  getPointsStatistics,
  transferPoints
};
