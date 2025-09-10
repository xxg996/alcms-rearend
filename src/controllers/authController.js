/**
 * 认证控制器
 * 处理用户注册、登录、令牌刷新等认证相关操作
 */

const User = require('../models/User');
const { generateTokenPair, verifyRefreshToken } = require('../utils/jwt');
const { checkPasswordStrength } = require('../utils/password');

/**
 * 用户注册
 */
const register = async (req, res) => {
  try {
    const { username, email, password, nickname } = req.body;

    // 基础验证
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名、邮箱和密码为必填项'
      });
    }

    // 用户名验证
    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({
        success: false,
        message: '用户名长度必须在3-50个字符之间'
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({
        success: false,
        message: '用户名只能包含字母、数字和下划线'
      });
    }

    // 邮箱验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: '邮箱格式不正确'
      });
    }

    // 密码强度检查
    const passwordCheck = checkPasswordStrength(password);
    if (!passwordCheck.isValid) {
      return res.status(400).json({
        success: false,
        message: '密码不符合要求',
        errors: passwordCheck.errors,
        suggestions: passwordCheck.suggestions
      });
    }

    // 创建用户
    const newUser = await User.create({
      username,
      email,
      password,
      nickname
    });

    // 获取用户角色信息
    const userRoles = await User.getUserRoles(newUser.id);
    
    // 生成令牌对
    const tokens = generateTokenPair(newUser, userRoles);

    // 存储刷新令牌
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7天后过期
    await User.storeRefreshToken(newUser.id, tokens.refreshToken, refreshTokenExpiry);

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          nickname: newUser.nickname,
          status: newUser.status
        },
        tokens
      }
    });
  } catch (error) {
    console.error('注册失败:', error);
    
    if (error.message.includes('已存在')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: '注册失败，请稍后重试'
    });
  }
};

/**
 * 用户登录
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '邮箱和密码为必填项'
      });
    }

    // 验证用户凭据
    const user = await User.authenticate(email, password);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误'
      });
    }

    // 获取用户角色信息
    const userRoles = await User.getUserRoles(user.id);
    
    // 生成令牌对
    const tokens = generateTokenPair(user, userRoles);

    // 存储刷新令牌
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);
    await User.storeRefreshToken(user.id, tokens.refreshToken, refreshTokenExpiry);

    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          nickname: user.nickname,
          status: user.status,
          roles: userRoles
        },
        tokens
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    
    if (error.message.includes('封禁') || error.message.includes('冻结')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: '登录失败，请稍后重试'
    });
  }
};

/**
 * 刷新访问令牌
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: '缺少刷新令牌'
      });
    }

    // 验证刷新令牌
    const decoded = verifyRefreshToken(refreshToken);
    
    // 从数据库验证令牌
    const tokenRecord = await User.validateRefreshToken(refreshToken);
    
    if (!tokenRecord) {
      return res.status(401).json({
        success: false,
        message: '无效的刷新令牌'
      });
    }

    // 生成新的令牌对
    const user = {
      id: tokenRecord.user_id,
      username: tokenRecord.username,
      email: tokenRecord.email
    };
    
    // 获取用户角色信息
    const userRoles = await User.getUserRoles(user.id);
    
    const newTokens = generateTokenPair(user, userRoles);

    // 撤销旧的刷新令牌
    await User.revokeRefreshToken(refreshToken);

    // 存储新的刷新令牌
    const newRefreshTokenExpiry = new Date();
    newRefreshTokenExpiry.setDate(newRefreshTokenExpiry.getDate() + 7);
    await User.storeRefreshToken(user.id, newTokens.refreshToken, newRefreshTokenExpiry);

    res.json({
      success: true,
      message: '令牌刷新成功',
      data: {
        tokens: newTokens
      }
    });
  } catch (error) {
    console.error('令牌刷新失败:', error);
    res.status(401).json({
      success: false,
      message: '令牌刷新失败'
    });
  }
};

/**
 * 用户登出
 */
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // 撤销刷新令牌
      await User.revokeRefreshToken(refreshToken);
    }

    res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error) {
    console.error('登出失败:', error);
    res.status(500).json({
      success: false,
      message: '登出失败'
    });
  }
};

/**
 * 获取当前用户信息
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 获取完整的用户信息
    const user = await User.findById(userId);
    const roles = await User.getUserRoles(userId);
    const permissions = await User.getUserPermissions(userId);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          nickname: user.nickname,
          avatar_url: user.avatar_url,
          bio: user.bio,
          status: user.status,
          created_at: user.created_at,
          updated_at: user.updated_at
        },
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

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getProfile
};
