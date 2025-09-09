/**
 * 用户管理控制器
 * 处理用户资料修改、状态管理等操作
 */

const User = require('../models/User');
const { checkPasswordStrength } = require('../utils/password');
const { body, validationResult } = require('express-validator');

/**
 * 更新用户资料
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { nickname, avatar_url, bio } = req.body;

    // 构建更新数据对象
    const updateData = {};
    
    if (nickname !== undefined) {
      if (nickname.length < 1 || nickname.length > 100) {
        return res.status(400).json({
          success: false,
          message: '昵称长度必须在1-100个字符之间'
        });
      }
      updateData.nickname = nickname;
    }

    if (avatar_url !== undefined) {
      if (avatar_url && avatar_url.length > 500) {
        return res.status(400).json({
          success: false,
          message: '头像URL长度不能超过500个字符'
        });
      }
      updateData.avatar_url = avatar_url;
    }

    if (bio !== undefined) {
      if (bio && bio.length > 500) {
        return res.status(400).json({
          success: false,
          message: '个人简介长度不能超过500个字符'
        });
      }
      updateData.bio = bio;
    }

    // 更新用户信息
    const updatedUser = await User.update(userId, updateData);

    res.json({
      success: true,
      message: '用户资料更新成功',
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    console.error('更新用户资料失败:', error);
    res.status(500).json({
      success: false,
      message: '用户资料更新失败'
    });
  }
};

/**
 * 获取用户列表（管理员功能）
 */
const getUserList = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (page - 1) * limit;

    // 构建查询条件
    let whereClause = '';
    let queryParams = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` WHERE status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    if (search) {
      const searchCondition = ` ${whereClause ? 'AND' : 'WHERE'} (username ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR nickname ILIKE $${paramIndex})`;
      whereClause += searchCondition;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // 查询用户列表
    const usersQuery = `
      SELECT id, username, email, nickname, avatar_url, status, created_at, updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);
    
    const { query } = require('../config/database');
    const result = await query(usersQuery, queryParams);

    // 查询总数
    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countResult = await query(countQuery, queryParams.slice(0, -2)); // 移除limit和offset参数
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        users: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户列表失败'
    });
  }
};

/**
 * 获取指定用户信息（管理员功能）
 */
const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 获取用户角色和权限
    const roles = await User.getUserRoles(userId);
    const permissions = await User.getUserPermissions(userId);

    res.json({
      success: true,
      data: {
        user,
        roles,
        permissions
      }
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
};

/**
 * 更新用户状态（管理员功能）
 */
const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: '用户状态为必填项'
      });
    }

    const validStatuses = ['normal', 'banned', 'frozen'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: '无效的用户状态'
      });
    }

    // 检查是否尝试修改自己的状态
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: '不能修改自己的状态'
      });
    }

    const updatedUser = await User.updateStatus(userId, status);

    // 记录操作日志（这里可以扩展日志系统）
    console.log(`管理员 ${req.user.username} 将用户 ${updatedUser.username} 的状态更改为 ${status}${reason ? `，原因：${reason}` : ''}`);

    res.json({
      success: true,
      message: `用户状态已更新为${status === 'normal' ? '正常' : status === 'banned' ? '封禁' : '冻结'}`,
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    console.error('更新用户状态失败:', error);
    
    if (error.message.includes('不存在')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: '更新用户状态失败'
    });
  }
};

/**
 * 为用户分配角色（管理员功能）
 */
const assignUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleName } = req.body;

    if (!roleName) {
      return res.status(400).json({
        success: false,
        message: '角色名称为必填项'
      });
    }

    const validRoles = ['user', 'vip', 'moderator', 'admin'];
    if (!validRoles.includes(roleName)) {
      return res.status(400).json({
        success: false,
        message: '无效的角色名称'
      });
    }

    // 检查用户是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 分配角色
    await User.assignRole(userId, roleName);

    // 获取用户当前所有角色
    const updatedRoles = await User.getUserRoles(userId);

    res.json({
      success: true,
      message: '角色分配成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        },
        roles: updatedRoles
      }
    });
  } catch (error) {
    console.error('分配用户角色失败:', error);
    
    if (error.message.includes('不存在')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: '分配用户角色失败'
    });
  }
};

/**
 * 移除用户角色（管理员功能）
 */
const removeUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleName } = req.body;

    if (!roleName) {
      return res.status(400).json({
        success: false,
        message: '角色名称为必填项'
      });
    }

    // 检查用户是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 移除角色
    const { query } = require('../config/database');
    await query(
      `DELETE FROM user_roles 
       WHERE user_id = $1 AND role_id = (SELECT id FROM roles WHERE name = $2)`,
      [userId, roleName]
    );

    // 获取用户当前所有角色
    const updatedRoles = await User.getUserRoles(userId);

    res.json({
      success: true,
      message: '角色移除成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        },
        roles: updatedRoles
      }
    });
  } catch (error) {
    console.error('移除用户角色失败:', error);
    res.status(500).json({
      success: false,
      message: '移除用户角色失败'
    });
  }
};

/**
 * 管理员创建用户
 */
const createUser = async (req, res) => {
  try {
    // 输入验证
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '输入验证失败',
        errors: errors.array()
      });
    }

    const { username, email, password, nickname, roleName, status } = req.body;

    // 密码强度检查
    const passwordCheck = checkPasswordStrength(password);
    if (!passwordCheck.isValid) {
      return res.status(400).json({
        success: false,
        message: '密码强度不足',
        requirements: passwordCheck.requirements
      });
    }

    // 创建用户
    const newUser = await User.createByAdmin({
      username,
      email,
      password,
      nickname,
      roleName: roleName || 'user',
      status: status || 'normal'
    });

    // 获取用户的角色信息
    const userRoles = await User.getUserRoles(newUser.id);

    res.status(201).json({
      success: true,
      message: '用户创建成功',
      data: {
        user: newUser,
        roles: userRoles
      }
    });

  } catch (error) {
    console.error('创建用户失败:', error);
    
    if (error.message.includes('已存在')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('无效的')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: '创建用户失败'
    });
  }
};

/**
 * 管理员删除用户
 */
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // 检查是否尝试删除自己
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: '不能删除自己的账户'
      });
    }

    // 删除用户
    const deletedUser = await User.deleteUser(userId);

    // 记录操作日志
    console.log(`管理员 ${req.user.username} 删除了用户 ${deletedUser.username} (ID: ${deletedUser.id})`);

    res.json({
      success: true,
      message: '用户删除成功',
      data: {
        deletedUser: {
          id: deletedUser.id,
          username: deletedUser.username,
          email: deletedUser.email,
          nickname: deletedUser.nickname
        }
      }
    });

  } catch (error) {
    console.error('删除用户失败:', error);
    
    if (error.message.includes('不存在')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: '删除用户失败'
    });
  }
};

/**
 * 冻结/解冻用户
 */
const freezeUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    // 检查是否尝试修改自己的状态
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: '不能冻结自己的账户'
      });
    }

    // 获取用户当前状态
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 决定新状态（冻结<->解冻）
    const newStatus = user.status === 'frozen' ? 'normal' : 'frozen';
    const actionText = newStatus === 'frozen' ? '冻结' : '解冻';

    // 更新用户状态
    const updatedUser = await User.updateStatus(userId, newStatus);

    // 记录操作日志
    console.log(`管理员 ${req.user.username} ${actionText}了用户 ${updatedUser.username}${reason ? `，原因：${reason}` : ''}`);

    res.json({
      success: true,
      message: `用户${actionText}成功`,
      data: {
        user: updatedUser,
        action: actionText,
        reason: reason || null
      }
    });

  } catch (error) {
    console.error(`用户冻结/解冻失败:`, error);
    
    if (error.message.includes('不存在')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: '用户状态更新失败'
    });
  }
};

/**
 * 获取用户统计信息（管理员功能）
 */
const getUserStats = async (req, res) => {
  try {
    const { query } = require('../config/database');
    
    // 查询各种统计信息
    const [
      totalUsersResult,
      activeUsersResult,
      bannedUsersResult,
      frozenUsersResult,
      recentRegistrationsResult
    ] = await Promise.all([
      query('SELECT COUNT(*) FROM users'),
      query('SELECT COUNT(*) FROM users WHERE status = $1', ['normal']),
      query('SELECT COUNT(*) FROM users WHERE status = $1', ['banned']),
      query('SELECT COUNT(*) FROM users WHERE status = $1', ['frozen']),
      query('SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL \'7 days\'')
    ]);

    // 按角色统计用户数量
    const roleStatsResult = await query(`
      SELECT r.display_name, COUNT(ur.user_id) as user_count
      FROM roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id
      GROUP BY r.id, r.display_name
      ORDER BY user_count DESC
    `);

    res.json({
      success: true,
      data: {
        totalUsers: parseInt(totalUsersResult.rows[0].count),
        activeUsers: parseInt(activeUsersResult.rows[0].count),
        bannedUsers: parseInt(bannedUsersResult.rows[0].count),
        frozenUsers: parseInt(frozenUsersResult.rows[0].count),
        recentRegistrations: parseInt(recentRegistrationsResult.rows[0].count),
        roleStats: roleStatsResult.rows
      }
    });
  } catch (error) {
    console.error('获取用户统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户统计失败'
    });
  }
};

module.exports = {
  updateProfile,
  getUserList,
  getUserById,
  updateUserStatus,
  assignUserRole,
  removeUserRole,
  getUserStats,
  createUser,
  deleteUser,
  freezeUser
};
