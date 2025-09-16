/**
 * @fileoverview 角色权限管理控制器
 * @description 处理角色权限的分配、撤销和查询操作
 * @module rolePermissionController
 * @requires ../models/Role
 * @requires ../models/Permission
 * @requires ../utils/logger
 * @author AI Assistant
 * @version 1.0.0
 */

const Role = require('../models/Role');
const Permission = require('../models/Permission');
const { logger } = require('../utils/logger');
const { query } = require('../config/database');

/**
 * @swagger
 * /api/admin/roles:
 *   get:
 *     tags: [角色权限管理]
 *     summary: 获取所有角色列表
 *     description: 获取系统中所有角色及其基本信息
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 角色列表获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Role'
 *             example:
 *               success: true
 *               message: "角色列表获取成功"
 *               data:
 *                 - id: 1
 *                   name: "admin"
 *                   display_name: "管理员"
 *                   description: "系统管理员，具有最高权限"
 *                   is_active: true
 *                   created_at: "2025-09-01T00:00:00.000Z"
 *                 - id: 2
 *                   name: "user"
 *                   display_name: "普通用户"
 *                   description: "系统普通用户"
 *                   is_active: true
 *                   created_at: "2025-09-01T00:00:00.000Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.findAll();
    
    res.json({
      success: true,
      message: '角色列表获取成功',
      data: roles
    });
  } catch (error) {
    logger.error('获取角色列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取角色列表失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/permissions:
 *   get:
 *     tags: [角色权限管理]
 *     summary: 获取所有权限列表
 *     description: 获取系统中所有权限及其详细信息，支持按资源分组
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: grouped
 *         schema:
 *           type: boolean
 *           default: false
 *         description: 是否按资源分组返回
 *         example: true
 *     responses:
 *       200:
 *         description: 权限列表获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       oneOf:
 *                         - type: array
 *                           items:
 *                             $ref: '#/components/schemas/Permission'
 *                         - type: object
 *                           additionalProperties:
 *                             type: array
 *                             items:
 *                               $ref: '#/components/schemas/Permission'
 *             example:
 *               success: true
 *               message: "权限列表获取成功"
 *               data:
 *                 user:
 *                   - id: 1
 *                     name: "user.read"
 *                     display_name: "查看用户"
 *                     description: "查看用户信息"
 *                     resource: "user"
 *                     action: "read"
 *                     is_active: true
 *                 vip:
 *                   - id: 10
 *                     name: "vip.level.create"
 *                     display_name: "创建VIP等级"
 *                     description: "创建新的VIP等级配置"
 *                     resource: "vip_level"
 *                     action: "create"
 *                     is_active: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getAllPermissions = async (req, res) => {
  try {
    const { grouped = false } = req.query;
    const permissions = await Permission.findAll();
    
    let responseData = permissions;
    
    if (grouped === 'true' || grouped === true) {
      // 按资源分组
      responseData = permissions.reduce((groups, permission) => {
        const resource = permission.resource || 'general';
        if (!groups[resource]) {
          groups[resource] = [];
        }
        groups[resource].push(permission);
        return groups;
      }, {});
    }
    
    res.json({
      success: true,
      message: '权限列表获取成功',
      data: responseData
    });
  } catch (error) {
    logger.error('获取权限列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取权限列表失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/roles/{roleId}/permissions:
 *   get:
 *     tags: [角色权限管理]
 *     summary: 获取角色权限列表
 *     description: 获取指定角色的所有权限
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 角色ID
 *         example: 1
 *     responses:
 *       200:
 *         description: 角色权限获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         role:
 *                           $ref: '#/components/schemas/Role'
 *                         permissions:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Permission'
 *             example:
 *               success: true
 *               message: "角色权限获取成功"
 *               data:
 *                 role:
 *                   id: 1
 *                   name: "admin"
 *                   display_name: "管理员"
 *                 permissions:
 *                   - id: 1
 *                     name: "user.read"
 *                     display_name: "查看用户"
 *                     is_active: true
 *       404:
 *         description: 角色不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "角色不存在"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getRolePermissions = async (req, res) => {
  try {
    const { roleId } = req.params;
    
    const role = await Role.findById(parseInt(roleId));
    if (!role) {
      return res.status(404).json({
        success: false,
        message: '角色不存在'
      });
    }
    
    const permissions = await Role.getPermissions(parseInt(roleId));
    
    res.json({
      success: true,
      message: '角色权限获取成功',
      data: {
        role,
        permissions
      }
    });
  } catch (error) {
    logger.error('获取角色权限失败:', error);
    res.status(500).json({
      success: false,
      message: '获取角色权限失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/roles/{roleId}/permissions:
 *   post:
 *     tags: [角色权限管理]
 *     summary: 为角色添加权限
 *     description: 为指定角色分配新的权限（支持批量操作）
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 角色ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AssignPermissionsRequest'
 *           example:
 *             permissionIds: [1, 2, 3]
 *     responses:
 *       200:
 *         description: 权限分配成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         assignedCount:
 *                           type: integer
 *                           description: 成功分配的权限数量
 *                         skippedCount:
 *                           type: integer
 *                           description: 跳过的权限数量（已存在）
 *                         assignedPermissions:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Permission'
 *             example:
 *               success: true
 *               message: "成功为角色分配 2 个权限"
 *               data:
 *                 assignedCount: 2
 *                 skippedCount: 1
 *                 assignedPermissions:
 *                   - id: 1
 *                     name: "user.read"
 *                     display_name: "查看用户"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "权限ID列表不能为空"
 *       404:
 *         description: 角色不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "角色不存在"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const assignPermissions = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { permissionIds } = req.body;
    
    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '权限ID列表不能为空'
      });
    }
    
    const role = await Role.findById(parseInt(roleId));
    if (!role) {
      return res.status(404).json({
        success: false,
        message: '角色不存在'
      });
    }
    
    const result = await Role.assignPermissions(parseInt(roleId), permissionIds);
    
    res.json({
      success: true,
      message: `成功为角色分配 ${result.assignedCount} 个权限`,
      data: result
    });
  } catch (error) {
    logger.error('分配权限失败:', error);
    res.status(500).json({
      success: false,
      message: '分配权限失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/roles/{roleId}/permissions/revoke:
 *   post:
 *     tags: [角色权限管理]
 *     summary: 撤销角色权限
 *     description: 从指定角色中移除权限（支持批量操作）
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 角色ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RevokePermissionsRequest'
 *           example:
 *             permissionIds: [1, 2]
 *     responses:
 *       200:
 *         description: 权限撤销成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         revokedCount:
 *                           type: integer
 *                           description: 成功撤销的权限数量
 *                         revokedPermissions:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Permission'
 *             example:
 *               success: true
 *               message: "成功撤销角色 2 个权限"
 *               data:
 *                 revokedCount: 2
 *                 revokedPermissions:
 *                   - id: 1
 *                     name: "user.read"
 *                     display_name: "查看用户"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "权限ID列表不能为空"
 *       404:
 *         description: 角色不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "角色不存在"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const revokePermissions = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { permissionIds } = req.body;
    
    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '权限ID列表不能为空'
      });
    }
    
    const role = await Role.findById(parseInt(roleId));
    if (!role) {
      return res.status(404).json({
        success: false,
        message: '角色不存在'
      });
    }
    
    const result = await Role.revokePermissions(parseInt(roleId), permissionIds);
    
    res.json({
      success: true,
      message: `成功撤销角色 ${result.revokedCount} 个权限`,
      data: result
    });
  } catch (error) {
    logger.error('撤销权限失败:', error);
    res.status(500).json({
      success: false,
      message: '撤销权限失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/permissions/{permissionId}/toggle:
 *   patch:
 *     tags: [角色权限管理]
 *     summary: 启用或禁用权限
 *     description: 切换指定权限的启用状态，禁用的权限将不会生效
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: permissionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 权限ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TogglePermissionRequest'
 *           example:
 *             is_active: false
 *     responses:
 *       200:
 *         description: 权限状态更新成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Permission'
 *             example:
 *               success: true
 *               message: "权限已禁用"
 *               data:
 *                 id: 1
 *                 name: "user.read"
 *                 display_name: "查看用户"
 *                 description: "查看用户信息"
 *                 resource: "user"
 *                 action: "read"
 *                 is_active: false
 *                 updated_at: "2025-09-14T12:30:00.000Z"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "is_active字段必须是布尔值"
 *       404:
 *         description: 权限不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "权限不存在"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const togglePermission = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const { is_active } = req.body;
    
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'is_active字段必须是布尔值'
      });
    }
    
    const permission = await Permission.findById(parseInt(permissionId));
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: '权限不存在'
      });
    }
    
    const updatedPermission = await Permission.updateById(parseInt(permissionId), {
      is_active
    });
    
    const statusText = is_active ? '启用' : '禁用';
    
    res.json({
      success: true,
      message: `权限已${statusText}`,
      data: updatedPermission
    });
  } catch (error) {
    logger.error('切换权限状态失败:', error);
    res.status(500).json({
      success: false,
      message: '切换权限状态失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/roles:
 *   post:
 *     tags: [角色权限管理]
 *     summary: 创建新角色
 *     description: 创建一个新的用户角色，需要管理员权限
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - display_name
 *             properties:
 *               name:
 *                 type: string
 *                 pattern: '^[a-zA-Z0-9_]+$'
 *                 minLength: 2
 *                 maxLength: 50
 *                 description: 角色唯一标识符（英文字母、数字、下划线）
 *                 example: "content_editor"
 *               display_name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: 角色显示名称
 *                 example: "内容编辑员"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: 角色描述信息
 *                 example: "负责内容的创建、编辑和发布"
 *           example:
 *             name: "content_editor"
 *             display_name: "内容编辑员"
 *             description: "负责内容的创建、编辑和发布"
 *     responses:
 *       201:
 *         description: 角色创建成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Role'
 *             example:
 *               success: true
 *               message: "角色创建成功"
 *               data:
 *                 id: 5
 *                 name: "content_editor"
 *                 display_name: "内容编辑员"
 *                 description: "负责内容的创建、编辑和发布"
 *                 is_active: true
 *                 created_at: "2025-09-16T12:00:00.000Z"
 *                 updated_at: "2025-09-16T12:00:00.000Z"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               validation_error:
 *                 summary: 验证错误
 *                 value:
 *                   success: false
 *                   message: "输入验证失败"
 *                   errors:
 *                     - field: "name"
 *                       message: "角色标识符格式不正确"
 *               duplicate_error:
 *                 summary: 角色已存在
 *                 value:
 *                   success: false
 *                   message: "角色名称已存在"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const createRole = async (req, res) => {
  try {
    const { name, display_name, description } = req.body;

    // 验证必需字段
    if (!name || !display_name) {
      return res.status(400).json({
        success: false,
        message: '角色名称和显示名称为必填项'
      });
    }

    // 验证角色名称格式
    const namePattern = /^[a-zA-Z0-9_]+$/;
    if (!namePattern.test(name)) {
      return res.status(400).json({
        success: false,
        message: '角色标识符只能包含字母、数字和下划线'
      });
    }

    // 检查角色是否已存在
    const existingRole = await Role.findByName(name);
    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: '角色名称已存在'
      });
    }

    // 创建角色
    const newRole = await Role.create({
      name: name.toLowerCase(),
      display_name,
      description: description || ''
    });

    logger.info(`管理员 ${req.user.email} 创建了新角色: ${name}`);

    res.status(201).json({
      success: true,
      message: '角色创建成功',
      data: newRole
    });
  } catch (error) {
    logger.error('创建角色失败:', error);
    res.status(500).json({
      success: false,
      message: '创建角色失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/roles/delete:
 *   post:
 *     tags: [角色权限管理]
 *     summary: 删除角色
 *     description: 删除指定的用户角色，会同时清理相关的权限关联和用户关联，需要管理员权限
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roleId
 *             properties:
 *               roleId:
 *                 type: integer
 *                 minimum: 1
 *                 description: 要删除的角色ID
 *                 example: 5
 *               force:
 *                 type: boolean
 *                 default: false
 *                 description: 是否强制删除（即使有用户使用该角色）
 *                 example: false
 *           example:
 *             roleId: 5
 *             force: false
 *     responses:
 *       200:
 *         description: 角色删除成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         roleId:
 *                           type: integer
 *                           description: 被删除的角色ID
 *                         roleName:
 *                           type: string
 *                           description: 被删除的角色名称
 *                         affectedUsers:
 *                           type: integer
 *                           description: 受影响的用户数量
 *                         affectedPermissions:
 *                           type: integer
 *                           description: 清理的权限关联数量
 *             example:
 *               success: true
 *               message: "角色删除成功"
 *               data:
 *                 roleId: 5
 *                 roleName: "content_editor"
 *                 affectedUsers: 3
 *                 affectedPermissions: 8
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missing_role_id:
 *                 summary: 缺少角色ID
 *                 value:
 *                   success: false
 *                   message: "角色ID为必填项"
 *               protected_role:
 *                 summary: 系统角色不可删除
 *                 value:
 *                   success: false
 *                   message: "系统内置角色不能删除"
 *               role_in_use:
 *                 summary: 角色正在使用中
 *                 value:
 *                   success: false
 *                   message: "该角色正在被用户使用，无法删除"
 *       404:
 *         description: 角色不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "角色不存在"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const deleteRole = async (req, res) => {
  try {
    const { roleId, force = false } = req.body;

    // 验证必需字段
    if (!roleId) {
      return res.status(400).json({
        success: false,
        message: '角色ID为必填项'
      });
    }

    // 检查角色是否存在
    const role = await Role.findById(parseInt(roleId));
    if (!role) {
      return res.status(404).json({
        success: false,
        message: '角色不存在'
      });
    }

    // 检查是否为系统内置角色（不能删除）
    const protectedRoles = ['admin', 'user', 'vip', 'moderator'];
    if (protectedRoles.includes(role.name)) {
      return res.status(400).json({
        success: false,
        message: '系统内置角色不能删除'
      });
    }

    // 检查是否有用户使用该角色
    const userCountResult = await query(
      'SELECT COUNT(*) as user_count FROM user_roles WHERE role_id = $1',
      [roleId]
    );
    const userCount = parseInt(userCountResult.rows[0].user_count);

    if (userCount > 0 && !force) {
      return res.status(400).json({
        success: false,
        message: `该角色正在被 ${userCount} 个用户使用，无法删除。如需强制删除，请设置 force: true`
      });
    }

    // 获取权限关联数量
    const permissionCountResult = await query(
      'SELECT COUNT(*) as permission_count FROM role_permissions WHERE role_id = $1',
      [roleId]
    );
    const permissionCount = parseInt(permissionCountResult.rows[0].permission_count);

    // 执行删除
    const deleteSuccess = await Role.deleteById(parseInt(roleId));

    if (!deleteSuccess) {
      return res.status(500).json({
        success: false,
        message: '角色删除失败'
      });
    }

    logger.info(`管理员 ${req.user.email} 删除了角色: ${role.name} (ID: ${roleId})`);

    res.json({
      success: true,
      message: '角色删除成功',
      data: {
        roleId: parseInt(roleId),
        roleName: role.name,
        affectedUsers: userCount,
        affectedPermissions: permissionCount
      }
    });
  } catch (error) {
    logger.error('删除角色失败:', error);
    res.status(500).json({
      success: false,
      message: '删除角色失败'
    });
  }
};

module.exports = {
  getAllRoles,
  getAllPermissions,
  getRolePermissions,
  assignPermissions,
  revokePermissions,
  togglePermission,
  createRole,
  deleteRole
};