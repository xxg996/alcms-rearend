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
 *         vip_info:
 *           $ref: '#/components/schemas/UserVipInfo'
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
 *                     $ref: '#/components/schemas/UserWithVipInfo'
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
 *
 *     UserVipInfo:
 *       type: object
 *       properties:
 *         is_vip:
 *           type: boolean
 *           description: 是否为VIP用户
 *           example: true
 *         vip_level:
 *           type: integer
 *           description: VIP等级
 *           example: 1
 *         vip_level_name:
 *           type: string
 *           nullable: true
 *           description: VIP等级名称
 *           example: "vip1"
 *         vip_level_display_name:
 *           type: string
 *           nullable: true
 *           description: VIP等级显示名称
 *           example: "普通VIP"
 *         vip_expire_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: VIP过期时间
 *           example: "2025-12-31T23:59:59.000Z"
 *         vip_activated_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: VIP激活时间
 *           example: "2025-09-12T08:00:00.000Z"
 *         is_expired:
 *           type: boolean
 *           description: VIP是否已过期
 *           example: false
 *         is_permanent:
 *           type: boolean
 *           description: 是否为永久VIP
 *           example: false
 *
 *     UserWithVipInfo:
 *       allOf:
 *         - $ref: '#/components/schemas/User'
 *         - type: object
 *           properties:
 *             vip_info:
 *               $ref: '#/components/schemas/UserVipInfo'
 *
 *     EnhancedUserStats:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           description: 总用户数
 *           example: 1000
 *         active:
 *           type: integer
 *           description: 正常用户数
 *           example: 950
 *         banned:
 *           type: integer
 *           description: 被封禁用户数
 *           example: 20
 *         frozen:
 *           type: integer
 *           description: 被冻结用户数
 *           example: 30
 *         byRole:
 *           type: object
 *           description: 按角色分布的用户统计
 *           additionalProperties:
 *             type: object
 *             properties:
 *               count:
 *                 type: integer
 *               display_name:
 *                 type: string
 *         vip:
 *           $ref: '#/components/schemas/VipStats'
 *         newUsers:
 *           type: object
 *           properties:
 *             today:
 *               type: integer
 *               description: 今日新增用户数
 *             thisWeek:
 *               type: integer
 *               description: 本周新增用户数
 *             thisMonth:
 *               type: integer
 *               description: 本月新增用户数
 *             thisYear:
 *               type: integer
 *               description: 今年新增用户数
 *         activeUsers:
 *           type: object
 *           properties:
 *             last1Day:
 *               type: integer
 *               description: 近一天活跃用户数
 *             last7Days:
 *               type: integer
 *               description: 近七天活跃用户数
 *             last30Days:
 *               type: integer
 *               description: 近三十天活跃用户数
 *
 *     VipStats:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           description: VIP用户总数
 *           example: 150
 *         active:
 *           type: integer
 *           description: 有效VIP用户数
 *           example: 120
 *         expired:
 *           type: integer
 *           description: 过期VIP用户数
 *           example: 25
 *         permanent:
 *           type: integer
 *           description: 永久VIP用户数
 *           example: 30
 *         non_vip:
 *           type: integer
 *           description: 非VIP用户数
 *           example: 850
 *         byLevel:
 *           type: object
 *           description: 按VIP等级分布的统计
 *           additionalProperties:
 *             type: object
 *             properties:
 *               count:
 *                 type: integer
 *               level_name:
 *                 type: string
 *               level_display_name:
 *                 type: string
 */