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
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: 获取指定用户信息
 *     description: 根据用户ID获取指定用户的详细信息（管理员功能）
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
 *     responses:
 *       200:
 *         description: 获取用户信息成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: 用户不存在
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getUserById = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const result = await UserService.getUserById(userId);
    
    res.json(result);
  } catch (error) {
    logger.error('获取用户信息失败:', error);
    if (error.message === '用户不存在') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || '获取用户信息失败'
      });
    }
  }
};

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: 创建用户
 *     description: 管理员创建新用户账号
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *           example:
 *             username: "newuser"
 *             email: "newuser@example.com"
 *             password: "TempPassword123"
 *             nickname: "新用户"
 *             roleName: "user"
 *             status: "normal"
 *     responses:
 *       201:
 *         description: 用户创建成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: 用户名或邮箱已存在
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const createUser = async (req, res) => {
  try {
    const adminUserId = req.user.id;
    const userData = req.body;

    const result = await UserService.createUser(adminUserId, userData);
    
    res.status(201).json(result);
  } catch (error) {
    logger.error('创建用户失败:', error);
    if (error.message === '用户名或邮箱已存在') {
      res.status(409).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || '创建用户失败'
      });
    }
  }
};

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: 删除用户
 *     description: 管理员删除指定用户账号（危险操作）
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
 *     responses:
 *       200:
 *         description: 用户删除成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         deletedUser:
 *                           $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: 用户不存在
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const deleteUser = async (req, res) => {
  try {
    const adminUserId = req.user.id;
    const targetUserId = parseInt(req.params.id);

    const result = await UserService.deleteUser(adminUserId, targetUserId);
    
    res.json(result);
  } catch (error) {
    logger.error('删除用户失败:', error);
    if (error.message === '用户不存在') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || '删除用户失败'
      });
    }
  }
};

/**
 * @swagger
 * /api/users/{id}/roles:
 *   post:
 *     summary: 分配用户角色
 *     description: 为指定用户分配角色（管理员功能）
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
 *             type: object
 *             required:
 *               - roleName
 *             properties:
 *               roleName:
 *                 type: string
 *                 enum: [user, vip, moderator, admin]
 *                 description: 角色名称
 *           example:
 *             roleName: "vip"
 *     responses:
 *       200:
 *         description: 角色分配成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: 用户不存在
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const assignUserRole = async (req, res) => {
  try {
    const adminUserId = req.user.id;
    const targetUserId = parseInt(req.params.id);
    const { roleName } = req.body;

    const result = await UserService.assignUserRole(adminUserId, targetUserId, roleName);
    
    res.json(result);
  } catch (error) {
    logger.error('分配用户角色失败:', error);
    if (error.message === '用户不存在' || error.message === '角色不存在') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || '分配用户角色失败'
      });
    }
  }
};

/**
 * @swagger
 * /api/users/{id}/roles:
 *   delete:
 *     summary: 移除用户角色
 *     description: 移除指定用户的角色（管理员功能）
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
 *             type: object
 *             required:
 *               - roleName
 *             properties:
 *               roleName:
 *                 type: string
 *                 enum: [user, vip, moderator, admin]
 *                 description: 要移除的角色名称
 *           example:
 *             roleName: "vip"
 *     responses:
 *       200:
 *         description: 角色移除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: 用户不存在或用户没有该角色
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const removeUserRole = async (req, res) => {
  try {
    const adminUserId = req.user.id;
    const targetUserId = parseInt(req.params.id);
    const { roleName } = req.body;

    const result = await UserService.removeUserRole(adminUserId, targetUserId, roleName);
    
    res.json(result);
  } catch (error) {
    logger.error('移除用户角色失败:', error);
    if (error.message === '用户不存在' || error.message === '角色不存在') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || '移除用户角色失败'
      });
    }
  }
};

/**
 * @swagger
 * /api/users/{id}/roles:
 *   get:
 *     summary: 获取用户角色列表
 *     description: 获取指定用户的所有角色（管理员功能）
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
 *     responses:
 *       200:
 *         description: 获取用户角色成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Role'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: 用户不存在
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getUserRoles = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const result = await UserService.getUserRoles(userId);
    
    res.json(result);
  } catch (error) {
    logger.error('获取用户角色失败:', error);
    if (error.message === '用户不存在') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || '获取用户角色失败'
      });
    }
  }
};

/**
 * @swagger
 * /api/users/{id}/permissions:
 *   get:
 *     summary: 获取用户权限列表
 *     description: 获取指定用户的所有权限（管理员功能）
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
 *     responses:
 *       200:
 *         description: 获取用户权限成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Permission'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: 用户不存在
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getUserPermissions = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const result = await UserService.getUserPermissions(userId);
    
    res.json(result);
  } catch (error) {
    logger.error('获取用户权限失败:', error);
    if (error.message === '用户不存在') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || '获取用户权限失败'
      });
    }
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

// 额外的验证规则
const validateCreateUser = [
  body('username').isLength({ min: 3, max: 50 }).withMessage('用户名长度必须在3-50个字符之间')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('用户名只能包含字母、数字和下划线'),
  body('email').isEmail().withMessage('请输入有效的邮箱地址').normalizeEmail(),
  body('password').isLength({ min: 8, max: 128 }).withMessage('密码长度必须在8-128个字符之间'),
  body('nickname').optional().isLength({ min: 1, max: 100 }).withMessage('昵称长度必须在1-100个字符之间'),
  body('roleName').optional().isIn(['user', 'vip', 'moderator', 'admin']).withMessage('无效的角色名称'),
  body('status').optional().isIn(['normal', 'banned', 'frozen']).withMessage('无效的用户状态')
];

const validateAssignRole = [
  body('roleName').isIn(['user', 'vip', 'moderator', 'admin']).withMessage('无效的角色名称')
];

module.exports = {
  updateProfile: [validateUpdateProfile, handleValidationErrors, updateProfile],
  changePassword: [validateChangePassword, handleValidationErrors, changePassword],
  getProfile,
  getUserList,
  getUserById,
  createUser: [validateCreateUser, handleValidationErrors, createUser],
  deleteUser,
  updateUserStatus: [validateUpdateUserStatus, handleValidationErrors, updateUserStatus],
  assignUserRole: [validateAssignRole, handleValidationErrors, assignUserRole],
  removeUserRole: [validateAssignRole, handleValidationErrors, removeUserRole],
  getUserRoles,
  getUserPermissions,
  getUserStats
};