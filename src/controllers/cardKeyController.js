/**
 * 卡密系统控制器
 * 处理卡密生成、兑换、查询等操作
 */

const CardKey = require('../models/CardKey');

/**
 * 生成单个卡密（管理员功能）
 */
const generateSingleCard = async (req, res) => {
  try {
    const {
      type = 'vip',
      vip_level = 1,
      vip_days = 30,
      points = 0,
      expire_at = null
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
      expire_at: expire_at ? new Date(expire_at) : null
    }, req.user.userId);

    res.status(201).json({
      success: true,
      message: '卡密生成成功',
      data: cardKey
    });
  } catch (error) {
    console.error('生成卡密失败:', error);
    res.status(500).json({
      success: false,
      message: '生成卡密失败'
    });
  }
};

/**
 * 批量生成卡密（管理员功能）
 */
const generateBatchCards = async (req, res) => {
  try {
    const {
      type = 'vip',
      vip_level = 1,
      vip_days = 30,
      points = 0,
      count = 1,
      expire_at = null
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
      expire_at: expire_at ? new Date(expire_at) : null
    }, parseInt(count), req.user.userId);

    res.status(201).json({
      success: true,
      message: `批量生成${result.count}个卡密成功`,
      data: {
        batch_id: result.batch_id,
        count: result.count,
        sample_codes: result.card_keys.slice(0, 5).map(card => card.code) // 只返回前5个作为示例
      }
    });
  } catch (error) {
    console.error('批量生成卡密失败:', error);
    res.status(500).json({
      success: false,
      message: '批量生成卡密失败'
    });
  }
};

/**
 * 兑换卡密
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

    const result = await CardKey.redeemCardKey(code.trim().toUpperCase(), req.user.userId);

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
        order: result.order
      }
    });
  } catch (error) {
    console.error('兑换卡密失败:', error);
    
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
 * 查询卡密信息
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
    const isUser = cardKey.used_by === req.user.userId;

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
    console.error('查询卡密失败:', error);
    res.status(500).json({
      success: false,
      message: '查询卡密失败'
    });
  }
};

/**
 * 获取卡密列表（管理员功能）
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

    // 非超级管理员只能查看自己创建的卡密
    const isSuperAdmin = req.user.roles?.some(role => role.name === 'super_admin');
    if (!isSuperAdmin) {
      options.created_by = req.user.userId;
    }

    const cardKeys = await CardKey.getCardKeys(options);

    res.json({
      success: true,
      message: '卡密列表获取成功',
      data: cardKeys
    });
  } catch (error) {
    console.error('获取卡密列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取卡密列表失败'
    });
  }
};

/**
 * 获取卡密统计信息（管理员功能）
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
    console.error('获取卡密统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取卡密统计失败'
    });
  }
};

/**
 * 获取批次列表（管理员功能）
 */
const getBatchesList = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    // 非超级管理员只能查看自己创建的批次
    const isSuperAdmin = req.user.roles?.some(role => role.name === 'super_admin');
    const createdBy = isSuperAdmin ? null : req.user.userId;

    const batches = await CardKey.getBatches(createdBy, parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      message: '批次列表获取成功',
      data: batches
    });
  } catch (error) {
    console.error('获取批次列表失败:', error);
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

    // 非超级管理员只能查看自己创建的批次
    const isSuperAdmin = req.user.roles?.some(role => role.name === 'super_admin');
    if (!isSuperAdmin) {
      options.created_by = req.user.userId;
    }

    const cardKeys = await CardKey.getCardKeys(options);

    if (cardKeys.length === 0) {
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
        card_keys: cardKeys
      }
    });
  } catch (error) {
    console.error('获取批次详情失败:', error);
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
    console.error('更新卡密状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新卡密状态失败'
    });
  }
};

/**
 * 删除卡密（管理员功能）
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
    console.error('删除卡密失败:', error);
    res.status(500).json({
      success: false,
      message: '删除卡密失败'
    });
  }
};

/**
 * 删除整个批次（管理员功能）
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
    console.error('删除批次失败:', error);
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
