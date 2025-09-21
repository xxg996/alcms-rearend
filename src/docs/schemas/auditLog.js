/**
 * @swagger
 * components:
 *   schemas:
 *     AuditLoginLog:
 *       type: object
 *       description: 登录日志记录
 *       properties:
 *         id:
 *           type: integer
 *           example: 101
 *         user_id:
 *           type: integer
 *           nullable: true
 *           description: 关联用户ID（匿名登录失败时可能为空）
 *           example: 12
 *         identifier:
 *           type: string
 *           description: 登录使用的账号标识
 *           example: "user@example.com"
 *         status:
 *           type: string
 *           enum: [success, failure]
 *           example: "success"
 *         failure_reason:
 *           type: string
 *           nullable: true
 *           description: 登录失败原因
 *           example: "密码错误"
 *         ip_address:
 *           type: string
 *           nullable: true
 *           example: "192.168.1.10"
 *         user_agent:
 *           type: string
 *           nullable: true
 *           example: "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_1)"
 *         login_at:
 *           type: string
 *           format: date-time
 *           example: "2025-02-18T09:30:25.421Z"
 * 
 *     AuditLoginSummary:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           description: 日志总数
 *           example: 125
 *         byStatus:
 *           type: object
 *           additionalProperties:
 *             type: integer
 *           description: 各状态日志数量统计
 *           example:
 *             success: 98
 *             failure: 27
 *         uniqueUsers:
 *           type: integer
 *           description: 涉及的唯一用户数量
 *           example: 56
 *         uniqueIps:
 *           type: integer
 *           description: 唯一IP数量
 *           example: 34
 *         latestLoginAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: 最新一条日志时间
 *           example: "2025-02-18T10:12:45.000Z"
 * 
 *     PaginatedAuditLoginResponse:
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
 *                     $ref: '#/components/schemas/AuditLoginLog'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *                 summary:
 *                   $ref: '#/components/schemas/AuditLoginSummary'
 * 
 *     AuditSystemLog:
 *       type: object
 *       description: 系统操作日志记录
 *       properties:
 *         id:
 *           type: integer
 *           example: 205
 *         operator_id:
 *           type: integer
 *           nullable: true
 *           description: 操作人ID
 *           example: 1
 *         target_type:
 *           type: string
 *           description: 操作对象类型
 *           example: "resource"
 *         target_id:
 *           type: string
 *           nullable: true
 *           description: 操作对象标识
 *           example: "88"
 *         action:
 *           type: string
 *           description: 操作行为编码
 *           example: "create"
 *         summary:
 *           type: string
 *           nullable: true
 *           description: 操作摘要
 *           example: "创建资源 React 入门教程"
 *         detail:
 *           type: object
 *           nullable: true
 *           description: 结构化操作详情
 *           example:
 *             status: "normal"
 *             before:
 *               status: "draft"
 *         ip_address:
 *           type: string
 *           nullable: true
 *           example: "192.168.1.11"
 *         user_agent:
 *           type: string
 *           nullable: true
 *           example: "Mozilla/5.0"
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2025-02-18T11:25:00.000Z"
 * 
 *     AuditSystemSummary:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           example: 240
 *         topActions:
 *           type: array
 *           description: 操作行为排名（数量倒序，最多10条）
 *           items:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 example: "update"
 *               count:
 *                 type: integer
 *                 example: 85
 *         uniqueOperators:
 *           type: integer
 *           description: 唯一操作人数量
 *           example: 12
 *         targetTypeCount:
 *           type: integer
 *           description: 涉及的对象类型数量
 *           example: 6
 *         latestCreatedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2025-02-18T12:20:00.000Z"
 * 
 *     PaginatedAuditSystemResponse:
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
 *                     $ref: '#/components/schemas/AuditSystemLog'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *                 summary:
 *                   $ref: '#/components/schemas/AuditSystemSummary'
 * 
 *     AuditPointsLog:
 *       type: object
 *       description: 积分审计日志记录
 *       properties:
 *         id:
 *           type: integer
 *           example: 330
 *         user_id:
 *           type: integer
 *           description: 积分归属用户ID
 *           example: 22
 *         operator_id:
 *           type: integer
 *           nullable: true
 *           description: 操作者用户ID
 *           example: 1
 *         change_amount:
 *           type: integer
 *           description: 积分变动值（正数为增加，负数为扣减）
 *           example: 50
 *         balance_before:
 *           type: integer
 *           nullable: true
 *           description: 变动前积分余额
 *           example: 120
 *         balance_after:
 *           type: integer
 *           nullable: true
 *           description: 变动后积分余额
 *           example: 170
 *         source:
 *           type: string
 *           description: 积分来源标识
 *           example: "vip_purchase"
 *         description:
 *           type: string
 *           nullable: true
 *           description: 积分变动说明
 *           example: "VIP开通奖励"
 *         related_id:
 *           type: string
 *           nullable: true
 *           description: 关联业务ID
 *           example: "order_1024"
 *         related_type:
 *           type: string
 *           nullable: true
 *           description: 关联业务类型
 *           example: "vip_order"
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2025-02-18T13:45:36.000Z"
 * 
 *     AuditPointsSummary:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           example: 540
 *         totalIncrease:
 *           type: integer
 *           description: 积分累计增加总额
 *           example: 4200
 *         totalDecrease:
 *           type: integer
 *           description: 积分累计扣减总额
 *           example: 900
 *         uniqueUsers:
 *           type: integer
 *           description: 涉及用户数量
 *           example: 68
 *         latestCreatedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2025-02-18T13:40:00.000Z"
 *         topSources:
 *           type: array
 *           description: 高频积分来源列表（最多10条）
 *           items:
 *             type: object
 *             properties:
 *               source:
 *                 type: string
 *                 example: "checkin"
 *               count:
 *                 type: integer
 *                 example: 220
 *               total_change:
 *                 type: integer
 *                 example: 2200
 * 
 *     PaginatedAuditPointsResponse:
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
 *                     $ref: '#/components/schemas/AuditPointsLog'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *                 summary:
 *                   $ref: '#/components/schemas/AuditPointsSummary'
 */
