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
 * /api/admin/users:
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
 *           enum: [normal, frozen, banned]
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
 * /api/admin/users/{id}/status:
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
 * /api/admin/users/stats:
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
 * /api/admin/users/{id}:
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
 * /api/admin/users:
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
 * /api/admin/users/{id}:
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

/**
 * @swagger
 * /api/admin/users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: 更新用户资料
 *     description: 管理员更新指定用户的资料信息（仅限管理员）
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
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *                 description: 用户名
 *                 example: "newusername"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 邮箱地址
 *                 example: "newemail@example.com"
 *               nickname:
 *                 type: string
 *                 maxLength: 100
 *                 description: 昵称
 *                 example: "新昵称"
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *                 description: 个人简介
 *                 example: "这是更新的个人简介"
 *               avatar_url:
 *                 type: string
 *                 format: uri
 *                 description: 头像URL
 *                 example: "https://example.com/avatar.jpg"
 *           example:
 *             username: "updateduser"
 *             email: "updated@example.com"
 *             nickname: "更新的昵称"
 *             bio: "管理员更新的个人简介"
 *     responses:
 *       200:
 *         description: 用户资料更新成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *             example:
 *               success: true
 *               message: "用户资料更新成功"
 *               data:
 *                 id: 123
 *                 username: "updateduser"
 *                 email: "updated@example.com"
 *                 nickname: "更新的昵称"
 *                 bio: "管理员更新的个人简介"
 *                 status: "normal"
 *                 updated_at: "2025-09-14T12:30:00.000Z"
 *       400:
 *         description: 请求参数验证失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
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
 *             example:
 *               success: false
 *               message: "用户不存在"
 *       409:
 *         description: 数据冲突（用户名或邮箱已存在）
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               username_exists:
 *                 value:
 *                   success: false
 *                   message: "用户名已存在"
 *               email_exists:
 *                 value:
 *                   success: false
 *                   message: "邮箱已被使用"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const updateUserProfile = async (req, res) => {
  try {
    const adminUserId = req.user.id;
    const targetUserId = parseInt(req.params.id);
    const updateData = req.body;

    const result = await UserService.updateUserProfile(adminUserId, targetUserId, updateData);
    
    res.json(result);
  } catch (error) {
    logger.error('更新用户资料失败:', error);
    
    if (error.message === '用户不存在') {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    if (error.message.includes('用户名已存在')) {
      return res.status(409).json({
        success: false,
        message: '用户名已存在'
      });
    }

    if (error.message.includes('邮箱已被使用')) {
      return res.status(409).json({
        success: false,
        message: '邮箱已被使用'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '更新用户资料失败'
    });
  }
};

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
 * /api/admin/users/{id}/roles:
 *   put:
 *     summary: 更改用户角色
 *     description: 批量更改指定用户的角色，支持分配新角色和移除现有角色（管理员功能）
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
 *             properties:
 *               addRoles:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [user, vip, moderator, admin]
 *                 description: 要添加的角色列表
 *                 example: ["vip", "moderator"]
 *               removeRoles:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [user, vip, moderator, admin]
 *                 description: 要移除的角色列表
 *                 example: ["user"]
 *           examples:
 *             addRoles:
 *               summary: 添加角色
 *               value:
 *                 addRoles: ["vip", "moderator"]
 *             removeRoles:
 *               summary: 移除角色
 *               value:
 *                 removeRoles: ["user"]
 *             mixedOperation:
 *               summary: 同时添加和移除角色
 *               value:
 *                 addRoles: ["vip"]
 *                 removeRoles: ["user"]
 *     responses:
 *       200:
 *         description: 角色更改成功
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
 *                         addedRoles:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: 成功添加的角色
 *                         removedRoles:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: 成功移除的角色
 *                         currentRoles:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: 当前用户的所有角色
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
const updateUserRoles = async (req, res) => {
  try {
    const adminUserId = req.user.id;
    const targetUserId = parseInt(req.params.id);
    const { addRoles = [], removeRoles = [] } = req.body;

    // 验证至少有一个操作
    if (addRoles.length === 0 && removeRoles.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请指定要添加或移除的角色'
      });
    }

    const result = await UserService.updateUserRoles(adminUserId, targetUserId, addRoles, removeRoles);
    
    res.json(result);
  } catch (error) {
    logger.error('更改用户角色失败:', error);
    if (error.message === '用户不存在' || error.message.includes('角色不存在')) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || '更改用户角色失败'
      });
    }
  }
};


/**
 * @swagger
 * /api/admin/users/{id}/roles:
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
 * /api/admin/users/{id}/permissions:
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
  body('status').isIn(['normal', 'frozen', 'banned']).withMessage('无效的状态值')
];

/**
 * @swagger
 * /api/admin/users/batch/status:
 *   patch:
 *     summary: 批量更改用户状态
 *     description: 批量更改多个用户的状态（管理员功能）
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *               - status
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: 要更新的用户ID列表
 *                 example: [2, 3, 4]
 *               status:
 *                 type: string
 *                 enum: [normal, frozen, banned]
 *                 description: 新的用户状态
 *                 example: "banned"
 *           example:
 *             userIds: [2, 3, 4]
 *             status: "banned"
 *     responses:
 *       200:
 *         description: 批量更新用户状态成功
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
 *                         updatedUsers:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/User'
 *                         affectedCount:
 *                           type: integer
 *                           description: 实际更新的用户数量
 *                         skippedCount:
 *                           type: integer
 *                           description: 跳过的用户数量（如管理员自己）
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const batchUpdateUserStatus = async (req, res) => {
  try {
    const adminUserId = req.user.id;
    const { userIds, status } = req.body;

    const result = await UserService.batchUpdateUserStatus(adminUserId, userIds, status);
    
    res.json(result);
  } catch (error) {
    logger.error('批量更新用户状态失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '批量更新用户状态失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/users/batch/delete:
 *   post:
 *     summary: 批量删除用户
 *     description: 批量删除多个用户账号（管理员功能，危险操作）
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: 要删除的用户ID列表
 *                 example: [2, 3, 4]
 *           example:
 *             userIds: [2, 3, 4]
 *     responses:
 *       200:
 *         description: 批量删除用户成功
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
 *                         deletedUsers:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/User'
 *                         deletedCount:
 *                           type: integer
 *                           description: 实际删除的用户数量
 *                         skippedCount:
 *                           type: integer
 *                           description: 跳过的用户数量（如管理员自己）
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const batchDeleteUsers = async (req, res) => {
  try {
    const adminUserId = req.user.id;
    const { userIds } = req.body;

    const result = await UserService.batchDeleteUsers(adminUserId, userIds);
    
    res.json(result);
  } catch (error) {
    logger.error('批量删除用户失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '批量删除用户失败'
    });
  }
};

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

const validateUpdateRoles = [
  body('addRoles').optional().isArray().withMessage('addRoles必须是数组'),
  body('addRoles.*').optional().custom(async (roleName) => {
    // 动态验证角色名称是否存在于数据库中
    const { query } = require('../config/database');
    const result = await query('SELECT id FROM roles WHERE name = $1', [roleName]);
    if (result.rows.length === 0) {
      throw new Error(`角色 "${roleName}" 不存在`);
    }
    return true;
  }),
  body('removeRoles').optional().isArray().withMessage('removeRoles必须是数组'),
  body('removeRoles.*').optional().custom(async (roleName) => {
    // 动态验证角色名称是否存在于数据库中
    const { query } = require('../config/database');
    const result = await query('SELECT id FROM roles WHERE name = $1', [roleName]);
    if (result.rows.length === 0) {
      throw new Error(`角色 "${roleName}" 不存在`);
    }
    return true;
  }),
  body().custom((value) => {
    const { addRoles = [], removeRoles = [] } = value;
    if (addRoles.length === 0 && removeRoles.length === 0) {
      throw new Error('请指定要添加或移除的角色');
    }
    return true;
  })
];

const validateBatchUpdateStatus = [
  body('userIds').isArray({ min: 1 }).withMessage('用户ID列表不能为空'),
  body('userIds.*').isInt({ min: 1 }).withMessage('用户ID必须是正整数'),
  body('status').isIn(['normal', 'frozen', 'banned']).withMessage('无效的状态值')
];

const validateBatchDelete = [
  body('userIds').isArray({ min: 1 }).withMessage('用户ID列表不能为空'),
  body('userIds.*').isInt({ min: 1 }).withMessage('用户ID必须是正整数')
];

const validateUpdateUserProfile = [
  body('username').optional().isLength({ min: 3, max: 50 }).withMessage('用户名长度必须在3-50个字符之间')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('用户名只能包含字母、数字和下划线'),
  body('email').optional().isEmail().withMessage('请输入有效的邮箱地址').normalizeEmail(),
  body('nickname').optional().isLength({ min: 1, max: 100 }).withMessage('昵称长度必须在1-100个字符之间'),
  body('avatar_url').optional().isLength({ max: 500 }).withMessage('头像URL长度不能超过500个字符'),
  body('bio').optional().isLength({ max: 500 }).withMessage('个人简介长度不能超过500个字符')
];

/**
 * 分配用户角色
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
    if (error.message === '用户不存在' || error.message.includes('角色不存在')) {
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
 * 撤销用户角色
 */
const revokeUserRole = async (req, res) => {
  try {
    const adminUserId = req.user.id;
    const targetUserId = parseInt(req.params.id);
    const roleId = parseInt(req.params.roleId);

    const result = await UserService.revokeUserRole(adminUserId, targetUserId, roleId);

    res.json(result);
  } catch (error) {
    logger.error('撤销用户角色失败:', error);
    if (error.message === '用户不存在' || error.message.includes('角色不存在')) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || '撤销用户角色失败'
      });
    }
  }
};

/**
 * 冻结用户
 */
const freezeUser = async (req, res) => {
  try {
    const adminUserId = req.user.id;
    const targetUserId = parseInt(req.params.id);
    const { reason } = req.body;

    const result = await UserService.freezeUser(adminUserId, targetUserId, reason);

    res.json(result);
  } catch (error) {
    logger.error('冻结用户失败:', error);
    if (error.message === '用户不存在') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || '冻结用户失败'
      });
    }
  }
};

/**
 * 解冻用户
 */
const unfreezeUser = async (req, res) => {
  try {
    const adminUserId = req.user.id;
    const targetUserId = parseInt(req.params.id);

    const result = await UserService.unfreezeUser(adminUserId, targetUserId);

    res.json(result);
  } catch (error) {
    logger.error('解冻用户失败:', error);
    if (error.message === '用户不存在') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || '解冻用户失败'
      });
    }
  }
};

/**
 * 重置用户密码
 */
const resetUserPassword = async (req, res) => {
  try {
    const adminUserId = req.user.id;
    const targetUserId = parseInt(req.params.id);

    const result = await UserService.resetUserPassword(adminUserId, targetUserId);

    res.json(result);
  } catch (error) {
    logger.error('重置用户密码失败:', error);
    if (error.message === '用户不存在') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || '重置用户密码失败'
      });
    }
  }
};

module.exports = {
  updateProfile: [validateUpdateProfile, handleValidationErrors, updateProfile],
  changePassword: [validateChangePassword, handleValidationErrors, changePassword],
  getProfile,
  getUserList,
  getUserById,
  createUser: [validateCreateUser, handleValidationErrors, createUser],
  updateUserProfile: [validateUpdateUserProfile, handleValidationErrors, updateUserProfile],
  deleteUser,
  updateUserStatus: [validateUpdateUserStatus, handleValidationErrors, updateUserStatus],
  updateUserRoles: [validateUpdateRoles, handleValidationErrors, updateUserRoles],
  getUserRoles,
  getUserPermissions,
  getUserStats,
  batchUpdateUserStatus: [validateBatchUpdateStatus, handleValidationErrors, batchUpdateUserStatus],
  batchDeleteUsers: [validateBatchDelete, handleValidationErrors, batchDeleteUsers],
  assignUserRole,
  revokeUserRole,
  freezeUser,
  unfreezeUser,
  resetUserPassword
};