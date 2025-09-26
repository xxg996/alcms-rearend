/**
 * @swagger
 * components:
 *   schemas:
 *     VIPLevel:
 *       type: object
 *       required:
 *         - level
 *         - name
 *         - display_name
 *         - price
 *         - created_at
 *         - updated_at
 *       properties:
 *         level:
 *           type: integer
 *           description: VIP等级数值
 *           example: 1
 *         name:
 *           type: string
 *           description: VIP等级名称（用于系统标识）
 *           example: "vip1"
 *         display_name:
 *           type: string
 *           description: VIP等级显示名称
 *           example: "VIP会员"
 *         description:
 *           type: string
 *           nullable: true
 *           description: VIP等级描述
 *           example: "享受基础VIP权益"
 *         benefits:
 *           type: object
 *           description: VIP权益配置
 *           additionalProperties: true
 *           example:
 *             download_limit: 100
 *             ad_free: true
 *             priority_support: false
 *         price:
 *           type: number
 *           format: decimal
 *           description: VIP价格（月价格）
 *           example: 19.99
 *         quarterly_price:
 *           type: number
 *           format: decimal
 *           nullable: true
 *           description: 季度价格（3个月）
 *           example: 49.99
 *         yearly_price:
 *           type: number
 *           format: decimal
 *           nullable: true
 *           description: 年度价格（12个月）
 *           example: 179.99
 *         points_discount_rate:
 *           type: integer
 *           nullable: true
 *           minimum: 1
 *           maximum: 10
 *           description: 积分折扣率（1-10，如8表示8折）
 *           example: 8
 *         daily_download_limit:
 *           type: integer
 *           description: 每日下载次数限制
 *           example: 100
 *         is_active:
 *           type: boolean
 *           description: 是否启用该等级
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2025-09-11T08:00:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *           example: "2025-09-12T10:00:00.000Z"
 * 
 *     CreateVIPLevelRequest:
 *       type: object
 *       required:
 *         - level
 *         - name
 *         - display_name
 *       properties:
 *         level:
 *           type: integer
 *           minimum: 0
 *           description: VIP等级数值
 *           example: 2
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *           description: VIP等级名称
 *           example: "vip2"
 *         display_name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: VIP等级显示名称
 *           example: "高级VIP"
 *         description:
 *           type: string
 *           maxLength: 500
 *           description: VIP等级描述
 *           example: "享受高级VIP权益，包括更多下载次数和优先客服"
 *         benefits:
 *           type: object
 *           description: VIP权益配置
 *           additionalProperties: true
 *           example:
 *             download_limit: 500
 *             ad_free: true
 *             priority_support: true
 *             exclusive_content: true
 *         price:
 *           type: number
 *           format: decimal
 *           minimum: 0
 *           description: VIP价格（月价格）
 *           example: 39.99
 *         quarterly_price:
 *           type: number
 *           format: decimal
 *           minimum: 0
 *           description: 季度价格（3个月，可选）
 *           example: 99.99
 *         yearly_price:
 *           type: number
 *           format: decimal
 *           minimum: 0
 *           description: 年度价格（12个月，可选）
 *           example: 359.99
 *         points_discount_rate:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *           description: 积分折扣率（1-10，如8表示8折，可选）
 *           example: 8
 * 
 *     UpdateVIPLevelRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *           description: VIP等级名称
 *           example: "updated-vip"
 *         display_name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: VIP等级显示名称
 *           example: "更新的VIP"
 *         description:
 *           type: string
 *           maxLength: 500
 *           description: VIP等级描述
 *           example: "更新的VIP描述"
 *         benefits:
 *           type: object
 *           description: VIP权益配置
 *           additionalProperties: true
 *         price:
 *           type: number
 *           format: decimal
 *           minimum: 0
 *           description: VIP价格（月价格）
 *           example: 29.99
 *         quarterly_price:
 *           type: number
 *           format: decimal
 *           minimum: 0
 *           description: 季度价格（3个月）
 *           example: 79.99
 *         yearly_price:
 *           type: number
 *           format: decimal
 *           minimum: 0
 *           description: 年度价格（12个月）
 *           example: 299.99
 *         points_discount_rate:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *           description: 积分折扣率（1-10，如8表示8折）
 *           example: 8
 *         is_active:
 *           type: boolean
 *           description: 是否启用该等级
 *           example: true
 * 
 *     UserVIPInfo:
 *       type: object
 *       properties:
 *         user_id:
 *           type: integer
 *           description: 用户ID
 *           example: 1
 *         username:
 *           type: string
 *           description: 用户名
 *           example: "testuser"
 *         nickname:
 *           type: string
 *           description: 用户昵称
 *           example: "测试用户"
 *         is_vip:
 *           type: boolean
 *           description: 是否为VIP用户
 *           example: true
 *         vip_level:
 *           type: integer
 *           nullable: true
 *           description: 当前VIP等级
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
 *           example: "VIP会员"
 *         vip_start_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: VIP开始时间
 *           example: "2025-09-12T00:00:00.000Z"
 *         vip_expire_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: VIP过期时间（null表示永久）
 *           example: "2025-10-12T23:59:59.000Z"
 *         is_expired:
 *           type: boolean
 *           description: VIP是否已过期
 *           example: false
 *         is_permanent:
 *           type: boolean
 *           description: 是否为永久VIP
 *           example: false
 * 
 *     SetUserVIPRequest:
 *       type: object
 *       required:
 *         - vip_level
 *       properties:
 *         vip_level:
 *           type: integer
 *           minimum: 0
 *           description: VIP等级
 *           example: 1
 *         days:
 *           type: integer
 *           minimum: 0
 *           default: 30
 *           description: VIP天数，0表示永久
 *           example: 30
 * 
 *     ExtendVIPRequest:
 *       type: object
 *       required:
 *         - days
 *       properties:
 *         days:
 *           type: integer
 *           minimum: 0
 *           description: 延长天数，0表示设置为永久
 *           example: 30
 * 
 *     VIPOrder:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: 订单ID
 *           example: 1001
 *         user_id:
 *           type: integer
 *           description: 用户ID
 *           example: 1
 *         order_number:
 *           type: string
 *           description: 订单号
 *           example: "VIP202509120001"
 *         vip_level:
 *           type: integer
 *           description: 购买的VIP等级
 *           example: 1
 *         vip_level_name:
 *           type: string
 *           description: VIP等级名称
 *           example: "vip1"
 *         duration_days:
 *           type: integer
 *           description: 购买天数
 *           example: 30
 *         amount:
 *           type: number
 *           format: decimal
 *           description: 订单金额
 *           example: 19.99
 *         status:
 *           type: string
 *           enum: [pending, paid, cancelled, refunded]
 *           description: 订单状态
 *           example: "paid"
 *         payment_method:
 *           type: string
 *           nullable: true
 *           description: 支付方式
 *           example: "alipay"
 *         payment_transaction_id:
 *           type: string
 *           nullable: true
 *           description: 支付交易ID
 *           example: "2025091200001001"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2025-09-12T10:00:00.000Z"
 *         paid_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: 支付时间
 *           example: "2025-09-12T10:05:00.000Z"
 * 
 *     VIPOrderListResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/VIPOrder'
 */