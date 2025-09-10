/**
 * 积分系统控制器
 * 处理用户积分管理、积分记录查询等操作
 */

const Points = require('../models/Points');

/**
 * 获取当前用户积分信息
 */
const getMyPoints = async (req, res) => {
  try {
    const userId = req.user.userId;
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
    console.error('获取积分信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取积分信息失败'
    });
  }
};

/**
 * 获取当前用户积分记录
 */
const getMyPointsRecords = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20, offset = 0 } = req.query;
    
    const records = await Points.getUserPointsRecords(userId, parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      message: '积分记录获取成功',
      data: records
    });
  } catch (error) {
    console.error('获取积分记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取积分记录失败'
    });
  }
};

/**
 * 获取用户积分信息（管理员功能）
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
    console.error('获取用户积分信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户积分信息失败'
    });
  }
};

/**
 * 获取用户积分记录（管理员功能）
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
    console.error('获取用户积分记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户积分记录失败'
    });
  }
};

/**
 * 调整用户积分（管理员功能）
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

    const adminId = req.user.userId;
    const result = await Points.adjustPoints(parseInt(userId), parseInt(amount), description, adminId);
    
    res.json({
      success: true,
      message: `积分调整成功：${amount > 0 ? '增加' : '扣除'}${Math.abs(amount)}积分`,
      data: result
    });
  } catch (error) {
    console.error('调整用户积分失败:', error);
    
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
 * 批量发放积分（管理员功能）
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
    console.error('批量发放积分失败:', error);
    res.status(500).json({
      success: false,
      message: '批量发放积分失败'
    });
  }
};

/**
 * 获取积分排行榜
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
    console.error('获取积分排行榜失败:', error);
    res.status(500).json({
      success: false,
      message: '获取积分排行榜失败'
    });
  }
};

/**
 * 获取当前用户积分排名
 */
const getMyPointsRank = async (req, res) => {
  try {
    const userId = req.user.userId;
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
    console.error('获取积分排名失败:', error);
    res.status(500).json({
      success: false,
      message: '获取积分排名失败'
    });
  }
};

/**
 * 获取积分统计（管理员功能）
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
    console.error('获取积分统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取积分统计失败'
    });
  }
};

/**
 * 积分转账（用户功能）
 */
const transferPoints = async (req, res) => {
  try {
    const fromUserId = req.user.userId;
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
    console.error('积分转账失败:', error);
    
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
