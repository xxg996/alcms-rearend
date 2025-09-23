/**
 * 卡密系统控制器
 * 处理卡密生成、兑换、查询等操作
 * 
 * @swagger
 * tags:
 *   - name: CardKeys
 *     description: 卡密管理相关接口
 */

const CardKey = require('../models/CardKey');
const { logger } = require('../utils/logger');
const { services } = require('../services');

/**
 * @swagger
 * /api/admin/card-keys/generate/single:
 *   post:
 *     tags: [CardKeys]
 *     summary: 生成单个卡密
 *     description: 管理员功能，生成单个VIP、积分或下载次数卡密
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCardKeyRequest'
 *           examples:
 *             vip_card:
 *               summary: 生成VIP卡密
 *               value:
 *                 type: "vip"
 *                 vip_level: 1
 *                 vip_days: 30
 *                 value_amount: 19.99
 *             points_card:
 *               summary: 生成积分卡密
 *               value:
 *                 type: "points"
 *                 points: 1000
 *                 value_amount: 10.00
 *             download_card:
 *               summary: 生成下载次数卡密
 *               value:
 *                 type: "download"
 *                 download_credits: 20
 *                 value_amount: 5.00
 *             permanent_vip:
 *               summary: 生成永久VIP卡密
 *               value:
 *                 type: "vip"
 *                 vip_level: 3
 *                 vip_days: 0
 *                 value_amount: 199.99
 *     responses:
 *       201:
 *         description: 卡密生成成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/CardKey'
 *             example:
 *               success: true
 *               message: "卡密生成成功"
 *               data:
 *                 id: 1001
 *                 code: "VIP2025091200001"
 *                 type: "vip"
 *                 vip_level: 1
 *                 vip_days: 30
 *                 value_amount: 19.99
 *                 status: "unused"
 *                 batch_id: null
 *                 created_at: "2025-09-12T10:00:00.000Z"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               vip_level_missing:
 *                 value:
 *                   success: false
 *                   message: "VIP类型卡密必须指定有效的VIP等级"
 *               points_missing:
 *                 value:
 *                   success: false
 *                   message: "积分类型卡密必须指定有效的积分数量"
 *               download_missing:
 *                 value:
 *                   success: false
 *                   message: "下载次数卡密必须指定有效的下载次数"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const generateSingleCard = async (req, res) => {
  try {
    const {
      type = 'vip',
      vip_level = 1,
      vip_days = 30,
      points = 0,
      download_credits = 0,
      expire_at = null,
      value_amount = null
    } = req.body;

    // 验证参数
    if (type === 'vip' && (!vip_level || vip_level < 1)) {
      return res.status(400).json({
        success: false,
        message: 'VIP类型卡密必须指定有效的VIP等级'
      });
    }

    if (type === 'points' && (!points || points <= 0)) {
      return res.status(400).json({
        success: false,
        message: '积分类型卡密必须指定有效的积分数量'
      });
    }

    if (type === 'download' && (!download_credits || download_credits <= 0)) {
      return res.status(400).json({
        success: false,
        message: '下载次数卡密必须指定有效的下载次数'
      });
    }

    if (vip_days < 0) {
      return res.status(400).json({
        success: false,
        message: 'VIP天数不能为负数'
      });
    }

    const cardKey = await CardKey.createCardKey({
      type,
      vip_level: parseInt(vip_level),
      vip_days: parseInt(vip_days),
      points: parseInt(points),
      download_credits: parseInt(download_credits),
      expire_at: expire_at ? new Date(expire_at) : null,
      value_amount: value_amount ? parseFloat(value_amount) : null
    }, req.user.id);

    res.status(201).json({
      success: true,
      message: '卡密生成成功',
      data: cardKey
    });
  } catch (error) {
    logger.error('生成卡密失败:', error);
    res.status(500).json({
      success: false,
      message: '生成卡密失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/card-keys/generate/batch:
 *   post:
 *     tags: [CardKeys]
 *     summary: 批量生成卡密
 *     description: 管理员功能，批量生成VIP、积分或下载次数卡密
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBatchCardKeysRequest'
 *           example:
 *             type: "vip"
 *             vip_level: 1
 *             vip_days: 30
 *             value_amount: 19.99
 *             count: 100
 *             expire_at: "2025-12-31T23:59:59.000Z"
 *         download_card:
 *           summary: 批量生成下载次数卡密
 *           value:
 *             type: "download"
 *             download_credits: 20
 *             value_amount: 8.00
 *             count: 50
 *     responses:
 *       201:
 *         description: 批量生成成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BatchCardKeysResponse'
 *             example:
 *               success: true
 *               message: "批量生成100个卡密成功"
 *               data:
 *                 batch_id: "BATCH_20250912_001"
 *                 count: 100
 *                 codes: ["VIP2025091200001", "VIP2025091200002", "VIP2025091200003", "...等所有生成的卡密"]
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalid_count:
 *                 value:
 *                   success: false
 *                   message: "批量生成数量必须在1-1000之间"
 *               download_missing:
 *                 value:
 *                   success: false
 *                   message: "下载次数卡密必须指定有效的下载次数"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const generateBatchCards = async (req, res) => {
  try {
    const {
      type = 'vip',
      vip_level = 1,
      vip_days = 30,
      points = 0,
      download_credits = 0,
      count = 1,
      expire_at = null,
      value_amount = null
    } = req.body;

    // 验证参数
    if (!count || count <= 0 || count > 1000) {
      return res.status(400).json({
        success: false,
        message: '批量生成数量必须在1-1000之间'
      });
    }

    if (type === 'vip' && (!vip_level || vip_level < 1)) {
      return res.status(400).json({
        success: false,
        message: 'VIP类型卡密必须指定有效的VIP等级'
      });
    }

    if (type === 'points' && (!points || points <= 0)) {
      return res.status(400).json({
        success: false,
        message: '积分类型卡密必须指定有效的积分数量'
      });
    }

    if (type === 'download' && (!download_credits || download_credits <= 0)) {
      return res.status(400).json({
        success: false,
        message: '下载次数卡密必须指定有效的下载次数'
      });
    }

    if (vip_days < 0) {
      return res.status(400).json({
        success: false,
        message: 'VIP天数不能为负数'
      });
    }

    const result = await CardKey.createBatchCardKeys({
      type,
      vip_level: parseInt(vip_level),
      vip_days: parseInt(vip_days),
      points: parseInt(points),
      download_credits: parseInt(download_credits),
      expire_at: expire_at ? new Date(expire_at) : null,
      value_amount: value_amount ? parseFloat(value_amount) : null
    }, parseInt(count), req.user.id);

    res.status(201).json({
      success: true,
      message: `批量生成${result.count}个卡密成功`,
      data: {
        batch_id: result.batch_id,
        count: result.count,
        codes: result.card_keys.map(card => card.code) // 返回所有生成的卡密代码
      }
    });
  } catch (error) {
    logger.error('批量生成卡密失败:', error);
    res.status(500).json({
      success: false,
      message: '批量生成卡密失败'
    });
  }
};

/**
 * @swagger
 * /api/card-keys/redeem:
 *   post:
 *     tags: [CardKeys]
 *     summary: 兑换卡密
 *     description: 用户使用卡密代码兑换VIP或积分
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RedeemCardKeyRequest'
 *           example:
 *             code: "VIP2025091200001"
 *     responses:
 *       200:
 *         description: 卡密兑换成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RedeemCardKeyResponse'
 *             examples:
 *               vip_redeem:
 *                 summary: VIP卡密兑换成功
 *                 value:
 *                   success: true
 *                   message: "卡密兑换成功，获得1级VIP30天"
 *                   data:
 *                     card_type: "vip"
 *                     vip_level: 1
 *                     vip_days: 30
 *                     points: null
 *                     vip_result: {}
 *                     order: {}
 *                     commission: null
 *               points_redeem:
 *                 summary: 积分卡密兑换成功
 *                 value:
 *                   success: true
 *                   message: "卡密兑换成功，获得1000积分"
 *                   data:
 *                     card_type: "points"
 *                     vip_level: null
 *                     vip_days: null
 *                     points: 1000
 *                     vip_result: null
 *                     order: null
 *                     commission: null
 *       400:
 *         description: 卡密错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalid_code:
 *                 value:
 *                   success: false
 *                   message: "请提供有效的卡密代码"
 *               card_used:
 *                 value:
 *                   success: false
 *                   message: "卡密已被使用或已失效"
 *               card_expired:
 *                 value:
 *                   success: false
 *                   message: "卡密已过期"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const redeemCard = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        message: '请提供有效的卡密代码'
      });
    }

    const result = await CardKey.redeemCardKey(code.trim().toUpperCase(), req.user.id);

    let commissionRecord = null;
    if (result.cardKey && result.cardKey.type === 'vip' && result.order) {
      try {
        commissionRecord = await services.referral.handleVipCardCommission({
          inviteeId: req.user.id,
          order: result.order,
          cardKey: result.cardKey
        });
      } catch (commissionError) {
        logger.error('发放邀请佣金失败:', commissionError);
      }
    }

    let responseMessage = '卡密兑换成功';
    if (result.cardKey.type === 'vip') {
      if (result.cardKey.vip_days === 0) {
        responseMessage += `，获得${result.cardKey.vip_level}级永久VIP`;
      } else {
        responseMessage += `，获得${result.cardKey.vip_level}级VIP${result.cardKey.vip_days}天`;
      }
    } else if (result.cardKey.type === 'points') {
      responseMessage += `，获得${result.cardKey.points}积分`;
    }

    res.json({
      success: true,
      message: responseMessage,
      data: {
        card_type: result.cardKey.type,
        vip_level: result.cardKey.vip_level,
        vip_days: result.cardKey.vip_days,
        points: result.cardKey.points,
        vip_result: result.vipResult,
        order: result.order,
        commission: commissionRecord
      }
    });
  } catch (error) {
    logger.error('兑换卡密失败:', error);
    
    // 返回具体的错误信息
    const errorMessages = {
      '卡密不存在': '卡密代码不存在',
      '卡密已被使用或已失效': '卡密已被使用或已失效',
      '卡密已过期': '卡密已过期'
    };

    const message = errorMessages[error.message] || '兑换卡密失败';
    
    res.status(400).json({
      success: false,
      message
    });
  }
};

/**
 * @swagger
 * /api/card-keys/info/{code}:
 *   get:
 *     tags: [CardKeys]
 *     summary: 查询卡密信息
 *     description: 根据卡密代码查询卡密的详细信息
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: 卡密代码
 *         example: "VIP2025091200001"
 *     responses:
 *       200:
 *         description: 获取卡密信息成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/CardKey'
 *             example:
 *               success: true
 *               message: "卡密信息获取成功"
 *               data:
 *                 code: "VIP2025091200001"
 *                 type: "vip"
 *                 vip_level: 1
 *                 vip_days: 30
 *                 status: "unused"
 *                 expire_at: "2025-12-31T23:59:59.000Z"
 *                 is_expired: false
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "请提供卡密代码"
 *       404:
 *         description: 卡密不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "卡密不存在"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getCardInfo = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: '请提供卡密代码'
      });
    }

    const cardKey = await CardKey.getByCode(code.trim().toUpperCase());

    if (!cardKey) {
      return res.status(404).json({
        success: false,
        message: '卡密不存在'
      });
    }

    // 检查权限：只有管理员或卡密使用者才能查看详细信息
    const isAdmin = req.user.roles?.some(role => ['admin', 'super_admin'].includes(role.name));
    const isUser = cardKey.used_by === req.user.id;

    let responseData = {
      code: cardKey.code,
      type: cardKey.type,
      status: cardKey.status,
      expire_at: cardKey.expire_at
    };

    if (isAdmin || isUser) {
      responseData = {
        ...cardKey,
        // 隐藏敏感信息
        created_by: undefined,
        created_by_username: isAdmin ? cardKey.created_by_username : undefined
      };
    }

    // 检查卡密是否过期
    let isExpired = false;
    if (cardKey.expire_at && new Date(cardKey.expire_at) < new Date()) {
      isExpired = true;
    }

    res.json({
      success: true,
      message: '卡密信息获取成功',
      data: {
        ...responseData,
        is_expired: isExpired
      }
    });
  } catch (error) {
    logger.error('查询卡密失败:', error);
    res.status(500).json({
      success: false,
      message: '查询卡密失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/card-keys/list:
 *   get:
 *     tags: [CardKeys]
 *     summary: 获取卡密列表
 *     description: 管理员获取卡密列表，支持过滤和分页
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [unused, used, expired, disabled]
 *         description: 按状态过滤
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [vip, points]
 *         description: 按类型过滤
 *       - in: query
 *         name: batch_id
 *         schema:
 *           type: string
 *         description: 按批次ID过滤
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: 返回数量限制
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 偏移量
 *     responses:
 *       200:
 *         description: 获取卡密列表成功
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
 *                         $ref: '#/components/schemas/CardKey'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getCardsList = async (req, res) => {
  try {
    const {
      status,
      type,
      batch_id,
      limit = 20,
      offset = 0
    } = req.query;

    const options = {
      status,
      type,
      batch_id,
      created_by: null,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    // 管理员可以查看所有卡密，普通权限用户只能查看自己创建的卡密
    const isAdmin = req.user.roles?.some(role => ['super_admin', 'admin'].includes(role.name));
    if (!isAdmin) {
      options.created_by = req.user.id;
    }

    const result = await CardKey.getCardKeys(options);

    res.json({
      success: true,
      message: '卡密列表获取成功',
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('获取卡密列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取卡密列表失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/card-keys/statistics:
 *   get:
 *     tags: [CardKeys]
 *     summary: 获取卡密统计信息
 *     description: 管理员获取卡密的统计数据
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: batch_id
 *         schema:
 *           type: string
 *         description: 指定批次ID（可选）
 *     responses:
 *       200:
 *         description: 获取统计信息成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/CardKeyStatistics'
 *             example:
 *               success: true
 *               message: "卡密统计获取成功"
 *               data:
 *                 total_count: 500
 *                 unused_count: 320
 *                 used_count: 150
 *                 expired_count: 20
 *                 disabled_count: 10
 *                 by_type:
 *                   vip: 300
 *                   points: 200
 *                 recent_usage:
 *                   today: 5
 *                   this_week: 25
 *                   this_month: 120
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getCardsStatistics = async (req, res) => {
  try {
    const { batch_id } = req.query;
    const statistics = await CardKey.getStatistics(batch_id);

    res.json({
      success: true,
      message: '卡密统计获取成功',
      data: statistics
    });
  } catch (error) {
    logger.error('获取卡密统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取卡密统计失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/card-keys/batches:
 *   get:
 *     tags: [CardKeys]
 *     summary: 获取批次列表
 *     description: 管理员获取卡密批次列表
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: 返回数量限制
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 偏移量
 *     responses:
 *       200:
 *         description: 获取批次列表成功
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
 *                         $ref: '#/components/schemas/CardKeyBatch'
 *             example:
 *               success: true
 *               message: "批次列表获取成功"
 *               data:
 *                 - batch_id: "BATCH_20250912_001"
 *                   type: "vip"
 *                   vip_level: 1
 *                   vip_days: 30
 *                   total_count: 100
 *                   unused_count: 85
 *                   used_count: 15
 *                   expired_count: 0
 *                   created_by_username: "admin"
 *                   created_at: "2025-09-12T08:00:00.000Z"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getBatchesList = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    // 管理员可以查看所有批次，其他权限用户只能查看自己创建的批次
    const isAdmin = req.user.roles?.some(role => ['super_admin', 'admin'].includes(role.name));
    const createdBy = isAdmin ? null : req.user.id;

    const result = await CardKey.getBatches(createdBy, parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      message: '批次列表获取成功',
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('获取批次列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取批次列表失败'
    });
  }
};

/**
 * 获取批次详情（管理员功能）
 */
const getBatchDetails = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const options = {
      batch_id: batchId,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    // 管理员可以查看所有批次，其他权限用户只能查看自己创建的批次
    const isAdmin = req.user.roles?.some(role => ['super_admin', 'admin'].includes(role.name));
    if (!isAdmin) {
      options.created_by = req.user.id;
    }

    const result = await CardKey.getCardKeys(options);

    if (result.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: '批次不存在或无权访问'
      });
    }

    res.json({
      success: true,
      message: '批次详情获取成功',
      data: {
        batch_id: batchId,
        card_keys: result.data
      },
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('获取批次详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取批次详情失败'
    });
  }
};

/**
 * 更新卡密状态（管理员功能）
 */
const updateCardStatus = async (req, res) => {
  try {
    const { cardId } = req.params;
    const { status } = req.body;

    if (!['unused', 'used', 'expired', 'disabled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '无效的状态值'
      });
    }

    const updatedCard = await CardKey.updateStatus(parseInt(cardId), status);

    if (!updatedCard) {
      return res.status(404).json({
        success: false,
        message: '卡密不存在'
      });
    }

    res.json({
      success: true,
      message: '卡密状态更新成功',
      data: updatedCard
    });
  } catch (error) {
    logger.error('更新卡密状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新卡密状态失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/card-keys/{cardId}/delete:
 *   post:
 *     tags: [卡密管理]
 *     summary: 删除单个卡密
 *     description: 管理员功能，删除指定的卡密。只能删除状态为"未使用"的卡密，已使用的卡密无法删除以保护数据完整性。
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 卡密ID
 *         example: 12345
 *     responses:
 *       200:
 *         description: 卡密删除成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/CardKey'
 *             example:
 *               success: true
 *               message: "卡密删除成功"
 *               data:
 *                 id: 12345
 *                 code: "VIP2025091200001"
 *                 type: "vip"
 *                 vip_level: 1
 *                 vip_days: 30
 *                 points: 0
 *                 status: "unused"
 *                 batch_id: "BATCH_20250912_001"
 *                 expire_at: "2025-12-31T23:59:59.000Z"
 *                 created_by: 1
 *                 created_at: "2025-09-12T08:00:00.000Z"
 *                 updated_at: "2025-09-12T08:00:00.000Z"
 *       404:
 *         description: 卡密不存在或无法删除
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "卡密不存在或无法删除（只能删除未使用的卡密）"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const deleteCard = async (req, res) => {
  try {
    const { cardId } = req.params;
    const deletedCard = await CardKey.deleteCardKey(parseInt(cardId));

    if (!deletedCard) {
      return res.status(404).json({
        success: false,
        message: '卡密不存在或无法删除（只能删除未使用的卡密）'
      });
    }

    res.json({
      success: true,
      message: '卡密删除成功',
      data: deletedCard
    });
  } catch (error) {
    logger.error('删除卡密失败:', error);
    res.status(500).json({
      success: false,
      message: '删除卡密失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/card-keys/batches/{batchId}/delete:
 *   post:
 *     tags: [卡密管理]
 *     summary: 删除整个批次
 *     description: 管理员功能，删除指定批次中的所有卡密。只会删除状态为"未使用"的卡密，已使用的卡密会被保留以保护数据完整性。
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *         description: 批次ID
 *         example: "BATCH_20250912_001"
 *     responses:
 *       200:
 *         description: 批次删除成功
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
 *                         batch_id:
 *                           type: string
 *                           description: 批次ID
 *                           example: "BATCH_20250912_001"
 *                         deleted_count:
 *                           type: integer
 *                           description: 删除的卡密数量
 *                           example: 85
 *             example:
 *               success: true
 *               message: "批次删除成功，删除了85个未使用的卡密"
 *               data:
 *                 batch_id: "BATCH_20250912_001"
 *                 deleted_count: 85
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const deleteBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const deletedCards = await CardKey.deleteBatch(batchId);

    res.json({
      success: true,
      message: `批次删除成功，删除了${deletedCards.length}个未使用的卡密`,
      data: {
        batch_id: batchId,
        deleted_count: deletedCards.length
      }
    });
  } catch (error) {
    logger.error('删除批次失败:', error);
    res.status(500).json({
      success: false,
      message: '删除批次失败'
    });
  }
};

module.exports = {
  generateSingleCard,
  generateBatchCards,
  redeemCard,
  getCardInfo,
  getCardsList,
  getCardsStatistics,
  getBatchesList,
  getBatchDetails,
  updateCardStatus,
  deleteCard,
  deleteBatch
};
