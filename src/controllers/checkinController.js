/**
 * 签到系统控制器
 * 处理用户签到、签到配置管理等操作
 */

const Checkin = require('../models/Checkin');

/**
 * 执行签到
 */
const performCheckin = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await Checkin.performCheckin(userId);
    
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
    console.error('签到失败:', error);
    
    if (error.message === '今日已签到') {
      return res.status(400).json({
        success: false,
        message: '今日已签到，请明天再来'
      });
    }

    if (error.message === '签到功能未配置') {
      return res.status(503).json({
        success: false,
        message: '签到功能暂时不可用'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '签到失败，请稍后重试'
    });
  }
};

/**
 * 获取当前用户签到状态
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
    console.error('获取签到状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取签到状态失败'
    });
  }
};

/**
 * 获取当前用户签到历史
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
    console.error('获取签到历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取签到历史失败'
    });
  }
};

/**
 * 获取签到排行榜
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
    console.error('获取签到排行榜失败:', error);
    res.status(500).json({
      success: false,
      message: '获取签到排行榜失败'
    });
  }
};

/**
 * 获取所有签到配置（管理员功能）
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
    console.error('获取签到配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取签到配置失败'
    });
  }
};

/**
 * 创建签到配置（管理员功能）
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
      monthly_reset = true
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

    const createdBy = req.user.id;
    const config = await Checkin.createConfig({
      name,
      description,
      daily_points,
      consecutive_bonus,
      monthly_reset
    }, createdBy);
    
    res.status(201).json({
      success: true,
      message: '签到配置创建成功',
      data: config
    });
  } catch (error) {
    console.error('创建签到配置失败:', error);
    res.status(500).json({
      success: false,
      message: '创建签到配置失败'
    });
  }
};

/**
 * 更新签到配置（管理员功能）
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
    console.error('更新签到配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新签到配置失败'
    });
  }
};

/**
 * 获取用户签到信息（管理员功能）
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
    console.error('获取用户签到信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户签到信息失败'
    });
  }
};

/**
 * 获取用户签到历史（管理员功能）
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
    console.error('获取用户签到历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户签到历史失败'
    });
  }
};

/**
 * 补签功能（管理员功能）
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
    console.error('补签失败:', error);
    
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
 * 重置用户签到数据（管理员功能）
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
    console.error('重置用户签到数据失败:', error);
    res.status(500).json({
      success: false,
      message: '重置用户签到数据失败'
    });
  }
};

/**
 * 获取签到统计（管理员功能）
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
    console.error('获取签到统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取签到统计失败'
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
  getUserCheckinInfo,
  getUserCheckinHistory,
  makeupCheckin,
  resetUserCheckins,
  getCheckinStatistics
};
