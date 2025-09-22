/**
 * @swagger
 * components:
 *   schemas:
 *     CardOrder:
 *       type: object
 *       required:
 *         - id
 *         - order_no
 *         - type
 *         - price
 *         - status
 *         - created_at
 *         - card_key_code
 *       properties:
 *         id:
 *           type: integer
 *           description: 订单ID
 *           example: 11
 *         order_no:
 *           type: string
 *           description: 订单编号
 *           example: "CARD_1758582465803_32"
 *         type:
 *           type: string
 *           enum: [vip, points]
 *           description: 卡密兑换类型
 *           example: "vip"
 *         price:
 *           type: number
 *           format: decimal
 *           description: 订单金额
 *           example: 100
 *         status:
 *           type: string
 *           description: 订单状态
 *           example: "paid"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2025-09-22T23:07:45.804Z"
 *         card_key_code:
 *           type: string
 *           description: 兑换的卡密代码
 *           example: "EQLT-GUDP-6DKA-VTPA"
 *         vip_info:
 *           type: object
 *           nullable: true
 *           description: VIP卡密信息（仅VIP类型订单）
 *           properties:
 *             level:
 *               type: integer
 *               description: VIP等级
 *               example: 3
 *             days:
 *               type: integer
 *               description: VIP天数
 *               example: 30
 *         points_info:
 *           type: object
 *           nullable: true
 *           description: 积分卡密信息（仅积分类型订单）
 *           properties:
 *             points:
 *               type: integer
 *               description: 获得的积分数量
 *               example: 2000
 *         commission_info:
 *           type: object
 *           nullable: true
 *           description: 佣金信息
 *           properties:
 *             commission_id:
 *               type: integer
 *               description: 佣金记录ID
 *               example: 7
 *             commission_amount:
 *               type: number
 *               format: decimal
 *               description: 佣金金额
 *               example: 10
 *             commission_rate:
 *               type: number
 *               format: decimal
 *               description: 佣金比例
 *               example: 0.1
 *             status:
 *               type: string
 *               description: 佣金状态
 *               example: "pending"
 *             inviter_username:
 *               type: string
 *               description: 邀请人用户名
 *               example: "updateduser"
 *
 *     CardOrderDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/CardOrder'
 *         - type: object
 *           properties:
 *             updated_at:
 *               type: string
 *               format: date-time
 *               description: 更新时间
 *               example: "2025-09-22T23:07:45.804Z"
 *             commission_info:
 *               type: object
 *               nullable: true
 *               description: 详细佣金信息
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: 佣金记录ID
 *                   example: 7
 *                 amount:
 *                   type: number
 *                   format: decimal
 *                   description: 佣金金额
 *                   example: 10
 *                 rate:
 *                   type: number
 *                   format: decimal
 *                   description: 佣金比例
 *                   example: 0.1
 *                 event_type:
 *                   type: string
 *                   description: 事件类型
 *                   example: "card_redeem"
 *                 status:
 *                   type: string
 *                   description: 佣金状态
 *                   example: "pending"
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                   description: 佣金记录创建时间
 *                   example: "2025-09-22T23:07:45.804Z"
 *                 settled_at:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                   description: 佣金结算时间
 *                   example: null
 *                 inviter:
 *                   type: object
 *                   description: 邀请人信息
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: 邀请人ID
 *                       example: 123
 *                     username:
 *                       type: string
 *                       description: 邀请人用户名
 *                       example: "updateduser"
 *                     nickname:
 *                       type: string
 *                       description: 邀请人昵称
 *                       example: "推荐人"
 *
 *     CardOrderListResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 orders:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CardOrder'
 *                   description: 订单列表
 *                 pagination:
 *                   type: object
 *                   description: 分页信息
 *                   properties:
 *                     current_page:
 *                       type: integer
 *                       description: 当前页码
 *                       example: 1
 *                     per_page:
 *                       type: integer
 *                       description: 每页数量
 *                       example: 20
 *                     total:
 *                       type: integer
 *                       description: 总记录数
 *                       example: 100
 *                     total_pages:
 *                       type: integer
 *                       description: 总页数
 *                       example: 5
 *                     has_next:
 *                       type: boolean
 *                       description: 是否有下一页
 *                       example: true
 *                     has_prev:
 *                       type: boolean
 *                       description: 是否有上一页
 *                       example: false
 *                 statistics:
 *                   type: object
 *                   description: 统计信息
 *                   properties:
 *                     total_orders:
 *                       type: integer
 *                       description: 总订单数
 *                       example: 15
 *                     vip_orders:
 *                       type: integer
 *                       description: VIP订单数
 *                       example: 10
 *                     points_orders:
 *                       type: integer
 *                       description: 积分订单数
 *                       example: 5
 *                     total_amount:
 *                       type: number
 *                       format: decimal
 *                       description: 总消费金额
 *                       example: 1500.00
 *                     vip_total_amount:
 *                       type: number
 *                       format: decimal
 *                       description: VIP订单总金额
 *                       example: 1000.00
 *                     points_total_amount:
 *                       type: number
 *                       format: decimal
 *                       description: 积分订单总金额
 *                       example: 500.00
 *
 *     CardOrderDetailResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               $ref: '#/components/schemas/CardOrderDetail'
 */