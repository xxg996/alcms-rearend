/**
 * VIP系统控制器
 * 处理VIP等级管理、用户VIP操作等
 */

const VIP = require('../models/VIP');

/**
 * 获取所有VIP等级配置
 */
const getAllLevels = async (req, res) => {
  try {
    const levels = await VIP.getAllLevels();
    
    res.json({
      success: true,
      message: 'VIP等级获取成功',
      data: levels
    });
  } catch (error) {
    console.error('获取VIP等级失败:', error);
    res.status(500).json({
      success: false,
      message: '获取VIP等级失败'
    });
  }
};

/**
 * 获取指定VIP等级配置
 */
const getLevelById = async (req, res) => {
  try {
    const { level } = req.params;
    const vipLevel = await VIP.getLevelById(parseInt(level));
    
    if (!vipLevel) {
      return res.status(404).json({
        success: false,
        message: 'VIP等级不存在'
      });
    }
    
    res.json({
      success: true,
      message: 'VIP等级获取成功',
      data: vipLevel
    });
  } catch (error) {
    console.error('获取VIP等级失败:', error);
    res.status(500).json({
      success: false,
      message: '获取VIP等级失败'
    });
  }
};

/**
 * 创建VIP等级配置（管理员功能）
 */
const createLevel = async (req, res) => {
  try {
    const {
      level,
      name,
      display_name,
      description,
      benefits,
      price,
      duration_days
    } = req.body;

    // 验证必填字段
    if (!level || !name || !display_name) {
      return res.status(400).json({
        success: false,
        message: '等级、名称和显示名称为必填字段'
      });
    }

    // 验证等级数值
    if (level < 0) {
      return res.status(400).json({
        success: false,
        message: 'VIP等级不能为负数'
      });
    }

    const newLevel = await VIP.createLevel({
      level: parseInt(level),
      name,
      display_name,
      description,
      benefits: benefits || {},
      price: parseFloat(price) || 0,
      duration_days: parseInt(duration_days) || 30
    });
    
    res.status(201).json({
      success: true,
      message: 'VIP等级创建成功',
      data: newLevel
    });
  } catch (error) {
    console.error('创建VIP等级失败:', error);
    if (error.code === '23505') { // 唯一约束违反
      return res.status(400).json({
        success: false,
        message: '该VIP等级已存在'
      });
    }
    res.status(500).json({
      success: false,
      message: '创建VIP等级失败'
    });
  }
};

/**
 * 更新VIP等级配置（管理员功能）
 */
const updateLevel = async (req, res) => {
  try {
    const { level } = req.params;
    const updateData = req.body;

    // 移除level字段，防止更新主键
    delete updateData.level;

    const updatedLevel = await VIP.updateLevel(parseInt(level), updateData);
    
    if (!updatedLevel) {
      return res.status(404).json({
        success: false,
        message: 'VIP等级不存在'
      });
    }
    
    res.json({
      success: true,
      message: 'VIP等级更新成功',
      data: updatedLevel
    });
  } catch (error) {
    console.error('更新VIP等级失败:', error);
    res.status(500).json({
      success: false,
      message: '更新VIP等级失败'
    });
  }
};

/**
 * 删除VIP等级配置（管理员功能）
 */
const deleteLevel = async (req, res) => {
  try {
    const { level } = req.params;
    const deletedLevel = await VIP.deleteLevel(parseInt(level));
    
    if (!deletedLevel) {
      return res.status(404).json({
        success: false,
        message: 'VIP等级不存在'
      });
    }
    
    res.json({
      success: true,
      message: 'VIP等级删除成功',
      data: deletedLevel
    });
  } catch (error) {
    console.error('删除VIP等级失败:', error);
    res.status(500).json({
      success: false,
      message: '删除VIP等级失败'
    });
  }
};

/**
 * 获取当前用户VIP信息
 */
const getMyVIPInfo = async (req, res) => {
  try {
    const userId = req.user.userId;
    const vipInfo = await VIP.getUserVIPInfo(userId);
    
    if (!vipInfo) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查VIP是否过期
    let isExpired = false;
    if (vipInfo.is_vip && vipInfo.vip_expire_at) {
      isExpired = new Date(vipInfo.vip_expire_at) < new Date();
    }
    
    res.json({
      success: true,
      message: 'VIP信息获取成功',
      data: {
        ...vipInfo,
        is_expired: isExpired,
        is_permanent: vipInfo.is_vip && !vipInfo.vip_expire_at
      }
    });
  } catch (error) {
    console.error('获取VIP信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取VIP信息失败'
    });
  }
};

/**
 * 获取用户VIP信息（管理员功能）
 */
const getUserVIPInfo = async (req, res) => {
  try {
    const { userId } = req.params;
    const vipInfo = await VIP.getUserVIPInfo(parseInt(userId));
    
    if (!vipInfo) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查VIP是否过期
    let isExpired = false;
    if (vipInfo.is_vip && vipInfo.vip_expire_at) {
      isExpired = new Date(vipInfo.vip_expire_at) < new Date();
    }
    
    res.json({
      success: true,
      message: 'VIP信息获取成功',
      data: {
        ...vipInfo,
        is_expired: isExpired,
        is_permanent: vipInfo.is_vip && !vipInfo.vip_expire_at
      }
    });
  } catch (error) {
    console.error('获取用户VIP信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户VIP信息失败'
    });
  }
};

/**
 * 设置用户VIP（管理员功能）
 */
const setUserVIP = async (req, res) => {
  try {
    const { userId } = req.params;
    const { vip_level, days } = req.body;

    if (!vip_level || vip_level < 0) {
      return res.status(400).json({
        success: false,
        message: 'VIP等级必须大于等于0'
      });
    }

    if (days < 0) {
      return res.status(400).json({
        success: false,
        message: 'VIP天数不能为负数'
      });
    }

    // 检查VIP等级是否存在
    const levelConfig = await VIP.getLevelById(vip_level);
    if (!levelConfig) {
      return res.status(400).json({
        success: false,
        message: 'VIP等级不存在'
      });
    }

    const result = await VIP.setUserVIP(parseInt(userId), vip_level, days || 30);
    
    res.json({
      success: true,
      message: 'VIP设置成功',
      data: {
        user: result,
        vip_level_info: levelConfig
      }
    });
  } catch (error) {
    console.error('设置用户VIP失败:', error);
    res.status(500).json({
      success: false,
      message: '设置用户VIP失败'
    });
  }
};

/**
 * 延长用户VIP时间（管理员功能）
 */
const extendUserVIP = async (req, res) => {
  try {
    const { userId } = req.params;
    const { days } = req.body;

    if (days < 0) {
      return res.status(400).json({
        success: false,
        message: 'VIP天数不能为负数'
      });
    }

    const result = await VIP.extendUserVIP(parseInt(userId), days || 30);
    
    res.json({
      success: true,
      message: days === 0 ? 'VIP设置为永久成功' : 'VIP延长成功',
      data: result
    });
  } catch (error) {
    console.error('延长用户VIP失败:', error);
    res.status(500).json({
      success: false,
      message: '延长用户VIP失败'
    });
  }
};

/**
 * 取消用户VIP（管理员功能）
 */
const cancelUserVIP = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await VIP.cancelUserVIP(parseInt(userId));
    
    res.json({
      success: true,
      message: 'VIP取消成功',
      data: result
    });
  } catch (error) {
    console.error('取消用户VIP失败:', error);
    res.status(500).json({
      success: false,
      message: '取消用户VIP失败'
    });
  }
};

/**
 * 获取用户订单历史
 */
const getMyOrders = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 10, offset = 0 } = req.query;
    
    const orders = await VIP.getUserOrders(userId, parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      message: '订单历史获取成功',
      data: orders
    });
  } catch (error) {
    console.error('获取订单历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取订单历史失败'
    });
  }
};

/**
 * 获取订单详情
 */
const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await VIP.getOrderById(parseInt(orderId));
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }

    // 检查权限：只有订单所有者或管理员才能查看
    const isOwner = order.user_id === req.user.userId;
    const isAdmin = req.user.roles?.some(role => ['admin', 'super_admin'].includes(role.name));
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: '无权查看此订单'
      });
    }
    
    res.json({
      success: true,
      message: '订单详情获取成功',
      data: order
    });
  } catch (error) {
    console.error('获取订单详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取订单详情失败'
    });
  }
};

/**
 * 更新过期VIP用户（系统任务）
 */
const updateExpiredVIP = async (req, res) => {
  try {
    const expiredUsers = await VIP.updateExpiredVIP();
    
    res.json({
      success: true,
      message: `成功更新${expiredUsers.length}个过期VIP用户`,
      data: expiredUsers
    });
  } catch (error) {
    console.error('更新过期VIP失败:', error);
    res.status(500).json({
      success: false,
      message: '更新过期VIP失败'
    });
  }
};

module.exports = {
  getAllLevels,
  getLevelById,
  createLevel,
  updateLevel,
  deleteLevel,
  getMyVIPInfo,
  getUserVIPInfo,
  setUserVIP,
  extendUserVIP,
  cancelUserVIP,
  getMyOrders,
  getOrderById,
  updateExpiredVIP
};
