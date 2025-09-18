/**
 * @fileoverview 签到系统控制器
 * @description 处理用户签到、签到配置管理、签到统计、补签等操作
 * @module checkinController
 * @requires ../models/Checkin
 * @requires ../utils/logger
 * @author AI Assistant
 * @version 1.0.0
 */

const Checkin = require('../models/Checkin');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/checkin/check:
 *   post:
 *     tags: [签到系统]
 *     summary: 执行签到
 *     description: 用户执行每日签到，获得积分奖励，支持连续签到奖励机制
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 签到成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PerformCheckinResponse'
 *             example:
 *               success: true
 *               message: "签到成功！获得15积分（连续签到7天奖励）"
 *               data:
 *                 id: 1001
 *                 base_points: 10
 *                 bonus_points: 5
 *                 total_points: 15
 *                 consecutive_days: 7
 *                 is_bonus: true
 *                 points_record_id: 2001
 *       400:
 *         description: 签到失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "今日已签到，请明天再来"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       503:
 *         description: 签到功能不可用
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "签到功能暂时不可用"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const performCheckin = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRoles = req.user.roles ? req.user.roles.map(role => role.name) : ['user'];
    const result = await Checkin.performCheckin(userId, userRoles);
    
    let message = `签到成功！获得${result.total_points}积分`;
    if (result.is_bonus) {
      message += `（连续签到${result.consecutive_days}天奖励）`;
    }
    
    res.json({
      success: true,
      message,
      data: result
    });
  } catch (error) {
    logger.error('签到失败:', error);
    
    if (error.message === '今日已签到') {
      return res.status(400).json({
        success: false,
        message: '今日已签到，请明天再来'
      });
    }

    if (error.message === '签到功能未配置' || error.message === '签到功能未配置或您没有权限使用') {
      return res.status(503).json({
        success: false,
        message: error.message === '签到功能未配置或您没有权限使用'
          ? '您没有权限使用签到功能或功能未配置'
          : '签到功能暂时不可用'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '签到失败，请稍后重试'
    });
  }
};

/**
 * @swagger
 * /api/checkin/my-status:
 *   get:
 *     tags: [签到系统]
 *     summary: 获取当前用户签到状态
 *     description: 获取登录用户的签到状态，包括今日是否已签到、签到统计和当前配置
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 签到状态获取成功
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
 *                         checked_in_today:
 *                           type: boolean
 *                           description: 今日是否已签到
 *                         today_checkin:
 *                           allOf:
 *                             - $ref: '#/components/schemas/CheckinRecord'
 *                           nullable: true
 *                           description: 今日签到记录
 *                         stats:
 *                           $ref: '#/components/schemas/CheckinStats'
 *                         config:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             daily_points:
 *                               type: integer
 *                               description: 每日积分
 *                             consecutive_bonus:
 *                               type: object
 *                               description: 连续签到奖励配置
 *             example:
 *               success: true
 *               message: "签到状态获取成功"
 *               data:
 *                 checked_in_today: true
 *                 today_checkin:
 *                   id: 1001
 *                   total_points: 15
 *                   consecutive_days: 7
 *                   is_bonus: true
 *                 stats:
 *                   total_days: 150
 *                   consecutive_days: 7
 *                   max_consecutive_days: 30
 *                   this_month_days: 12
 *                   total_points_earned: 2500
 *                 config:
 *                   daily_points: 10
 *                   consecutive_bonus: {"7": 10, "14": 20, "30": 50}
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getMyCheckinStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 获取今日签到状态
    const todayStatus = await Checkin.getTodayCheckinStatus(userId);
    
    // 获取签到统计
    const stats = await Checkin.getUserCheckinStats(userId);
    
    // 获取当前签到配置
    const config = await Checkin.getActiveConfig();
    
    res.json({
      success: true,
      message: '签到状态获取成功',
      data: {
        checked_in_today: !!todayStatus,
        today_checkin: todayStatus,
        stats,
        config: config ? {
          daily_points: config.daily_points,
          consecutive_bonus: config.consecutive_bonus
        } : null
      }
    });
  } catch (error) {
    logger.error('获取签到状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取签到状态失败'
    });
  }
};

/**
 * @swagger
 * /api/checkin/my-history:
 *   get:
 *     tags: [签到系统]
 *     summary: 获取当前用户签到历史
 *     description: 分页获取登录用户的签到历史记录
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 30
 *         description: 每页记录数
 *         example: 30
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
 *         description: 签到历史获取成功
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
 *                             $ref: '#/components/schemas/CheckinRecord'
 *                         total:
 *                           type: integer
 *                           description: 总记录数
 *                         has_more:
 *                           type: boolean
 *                           description: 是否还有更多记录
 *             example:
 *               success: true
 *               message: "签到历史获取成功"
 *               data:
 *                 records:
 *                   - id: 1001
 *                     user_id: 1
 *                     checkin_date: "2025-09-12"
 *                     base_points: 10
 *                     bonus_points: 5
 *                     total_points: 15
 *                     consecutive_days: 7
 *                     is_bonus: true
 *                     is_makeup: false
 *                     created_at: "2025-09-12T08:30:00.000Z"
 *                 total: 150
 *                 has_more: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getMyCheckinHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 30, offset = 0 } = req.query;
    
    const history = await Checkin.getUserCheckinHistory(userId, parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      message: '签到历史获取成功',
      data: history
    });
  } catch (error) {
    logger.error('获取签到历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取签到历史失败'
    });
  }
};

/**
 * @swagger
 * /api/checkin/leaderboard:
 *   get:
 *     tags: [签到系统]
 *     summary: 获取签到排行榜
 *     description: 获取签到排行榜，支持按连续天数、总天数或月度天数排名
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [consecutive, total, monthly]
 *           default: consecutive
 *         description: 排行榜类型
 *         example: consecutive
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
 *         description: 签到排行榜获取成功
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
 *                           enum: [consecutive, total, monthly]
 *                           description: 排行榜类型
 *                         list:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/CheckinLeaderboardItem'
 *             example:
 *               success: true
 *               message: "签到排行榜获取成功"
 *               data:
 *                 type: "consecutive"
 *                 list:
 *                   - rank: 1
 *                     user_id: 1
 *                     username: "checkin_master"
 *                     nickname: "签到达人"
 *                     avatar_url: "https://example.com/avatar.jpg"
 *                     consecutive_days: 365
 *                     value: 365
 *                   - rank: 2
 *                     user_id: 2
 *                     username: "daily_user"
 *                     nickname: "坚持用户"
 *                     consecutive_days: 300
 *                     value: 300
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "type参数只能是consecutive、total或monthly"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getCheckinLeaderboard = async (req, res) => {
  try {
    const { type = 'consecutive', limit = 50 } = req.query;
    
    if (!['consecutive', 'total', 'monthly'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type参数只能是consecutive、total或monthly'
      });
    }

    const leaderboard = await Checkin.getCheckinLeaderboard(type, parseInt(limit));
    
    res.json({
      success: true,
      message: '签到排行榜获取成功',
      data: {
        type,
        list: leaderboard
      }
    });
  } catch (error) {
    logger.error('获取签到排行榜失败:', error);
    res.status(500).json({
      success: false,
      message: '获取签到排行榜失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/checkin/configs:
 *   get:
 *     tags: [签到管理]
 *     summary: 获取所有签到配置
 *     description: 管理员功能，获取系统中所有的签到配置
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 签到配置获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CheckinConfig'
 *             example:
 *               success: true
 *               message: "签到配置获取成功"
 *               data:
 *                 - id: 1
 *                   name: "默认签到配置"
 *                   description: "系统默认的签到积分配置"
 *                   daily_points: 10
 *                   consecutive_bonus: {"7": 10, "14": 20, "30": 50}
 *                   monthly_reset: true
 *                   is_active: true
 *                   created_by: 1
 *                   created_by_username: "admin"
 *                   created_at: "2025-09-01T00:00:00.000Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getAllConfigs = async (req, res) => {
  try {
    const configs = await Checkin.getAllConfigs();
    
    res.json({
      success: true,
      message: '签到配置获取成功',
      data: configs
    });
  } catch (error) {
    logger.error('获取签到配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取签到配置失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/checkin/configs:
 *   post:
 *     tags: [签到管理]
 *     summary: 创建签到配置
 *     description: 管理员功能，创建新的签到积分配置方案
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCheckinConfigRequest'
 *           example:
 *             name: "VIP签到配置"
 *             description: "VIP用户专属签到奖励配置"
 *             daily_points: 20
 *             consecutive_bonus:
 *               "7": 20
 *               "14": 50
 *               "30": 100
 *             monthly_reset: false
 *     responses:
 *       201:
 *         description: 签到配置创建成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/CheckinConfig'
 *             example:
 *               success: true
 *               message: "签到配置创建成功"
 *               data:
 *                 id: 2
 *                 name: "VIP签到配置"
 *                 description: "VIP用户专属签到奖励配置"
 *                 daily_points: 20
 *                 consecutive_bonus: {"7": 20, "14": 50, "30": 100}
 *                 monthly_reset: false
 *                 is_active: true
 *                 created_by: 1
 *                 created_at: "2025-09-12T10:00:00.000Z"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               empty_name:
 *                 summary: 配置名称为空
 *                 value:
 *                   success: false
 *                   message: "配置名称不能为空且必须为字符串"
 *               invalid_points:
 *                 summary: 积分数值错误
 *                 value:
 *                   success: false
 *                   message: "每日积分必须为非负数字"
 *               invalid_bonus:
 *                 summary: 奖励配置错误
 *                 value:
 *                   success: false
 *                   message: "连续签到奖励配置必须为对象格式"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const createConfig = async (req, res) => {
  try {
    // 检查请求体是否存在
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: '请求数据不能为空，请提供有效的JSON数据'
      });
    }

    const {
      name,
      description,
      daily_points = 10,
      consecutive_bonus = {},
      monthly_reset = true,
      roles = []
    } = req.body;

    // 详细的输入验证
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '配置名称不能为空且必须为字符串'
      });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: '配置名称长度不能超过100个字符'
      });
    }

    if (daily_points !== undefined && (typeof daily_points !== 'number' || daily_points < 0)) {
      return res.status(400).json({
        success: false,
        message: '每日积分必须为非负数字'
      });
    }

    if (consecutive_bonus !== undefined && (typeof consecutive_bonus !== 'object' || Array.isArray(consecutive_bonus))) {
      return res.status(400).json({
        success: false,
        message: '连续签到奖励配置必须为对象格式'
      });
    }

    if (monthly_reset !== undefined && typeof monthly_reset !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: '月度重置选项必须为布尔值'
      });
    }

    if (roles !== undefined && !Array.isArray(roles)) {
      return res.status(400).json({
        success: false,
        message: '角色列表必须为数组格式'
      });
    }

    const createdBy = req.user.id;
    const config = await Checkin.createConfig({
      name,
      description,
      daily_points,
      consecutive_bonus,
      monthly_reset,
      roles
    }, createdBy);
    
    res.status(201).json({
      success: true,
      message: '签到配置创建成功',
      data: config
    });
  } catch (error) {
    logger.error('创建签到配置失败:', error);
    res.status(500).json({
      success: false,
      message: '创建签到配置失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/checkin/configs/{configId}:
 *   put:
 *     tags: [签到管理]
 *     summary: 更新签到配置
 *     description: 管理员功能，更新指定的签到配置
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: configId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: 配置ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCheckinConfigRequest'
 *           example:
 *             name: "更新的签到配置"
 *             daily_points: 15
 *             is_active: false
 *     responses:
 *       200:
 *         description: 签到配置更新成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/CheckinConfig'
 *             example:
 *               success: true
 *               message: "签到配置更新成功"
 *               data:
 *                 id: 1
 *                 name: "更新的签到配置"
 *                 daily_points: 15
 *                 is_active: false
 *                 updated_at: "2025-09-12T11:00:00.000Z"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "每日积分不能为负数"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: 配置不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "签到配置不存在"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const updateConfig = async (req, res) => {
  try {
    const { configId } = req.params;
    const updateData = req.body;

    // 移除不可更新的字段
    delete updateData.id;
    delete updateData.created_by;
    delete updateData.created_at;

    if (updateData.daily_points !== undefined && updateData.daily_points < 0) {
      return res.status(400).json({
        success: false,
        message: '每日积分不能为负数'
      });
    }

    const config = await Checkin.updateConfig(parseInt(configId), updateData);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: '签到配置不存在'
      });
    }
    
    res.json({
      success: true,
      message: '签到配置更新成功',
      data: config
    });
  } catch (error) {
    logger.error('更新签到配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新签到配置失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/checkin/configs/{configId}:
 *   delete:
 *     tags: [签到管理]
 *     summary: 删除签到配置
 *     description: 管理员功能，删除指定的签到配置（仅限非激活状态的配置）
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: configId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: 配置ID
 *         example: 2
 *     responses:
 *       200:
 *         description: 签到配置删除成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/CheckinConfig'
 *             example:
 *               success: true
 *               message: "签到配置删除成功"
 *               data:
 *                 id: 2
 *                 name: "测试配置"
 *                 is_active: false
 *       400:
 *         description: 删除失败，配置正在使用中
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               config_in_use:
 *                 summary: 配置正在使用中
 *                 value:
 *                   success: false
 *                   message: "无法删除正在使用的配置，请先停用该配置"
 *       404:
 *         description: 配置不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "签到配置不存在"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const deleteConfig = async (req, res) => {
  try {
    const { configId } = req.params;

    // 验证配置ID
    if (!configId || isNaN(parseInt(configId))) {
      return res.status(400).json({
        success: false,
        message: '配置ID必须为有效的数字'
      });
    }

    const deletedConfig = await Checkin.deleteConfig(parseInt(configId));

    res.json({
      success: true,
      message: '签到配置删除成功',
      data: deletedConfig
    });
  } catch (error) {
    logger.error('删除签到配置失败:', error);

    if (error.message === '签到配置不存在') {
      return res.status(404).json({
        success: false,
        message: '签到配置不存在'
      });
    }

    if (error.message === '无法删除正在使用的配置，请先停用该配置') {
      return res.status(400).json({
        success: false,
        message: '无法删除正在使用的配置，请先停用该配置'
      });
    }

    res.status(500).json({
      success: false,
      message: '删除签到配置失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/checkin/users/{userId}/info:
 *   get:
 *     tags: [签到管理]
 *     summary: 获取用户签到信息
 *     description: 管理员功能，获取指定用户的签到统计和今日签到状态
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
 *         description: 用户签到信息获取成功
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
 *                         stats:
 *                           $ref: '#/components/schemas/CheckinStats'
 *                         today_status:
 *                           allOf:
 *                             - $ref: '#/components/schemas/CheckinRecord'
 *                           nullable: true
 *                           description: 今日签到状态
 *                         checked_in_today:
 *                           type: boolean
 *                           description: 今日是否已签到
 *             example:
 *               success: true
 *               message: "用户签到信息获取成功"
 *               data:
 *                 stats:
 *                   total_days: 150
 *                   consecutive_days: 7
 *                   max_consecutive_days: 30
 *                   this_month_days: 12
 *                   total_points_earned: 2500
 *                   last_checkin_date: "2025-09-12"
 *                   last_checkin_points: 15
 *                 today_status:
 *                   id: 1001
 *                   total_points: 15
 *                   consecutive_days: 7
 *                   is_bonus: true
 *                 checked_in_today: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getUserCheckinInfo = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // 获取签到统计
    const stats = await Checkin.getUserCheckinStats(parseInt(userId));
    
    // 获取今日签到状态
    const todayStatus = await Checkin.getTodayCheckinStatus(parseInt(userId));
    
    res.json({
      success: true,
      message: '用户签到信息获取成功',
      data: {
        stats,
        today_status: todayStatus,
        checked_in_today: !!todayStatus
      }
    });
  } catch (error) {
    logger.error('获取用户签到信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户签到信息失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/checkin/users/{userId}/history:
 *   get:
 *     tags: [签到管理]
 *     summary: 获取用户签到历史
 *     description: 管理员功能，分页获取指定用户的签到历史记录
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
 *           default: 30
 *         description: 每页记录数
 *         example: 30
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
 *         description: 用户签到历史获取成功
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
 *                             $ref: '#/components/schemas/CheckinRecord'
 *                         total:
 *                           type: integer
 *                           description: 总记录数
 *                         has_more:
 *                           type: boolean
 *                           description: 是否还有更多记录
 *             example:
 *               success: true
 *               message: "用户签到历史获取成功"
 *               data:
 *                 records:
 *                   - id: 2001
 *                     user_id: 123
 *                     checkin_date: "2025-09-11"
 *                     base_points: 10
 *                     bonus_points: 0
 *                     total_points: 10
 *                     consecutive_days: 6
 *                     is_bonus: false
 *                     is_makeup: false
 *                     created_at: "2025-09-11T08:15:00.000Z"
 *                 total: 75
 *                 has_more: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getUserCheckinHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 30, offset = 0 } = req.query;
    
    const history = await Checkin.getUserCheckinHistory(parseInt(userId), parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      message: '用户签到历史获取成功',
      data: history
    });
  } catch (error) {
    logger.error('获取用户签到历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户签到历史失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/checkin/users/{userId}/makeup:
 *   post:
 *     tags: [签到管理]
 *     summary: 补签功能
 *     description: 管理员功能，为指定用户补签某个历史日期，不能补签今天或未来日期
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
 *             $ref: '#/components/schemas/MakeupCheckinRequest'
 *           example:
 *             date: "2025-09-10"
 *     responses:
 *       200:
 *         description: 补签成功
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
 *                         id:
 *                           type: integer
 *                           description: 补签记录ID
 *                         base_points:
 *                           type: integer
 *                           description: 基础积分
 *                         total_points:
 *                           type: integer
 *                           description: 总积分
 *                         is_makeup:
 *                           type: boolean
 *                           description: 是否补签
 *                         makeup_by:
 *                           type: integer
 *                           description: 补签操作者ID
 *             example:
 *               success: true
 *               message: "补签2025-09-10成功"
 *               data:
 *                 id: 3001
 *                 base_points: 10
 *                 total_points: 10
 *                 is_makeup: true
 *                 makeup_by: 1
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               empty_date:
 *                 summary: 日期为空
 *                 value:
 *                   success: false
 *                   message: "补签日期不能为空"
 *               invalid_format:
 *                 summary: 日期格式错误
 *                 value:
 *                   success: false
 *                   message: "日期格式错误，请使用YYYY-MM-DD格式"
 *               future_date:
 *                 summary: 未来日期
 *                 value:
 *                   success: false
 *                   message: "不能补签今天或未来日期"
 *               already_exists:
 *                 summary: 已有记录
 *                 value:
 *                   success: false
 *                   message: "该日期已有签到记录"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       503:
 *         description: 签到功能不可用
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "签到功能未配置"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const makeupCheckin = async (req, res) => {
  try {
    const { userId } = req.params;
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: '补签日期不能为空'
      });
    }

    // 验证日期格式
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        message: '日期格式错误，请使用YYYY-MM-DD格式'
      });
    }

    // 不能补签未来日期
    const targetDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (targetDate >= today) {
      return res.status(400).json({
        success: false,
        message: '不能补签今天或未来日期'
      });
    }

    const adminId = req.user.id;
    const result = await Checkin.makeupCheckin(parseInt(userId), date, adminId);
    
    res.json({
      success: true,
      message: `补签${date}成功`,
      data: result
    });
  } catch (error) {
    logger.error('补签失败:', error);
    
    if (error.message === '该日期已有签到记录') {
      return res.status(400).json({
        success: false,
        message: '该日期已有签到记录'
      });
    }

    if (error.message === '签到功能未配置') {
      return res.status(503).json({
        success: false,
        message: '签到功能未配置'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '补签失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/checkin/users/{userId}/reset:
 *   post:
 *     tags: [签到管理]
 *     summary: 重置用户签到数据
 *     description: 管理员功能，清除指定用户的所有签到记录和统计数据
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
 *         description: 用户签到数据重置成功
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
 *                         deleted_records:
 *                           type: integer
 *                           description: 删除的记录数
 *                         reset_stats:
 *                           type: boolean
 *                           description: 是否重置统计
 *             example:
 *               success: true
 *               message: "用户签到数据重置成功"
 *               data:
 *                 deleted_records: 150
 *                 reset_stats: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const resetUserCheckins = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await Checkin.resetUserCheckins(parseInt(userId));
    
    res.json({
      success: true,
      message: '用户签到数据重置成功',
      data: result
    });
  } catch (error) {
    logger.error('重置用户签到数据失败:', error);
    res.status(500).json({
      success: false,
      message: '重置用户签到数据失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/checkin/statistics:
 *   get:
 *     tags: [签到管理]
 *     summary: 获取签到统计
 *     description: 管理员功能，获取系统签到的统计信息，包括签到率、活跃度等数据
 *     security:
 *       - BearerAuth: []
 *     parameters:
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
 *         description: 签到统计获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/CheckinStatistics'
 *             example:
 *               success: true
 *               message: "签到统计获取成功"
 *               data:
 *                 total_users: 1000
 *                 checkin_users_today: 150
 *                 checkin_rate_today: 15.0
 *                 total_checkins: 50000
 *                 avg_consecutive_days: 7.5
 *                 max_consecutive_record: 365
 *                 daily_stats:
 *                   checkin_count: 150
 *                   new_users: 10
 *                   points_distributed: 2500
 *                 active_config:
 *                   id: 1
 *                   name: "默认配置"
 *                   daily_points: 10
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getCheckinStatistics = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    const statistics = await Checkin.getCheckinStatistics(date_from, date_to);

    res.json({
      success: true,
      message: '签到统计获取成功',
      data: statistics
    });
  } catch (error) {
    logger.error('获取签到统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取签到统计失败'
    });
  }
};


/**
 * @swagger
 * /api/admin/checkin/configs/{configId}/roles:
 *   post:
 *     tags: [签到管理]
 *     summary: 为签到配置添加角色绑定
 *     description: 管理员功能，为指定的签到配置添加角色绑定，绑定后只有该角色的用户才能使用此配置进行签到
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: configId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 签到配置ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddConfigRoleRequest'
 *           example:
 *             role_name: "vip"
 *     responses:
 *       200:
 *         description: 角色绑定成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/CheckinConfigRole'
 *             example:
 *               success: true
 *               message: "角色绑定成功"
 *               data:
 *                 id: 3
 *                 checkin_config_id: 1
 *                 role_name: "vip"
 *                 created_by: 1
 *                 created_at: "2025-09-18T10:00:00.000Z"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "角色名称不能为空"
 *       409:
 *         description: 角色已存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "该角色已经绑定到此配置"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const addConfigRole = async (req, res) => {
  try {
    const { configId } = req.params;
    const { role_name } = req.body;

    if (!role_name) {
      return res.status(400).json({
        success: false,
        message: '角色名称不能为空'
      });
    }

    const createdBy = req.user.id;
    const role = await Checkin.addConfigRole(parseInt(configId), role_name, createdBy);

    if (!role) {
      return res.status(409).json({
        success: false,
        message: '该角色已经绑定到此配置'
      });
    }

    res.json({
      success: true,
      message: '角色绑定成功',
      data: role
    });
  } catch (error) {
    logger.error('添加配置角色失败:', error);
    res.status(500).json({
      success: false,
      message: '添加配置角色失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/checkin/configs/{configId}/roles/{roleName}/delete:
 *   post:
 *     tags: [签到管理]
 *     summary: 删除签到配置的角色绑定
 *     description: 管理员功能，删除指定签到配置与特定角色的绑定关系，删除后该角色用户将无法使用此配置进行签到
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: configId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 签到配置ID
 *         example: 1
 *       - in: path
 *         name: roleName
 *         required: true
 *         schema:
 *           type: string
 *         description: 角色名称
 *         example: "vip"
 *     responses:
 *       200:
 *         description: 角色绑定删除成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/CheckinConfigRole'
 *             example:
 *               success: true
 *               message: "角色绑定删除成功"
 *               data:
 *                 id: 1
 *                 checkin_config_id: 1
 *                 role_name: "vip"
 *                 created_by: 1
 *                 created_at: "2025-09-18T10:00:00.000Z"
 *       404:
 *         description: 角色绑定不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "角色绑定不存在"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const removeConfigRole = async (req, res) => {
  try {
    const { configId, roleName } = req.params;

    const result = await Checkin.removeConfigRole(parseInt(configId), roleName);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: '角色绑定不存在'
      });
    }

    res.json({
      success: true,
      message: '角色绑定删除成功',
      data: result
    });
  } catch (error) {
    logger.error('删除配置角色失败:', error);
    res.status(500).json({
      success: false,
      message: '删除配置角色失败'
    });
  }
};

module.exports = {
  performCheckin,
  getMyCheckinStatus,
  getMyCheckinHistory,
  getCheckinLeaderboard,
  getAllConfigs,
  createConfig,
  updateConfig,
  deleteConfig,
  getUserCheckinInfo,
  getUserCheckinHistory,
  makeupCheckin,
  resetUserCheckins,
  getCheckinStatistics,
  addConfigRole,
  removeConfigRole
};
