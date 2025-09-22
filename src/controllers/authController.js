/**
 * 认证控制器
 * 处理用户注册、登录、令牌刷新等认证相关操作
 * @swagger
 * tags:
 *   name: Authentication
 *   description: 用户认证相关API
 */

const User = require('../models/User');
const VerificationCode = require('../models/VerificationCode');
const { generateTokenPair, verifyRefreshToken } = require('../utils/jwt');
const { checkPasswordStrength } = require('../utils/password');
const { logger } = require('../utils/logger');
const { services } = require('../services');
const AuditLog = require('../models/AuditLog');

const getRequestMeta = (req) => ({
  ipAddress: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip,
  userAgent: req.get('user-agent') || ''
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: 用户注册
 *     description: 注册新用户账号，包含用户名、邮箱、密码和昵称验证
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           examples:
 *             normalUser:
 *               summary: 普通用户注册
 *               value:
 *                 username: "newuser"
 *                 email: "newuser@example.com"
 *                 password: "NewUser123"
 *                 nickname: "新用户"
 *                 verification_code: "123456"
 *                 invite_code: "ABCD1234"
 *     responses:
 *       201:
 *         description: 注册成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             example:
 *               success: true
 *               message: "注册成功"
 *               data:
 *                 user:
 *                   id: 123
 *                   username: "newuser"
 *                   email: "newuser@example.com"
 *                   nickname: "新用户"
 *                   role: "user"
 *                   status: "active"
 *                   inviter:
 *                     id: 12
 *                     username: "mentor"
 *                     nickname: "导师"
 *                 tokens:
 *                   accessToken: "eyJhbGciOiJIUzI1NiIs..."
 *                   refreshToken: "eyJhbGciOiJIUzI1NiIs..."
 *                   tokenType: "Bearer"
 *                   expiresIn: "1h"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingFields:
 *                 summary: 缺少必填字段
 *                 value:
 *                   success: false
 *                   message: "用户名、邮箱和密码为必填项"
 *               weakPassword:
 *                 summary: 密码强度不足
 *                 value:
 *                   success: false
 *                   message: "密码必须至少8位，包含大小写字母、数字和特殊字符"
 *               userExists:
 *                 summary: 用户已存在
 *                 value:
 *                   success: false
 *                   message: "用户名或邮箱已被注册"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const register = async (req, res) => {
  const { username, email, password, nickname, verification_code, invite_code } = req.body || {};
  const { ipAddress, userAgent } = getRequestMeta(req);

  const logRegisterFailure = async (reason) => {
    await AuditLog.createSystemLog({
      operatorId: null,
      targetType: 'user',
      targetId: null,
      action: 'register_failed',
      summary: '用户注册失败',
      detail: { email, reason },
      ipAddress,
      userAgent
    });
  };

  try {
    let inviterPreview = null;

    if (invite_code) {
      try {
        inviterPreview = await services.referral.validateReferralCode(invite_code);
      } catch (validationError) {
        await logRegisterFailure(validationError.message || '邀请码无效');
        return res.status(400).json({
          success: false,
          message: validationError.message || '邀请码无效'
        });
      }
    }

    if (!username || !email || !password || !verification_code) {
      await logRegisterFailure('缺少必填字段');
      return res.status(400).json({
        success: false,
        message: '用户名、邮箱、密码和验证码为必填项'
      });
    }

    if (username.length < 3 || username.length > 50) {
      await logRegisterFailure('用户名长度必须在3-50个字符之间');
      return res.status(400).json({
        success: false,
        message: '用户名长度必须在3-50个字符之间'
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      await logRegisterFailure('用户名只能包含字母、数字和下划线');
      return res.status(400).json({
        success: false,
        message: '用户名只能包含字母、数字和下划线'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await logRegisterFailure('邮箱格式不正确');
      return res.status(400).json({
        success: false,
        message: '邮箱格式不正确'
      });
    }

    // 验证验证码格式
    if (!/^[0-9]{6}$/.test(verification_code)) {
      await logRegisterFailure('验证码格式错误');
      return res.status(400).json({
        success: false,
        message: '验证码必须为6位数字'
      });
    }

    // 验证邮箱验证码
    const verificationResult = await VerificationCode.verify(email, verification_code, 'register');
    if (!verificationResult.valid) {
      await logRegisterFailure('验证码验证失败');
      return res.status(400).json({
        success: false,
        message: verificationResult.reason
      });
    }

    const passwordCheck = checkPasswordStrength(password);
    if (!passwordCheck.isValid) {
      await logRegisterFailure('密码不符合要求');
      return res.status(400).json({
        success: false,
        message: '密码不符合要求',
        errors: passwordCheck.errors,
        suggestions: passwordCheck.suggestions
      });
    }

    const newUser = await User.create({
      username,
      email,
      password,
      nickname
    });

    const userRoles = await User.getUserRoles(newUser.id);

    if (invite_code) {
      try {
        await services.referral.bindInviterForNewUser(newUser.id, invite_code);
      } catch (bindError) {
        logger.error('绑定邀请关系失败:', bindError);
        await logRegisterFailure('绑定邀请关系失败');
        return res.status(500).json({
          success: false,
          message: bindError.message || '绑定邀请关系失败'
        });
      }
    }

    const tokens = generateTokenPair(newUser, userRoles);

    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);
    await User.storeRefreshToken(newUser.id, tokens.refreshToken, refreshTokenExpiry);

    await AuditLog.createSystemLog({
      operatorId: newUser.id,
      targetType: 'user',
      targetId: newUser.id,
      action: 'register',
      summary: '用户注册成功',
      detail: { email, invite_code },
      ipAddress,
      userAgent
    });

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          nickname: newUser.nickname,
          status: newUser.status,
          inviter: invite_code && inviterPreview ? {
            id: inviterPreview.id,
            username: inviterPreview.username,
            nickname: inviterPreview.nickname
          } : null
        },
        tokens
      }
    });
  } catch (error) {
    logger.error('注册失败:', error);
    await logRegisterFailure(error.message);

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
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: 用户登录
 *     description: 用户登录，支持邮箱或用户名登录，生成JWT令牌对
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 description: 邮箱地址（作为登录标识符）
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 description: 用户密码
 *                 example: "UserPassword123"
 *           examples:
 *             adminLogin:
 *               summary: 管理员登录
 *               value:
 *                 email: "5553621@qq.com"
 *                 password: "5553621"
 *             normalUser:
 *               summary: 普通用户登录
 *               value:
 *                 email: "user@example.com"
 *                 password: "UserPassword123"
 *     responses:
 *       200:
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             example:
 *               success: true
 *               message: "登录成功"
 *               data:
 *                 user:
 *                   id: 1
 *                   username: "testuser"
 *                   email: "user@example.com"
 *                   nickname: "测试用户"
 *                   status: "active"
 *                   roles: ["user"]
 *                 tokens:
 *                   accessToken: "eyJhbGciOiJIUzI1NiIs..."
 *                   refreshToken: "eyJhbGciOiJIUzI1NiIs..."
 *                   tokenType: "Bearer"
 *                   expiresIn: "1h"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingFields:
 *                 summary: 缺少必填字段
 *                 value:
 *                   success: false
 *                   message: "邮箱和密码为必填项"
 *       401:
 *         description: 认证失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               wrongCredentials:
 *                 summary: 邮箱或密码错误
 *                 value:
 *                   success: false
 *                   message: "邮箱或密码错误"
 *       403:
 *         description: 账户状态异常
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               bannedAccount:
 *                 summary: 账户被封禁
 *                 value:
 *                   success: false
 *                   message: "账户已被封禁"
 *               frozenAccount:
 *                 summary: 账户被冻结
 *                 value:
 *                   success: false
 *                   message: "账户已被冻结"
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "登录失败，请稍后重试"
 */
const login = async (req, res) => {
  const { email, password } = req.body || {};
  const { ipAddress, userAgent } = getRequestMeta(req);

  const logLogin = async ({ status, reason = null, userId = null }) => {
    await AuditLog.createLoginLog({
      userId,
      identifier: email || '',
      status,
      failureReason: reason,
      ipAddress,
      userAgent
    });
  };

  try {
    if (!email || !password) {
      await logLogin({ status: 'failure', reason: '邮箱和密码为必填项' });
      return res.status(400).json({
        success: false,
        message: '邮箱和密码为必填项'
      });
    }

    const user = await User.authenticate(email, password);

    if (!user) {
      await logLogin({ status: 'failure', reason: '邮箱或密码错误' });
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误'
      });
    }

    const userRoles = await User.getUserRoles(user.id);
    const tokens = generateTokenPair(user, userRoles);

    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);
    await User.storeRefreshToken(user.id, tokens.refreshToken, refreshTokenExpiry);

    await logLogin({ status: 'success', userId: user.id });

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
    logger.error('登录失败:', error);

    await logLogin({ status: 'failure', reason: error.message });

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
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: 刷新访问令牌
 *     description: 使用刷新令牌获取新的访问令牌和刷新令牌，旧的刷新令牌会被撤销
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *           examples:
 *             refreshToken:
 *               summary: 刷新令牌请求
 *               value:
 *                 refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzI2MTM5MjAwLCJleHAiOjE3MjY3NDQwMDB9.example"
 *     responses:
 *       200:
 *         description: 令牌刷新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenResponse'
 *             example:
 *               success: true
 *               message: "令牌刷新成功"
 *               data:
 *                 tokens:
 *                   accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new_access_token"
 *                   refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new_refresh_token"
 *                   tokenType: "Bearer"
 *                   expiresIn: "1h"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingToken:
 *                 summary: 缺少刷新令牌
 *                 value:
 *                   success: false
 *                   message: "缺少刷新令牌"
 *       401:
 *         description: 令牌验证失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidToken:
 *                 summary: 无效的刷新令牌
 *                 value:
 *                   success: false
 *                   message: "无效的刷新令牌"
 *               expiredToken:
 *                 summary: 令牌已过期
 *                 value:
 *                   success: false
 *                   message: "令牌刷新失败"
 *               revokedToken:
 *                 summary: 令牌已被撤销
 *                 value:
 *                   success: false
 *                   message: "令牌刷新失败"
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "令牌刷新失败"
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
    logger.error('令牌刷新失败:', error);
    res.status(401).json({
      success: false,
      message: '令牌刷新失败'
    });
  }
};

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: 用户登出
 *     description: 登出当前用户并撤销刷新令牌，使其失效
 *     tags: [Authentication]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: 刷新令牌（可选，提供则会撤销该令牌）
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzI2MTM5MjAwLCJleHAiOjE3MjY3NDQwMDB9.example"
 *           examples:
 *             withToken:
 *               summary: 包含刷新令牌的登出
 *               value:
 *                 refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh_token_here"
 *             withoutToken:
 *               summary: 不包含刷新令牌的登出
 *               value: {}
 *     responses:
 *       200:
 *         description: 登出成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: "登出成功"
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "登出失败"
 *     security: []
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
    logger.error('登出失败:', error);
    res.status(500).json({
      success: false,
      message: '登出失败'
    });
  }
};

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: 获取当前用户信息
 *     description: 获取当前登录用户的详细信息、角色和权限（需要认证）
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       required:
 *                         - user
 *                         - roles
 *                         - permissions
 *                       properties:
 *                         user:
 *                           $ref: '#/components/schemas/User'
 *                         roles:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: 用户角色列表
 *                           example: ["user", "vip"]
 *                         permissions:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: 用户权限列表
 *                           example: ["resource:view", "resource:download", "vip:access"]
 *             example:
 *               success: true
 *               data:
 *                 user:
 *                   id: 1
 *                   username: "testuser"
 *                   email: "user@example.com"
 *                   nickname: "测试用户"
 *                   avatar_url: "https://example.com/avatar.jpg"
 *                   bio: "这是我的个人简介"
 *                   status: "active"
 *                   created_at: "2025-09-11T08:00:00.000Z"
 *                   updated_at: "2025-09-12T12:00:00.000Z"
 *                 roles: ["user", "vip"]
 *                 permissions: ["resource:view", "resource:download", "vip:access"]
 *       401:
 *         description: 未授权访问
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               noToken:
 *                 summary: 缺少访问令牌
 *                 value:
 *                   success: false
 *                   message: "访问令牌无效或已过期"
 *               invalidToken:
 *                 summary: 无效的访问令牌
 *                 value:
 *                   success: false
 *                   message: "访问令牌无效或已过期"
 *               expiredToken:
 *                 summary: 访问令牌已过期
 *                 value:
 *                   success: false
 *                   message: "访问令牌无效或已过期"
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "获取用户信息失败"
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
    logger.error('获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
};

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: 重置密码
 *     description: 使用邮箱验证码重置用户密码
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - verification_code
 *               - new_password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 用户邮箱
 *                 example: "user@example.com"
 *               verification_code:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 description: 6位数字验证码
 *                 example: "123456"
 *               new_password:
 *                 type: string
 *                 description: 新密码
 *                 example: "NewPassword123"
 *           examples:
 *             resetPassword:
 *               summary: 重置密码
 *               value:
 *                 email: "user@example.com"
 *                 verification_code: "123456"
 *                 new_password: "NewPassword123"
 *     responses:
 *       200:
 *         description: 密码重置成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: "密码重置成功"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingFields:
 *                 summary: 缺少必填字段
 *                 value:
 *                   success: false
 *                   message: "邮箱、验证码和新密码为必填项"
 *               invalidCode:
 *                 summary: 验证码无效
 *                 value:
 *                   success: false
 *                   message: "验证码无效或已过期"
 *               weakPassword:
 *                 summary: 密码强度不足
 *                 value:
 *                   success: false
 *                   message: "密码不符合要求"
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
const resetPassword = async (req, res) => {
  const { email, verification_code, new_password } = req.body || {};
  const { ipAddress, userAgent } = getRequestMeta(req);

  const logPasswordResetFailure = async (reason, userId = null) => {
    await AuditLog.createSystemLog({
      operatorId: userId,
      targetType: 'user',
      targetId: userId,
      action: 'password_reset_failed',
      summary: '密码重置失败',
      detail: { email, reason },
      ipAddress,
      userAgent
    });
  };

  try {
    // 验证必填字段
    if (!email || !verification_code || !new_password) {
      await logPasswordResetFailure('缺少必填字段');
      return res.status(400).json({
        success: false,
        message: '邮箱、验证码和新密码为必填项'
      });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await logPasswordResetFailure('邮箱格式不正确');
      return res.status(400).json({
        success: false,
        message: '邮箱格式不正确'
      });
    }

    // 验证验证码格式
    if (!/^[0-9]{6}$/.test(verification_code)) {
      await logPasswordResetFailure('验证码格式错误');
      return res.status(400).json({
        success: false,
        message: '验证码必须为6位数字'
      });
    }

    // 检查用户是否存在
    const user = await User.findByEmail(email);
    if (!user) {
      await logPasswordResetFailure('用户不存在');
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查账户状态
    if (user.status === 'banned') {
      await logPasswordResetFailure('账户已被封禁', user.id);
      return res.status(403).json({
        success: false,
        message: '账户已被封禁，无法重置密码'
      });
    }

    // 验证邮箱验证码
    const verificationResult = await VerificationCode.verify(email, verification_code, 'reset_password');
    if (!verificationResult.valid) {
      await logPasswordResetFailure('验证码验证失败', user.id);
      return res.status(400).json({
        success: false,
        message: verificationResult.reason
      });
    }

    // 验证新密码强度
    const passwordCheck = checkPasswordStrength(new_password);
    if (!passwordCheck.isValid) {
      await logPasswordResetFailure('密码不符合要求', user.id);
      return res.status(400).json({
        success: false,
        message: '密码不符合要求',
        errors: passwordCheck.errors,
        suggestions: passwordCheck.suggestions
      });
    }

    // 更新密码
    await User.updatePassword(user.id, new_password);

    // 撤销该用户的所有刷新令牌
    await User.revokeAllRefreshTokens(user.id);

    // 记录成功日志
    await AuditLog.createSystemLog({
      operatorId: user.id,
      targetType: 'user',
      targetId: user.id,
      action: 'password_reset',
      summary: '密码重置成功',
      detail: { email },
      ipAddress,
      userAgent
    });

    res.json({
      success: true,
      message: '密码重置成功'
    });

  } catch (error) {
    logger.error('密码重置失败:', error);
    await logPasswordResetFailure(error.message);
    res.status(500).json({
      success: false,
      message: '密码重置失败，请稍后重试',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
  resetPassword
};
