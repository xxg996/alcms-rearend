/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - id
 *         - username
 *         - email
 *         - nickname
 *         - role
 *         - status
 *         - created_at
 *         - updated_at
 *       properties:
 *         id:
 *           type: integer
 *           description: 用户ID
 *           example: 1
 *         username:
 *           type: string
 *           description: 用户名
 *           example: "admin"
 *         email:
 *           type: string
 *           format: email
 *           description: 邮箱
 *           example: "admin@example.com"
 *         nickname:
 *           type: string
 *           description: 昵称
 *           example: "管理员"
 *         avatar_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: 头像URL
 *           example: "https://example.com/avatar.jpg"
 *         bio:
 *           type: string
 *           nullable: true
 *           description: 个人简介
 *           example: "这是一个简介"
 *         role:
 *           type: string
 *           enum: [user, vip, moderator, admin]
 *           description: 用户角色
 *           example: "admin"
 *         status:
 *           type: string
 *           enum: [normal, frozen, banned]
 *           description: 用户状态
 *           example: "normal"
 *         last_login_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: 最后登录时间
 *           example: "2025-09-12T12:00:00.000Z"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2025-09-11T08:00:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *           example: "2025-09-12T12:00:00.000Z"
 * 
 *     UserProfile:
 *       type: object
 *       properties:
 *         nickname:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: 昵称
 *           example: "新昵称"
 *         avatar_url:
 *           type: string
 *           format: uri
 *           maxLength: 500
 *           description: 头像URL
 *           example: "https://example.com/new-avatar.jpg"
 *         bio:
 *           type: string
 *           maxLength: 500
 *           description: 个人简介
 *           example: "新的个人简介"
 * 
 *     ChangePasswordRequest:
 *       type: object
 *       required:
 *         - currentPassword
 *         - newPassword
 *       properties:
 *         currentPassword:
 *           type: string
 *           description: 当前密码
 *           example: "oldPassword123"
 *         newPassword:
 *           type: string
 *           minLength: 8
 *           pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)'
 *           description: 新密码（至少8位，包含大小写字母和数字）
 *           example: "newPassword123"
 * 
 *     UserListResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/PaginatedResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 * 
 *     UpdateUserStatusRequest:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [normal, frozen, banned]
 *           description: 用户状态
 *           example: "banned"
 * 
 *     UserStats:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           description: 总用户数
 *           example: 1000
 *         active:
 *           type: integer
 *           description: 活跃用户数
 *           example: 950
 *         inactive:
 *           type: integer
 *           description: 未激活用户数
 *           example: 30
 *         banned:
 *           type: integer
 *           description: 被封禁用户数
 *           example: 20
 *         byRole:
 *           type: object
 *           properties:
 *             user:
 *               type: integer
 *               example: 800
 *             vip:
 *               type: integer
 *               example: 150
 *             moderator:
 *               type: integer
 *               example: 45
 *             admin:
 *               type: integer
 *               example: 5
 *         newUsersToday:
 *           type: integer
 *           description: 今日新增用户数
 *           example: 25
 *         newUsersThisWeek:
 *           type: integer
 *           description: 本周新增用户数
 *           example: 180
 *         newUsersThisMonth:
 *           type: integer
 *           description: 本月新增用户数
 *           example: 720
 */