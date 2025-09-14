/**
 * @swagger
 * components:
 *   schemas:
 *     Role:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: 角色ID
 *           example: 1
 *         name:
 *           type: string
 *           description: 角色名称（英文标识）
 *           example: "admin"
 *         display_name:
 *           type: string
 *           description: 角色显示名称
 *           example: "管理员"
 *         description:
 *           type: string
 *           nullable: true
 *           description: 角色描述
 *           example: "系统管理员，具有最高权限"
 *         is_active:
 *           type: boolean
 *           description: 是否启用
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2025-09-01T00:00:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *           example: "2025-09-01T00:00:00.000Z"
 * 
 *     Permission:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: 权限ID
 *           example: 1
 *         name:
 *           type: string
 *           description: 权限名称（英文标识）
 *           example: "user.read"
 *         display_name:
 *           type: string
 *           description: 权限显示名称
 *           example: "查看用户"
 *         description:
 *           type: string
 *           nullable: true
 *           description: 权限描述
 *           example: "查看用户信息和列表"
 *         resource:
 *           type: string
 *           nullable: true
 *           description: 权限所属资源
 *           example: "user"
 *         action:
 *           type: string
 *           nullable: true
 *           description: 权限操作类型
 *           example: "read"
 *         is_active:
 *           type: boolean
 *           description: 是否启用
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2025-09-01T00:00:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *           example: "2025-09-01T00:00:00.000Z"
 * 
 *     AssignPermissionsRequest:
 *       type: object
 *       required:
 *         - permissionIds
 *       properties:
 *         permissionIds:
 *           type: array
 *           items:
 *             type: integer
 *           minItems: 1
 *           description: 要分配的权限ID数组
 *           example: [1, 2, 3]
 * 
 *     RevokePermissionsRequest:
 *       type: object
 *       required:
 *         - permissionIds
 *       properties:
 *         permissionIds:
 *           type: array
 *           items:
 *             type: integer
 *           minItems: 1
 *           description: 要撤销的权限ID数组
 *           example: [1, 2]
 * 
 *     TogglePermissionRequest:
 *       type: object
 *       required:
 *         - is_active
 *       properties:
 *         is_active:
 *           type: boolean
 *           description: 权限启用状态
 *           example: false
 * 
 *     RoleWithPermissions:
 *       type: object
 *       properties:
 *         role:
 *           $ref: '#/components/schemas/Role'
 *         permissions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Permission'
 *           description: 角色拥有的权限列表
 * 
 *     PermissionAssignResult:
 *       type: object
 *       properties:
 *         assignedCount:
 *           type: integer
 *           description: 成功分配的权限数量
 *           example: 2
 *         skippedCount:
 *           type: integer
 *           description: 跳过的权限数量（已存在）
 *           example: 1
 *         assignedPermissions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Permission'
 *           description: 新分配的权限详情
 * 
 *     PermissionRevokeResult:
 *       type: object
 *       properties:
 *         revokedCount:
 *           type: integer
 *           description: 成功撤销的权限数量
 *           example: 2
 *         revokedPermissions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Permission'
 *           description: 被撤销的权限详情
 */