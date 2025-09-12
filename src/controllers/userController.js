/**
 * 用户管理控制器
 * 处理用户相关的HTTP请求，业务逻辑委托给UserService
 * @swagger
 * tags:
 *   name: Users
 *   description: 用户管理相关API
 */

const { UserService } = require('../services');
const { body, validationResult } = require('express-validator');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: 更新当前用户资料
 *     description: 更新当前登录用户的个人资料信息，如昵称、头像、个人简介等
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserProfile'
 *           examples:
 *             updateNickname:
 *               summary: 更新昵称
 *               value:
 *                 nickname: "新昵称"
 *             updateAvatar:
 *               summary: 更新头像和简介
 *               value:
 *                 avatar_url: "https://example.com/new-avatar.jpg"
 *                 bio: "这是我的新简介"
 *     responses:
 *       200:
 *         description: 用户资料更新成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *             example:
 *               success: true
 *               message: "用户资料更新成功"
 *               data:
 *                 id: 1
 *                 username: "testuser"
 *                 email: "test@example.com"
 *                 nickname: "新昵称"
 *                 avatar_url: "https://example.com/new-avatar.jpg"
 *                 bio: "这是我的新简介"
 *                 role: "user"
 *                 status: "active"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profileData = req.body;

    const result = await UserService.updateProfile(userId, profileData);
    
    res.json(result);
  } catch (error) {
    logger.error('更新用户资料失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '用户资料更新失败'
    });
  }
};

/**
 * @swagger
 * /api/users/password:
 *   put:
 *     summary: 修改密码
 *     description: 修改当前登录用户的密码
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *           example:
 *             currentPassword: "oldPassword123"
 *             newPassword: "newPassword456"
 *     responses:
 *       200:
 *         description: 密码修改成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: "密码修改成功"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const passwordData = req.body;

    const result = await UserService.changePassword(userId, passwordData);
    
    res.json(result);
  } catch (error) {
    logger.error('修改密码失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '密码修改失败'
    });
  }
};

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: 获取当前用户资料
 *     description: 获取当前登录用户的详细资料信息
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 获取用户资料成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *             example:
 *               success: true
 *               message: "获取用户资料成功"
 *               data:
 *                 id: 1
 *                 username: "testuser"
 *                 email: "test@example.com"
 *                 nickname: "测试用户"
 *                 avatar_url: null
 *                 bio: null
 *                 role: "user"
 *                 status: "active"
 *                 last_login_at: "2025-09-12T08:00:00.000Z"
 *                 created_at: "2025-09-11T10:00:00.000Z"
 *                 updated_at: "2025-09-12T08:00:00.000Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await UserService.getProfile(userId);
    
    res.json(result);
  } catch (error) {
    logger.error('获取用户资料失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取用户资料失败'
    });
  }
};

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: 获取用户列表
 *     description: 获取所有用户列表，支持分页和过滤（仅限管理员）
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 每页数量
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [user, vip, moderator, admin]
 *         description: 按角色过滤
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, banned]
 *         description: 按状态过滤
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 搜索关键词（在用户名、邮箱、昵称中搜索）
 *     responses:
 *       200:
 *         description: 获取用户列表成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserListResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getUserList = async (req, res) => {
  try {
    const { page, limit, role, status, search } = req.query;
    
    const filters = { role, status, search };
    const pagination = { page, limit };

    const result = await UserService.getUserList(filters, pagination);
    
    res.json(result);
  } catch (error) {
    logger.error('获取用户列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取用户列表失败'
    });
  }
};

/**
 * @swagger
 * /api/users/{id}/status:
 *   put:
 *     summary: 更新用户状态
 *     description: 修改指定用户的状态（仅限管理员）
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 用户ID
 *         example: 123
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserStatusRequest'
 *           example:
 *             status: "banned"
 *     responses:
 *       200:
 *         description: 用户状态更新成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *             example:
 *               success: true
 *               message: "用户状态已更新为: banned"
 *               data:
 *                 id: 123
 *                 username: "targetuser"
 *                 status: "banned"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
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
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const updateUserStatus = async (req, res) => {
  try {
    const adminUserId = req.user.id;
    const targetUserId = parseInt(req.params.id);
    const { status } = req.body;

    const result = await UserService.updateUserStatus(adminUserId, targetUserId, status);
    
    res.json(result);
  } catch (error) {
    logger.error('更新用户状态失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '更新用户状态失败'
    });
  }
};

/**
 * @swagger
 * /api/users/stats:
 *   get:
 *     summary: 获取用户统计信息
 *     description: 获取用户相关的统计数据，包括总数、状态分布、角色分布等（仅限管理员）
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 获取用户统计成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserStats'
 *             example:
 *               success: true
 *               message: "获取用户统计成功"
 *               data:
 *                 total: 1000
 *                 active: 950
 *                 inactive: 30
 *                 banned: 20
 *                 byRole:
 *                   user: 800
 *                   vip: 150
 *                   moderator: 45
 *                   admin: 5
 *                 newUsersToday: 25
 *                 newUsersThisWeek: 180
 *                 newUsersThisMonth: 720
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getUserStats = async (req, res) => {
  try {
    const result = await UserService.getUserStats();
    
    res.json(result);
  } catch (error) {
    logger.error('获取用户统计失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取用户统计失败'
    });
  }
};

/**
 * 输入验证中间件
 */
const validateUpdateProfile = [
  body('nickname').optional().isLength({ min: 1, max: 100 }).withMessage('昵称长度必须在1-100个字符之间'),
  body('avatar_url').optional().isLength({ max: 500 }).withMessage('头像URL长度不能超过500个字符'),
  body('bio').optional().isLength({ max: 500 }).withMessage('个人简介长度不能超过500个字符')
];

const validateChangePassword = [
  body('currentPassword').notEmpty().withMessage('当前密码不能为空'),
  body('newPassword').isLength({ min: 8 }).withMessage('新密码至少8位')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('密码必须包含大小写字母和数字')
];

const validateUpdateUserStatus = [
  body('status').isIn(['active', 'inactive', 'banned']).withMessage('无效的状态值')
];

/**
 * 验证结果处理中间件
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: errors.array()
    });
  }
  next();
};

module.exports = {
  updateProfile: [validateUpdateProfile, handleValidationErrors, updateProfile],
  changePassword: [validateChangePassword, handleValidationErrors, changePassword],
  getProfile,
  getUserList,
  updateUserStatus: [validateUpdateUserStatus, handleValidationErrors, updateUserStatus],
  getUserStats
};