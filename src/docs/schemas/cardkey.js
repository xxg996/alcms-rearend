/**
 * @swagger
 * components:
 *   schemas:
 *     CardKey:
 *       type: object
 *       required:
 *         - id
 *         - code
 *         - type
 *         - status
 *         - created_at
 *       properties:
 *         id:
 *           type: integer
 *           description: 卡密ID
 *           example: 1001
 *         code:
 *           type: string
 *           description: 卡密代码
 *           example: "VIP2025091200001"
 *         type:
 *           type: string
 *           enum: [vip, points, download]
 *           description: 卡密类型
 *           example: "vip"
 *         vip_level:
 *           type: integer
 *           nullable: true
 *           description: VIP等级（vip类型时使用）
 *           example: 1
 *         vip_days:
 *           type: integer
 *           nullable: true
 *           description: VIP天数，0表示永久（vip类型时使用）
 *           example: 30
 *         points:
 *           type: integer
 *           nullable: true
 *           description: 积分数量（points类型时使用）
 *           example: 1000
 *         download_credits:
 *           type: integer
 *           nullable: true
 *           description: 下载次数（download类型时使用）
 *           example: 5
 *         value_amount:
 *           type: number
 *           format: decimal
 *           nullable: true
 *           description: 卡密价值金额（用于佣金计算）
 *           example: 19.99
 *         status:
 *           type: string
 *           enum: [unused, used, expired, disabled]
 *           description: 卡密状态
 *           example: "unused"
 *         batch_id:
 *           type: string
 *           nullable: true
 *           description: 批次ID
 *           example: "BATCH_20250912_001"
 *         expire_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: 卡密过期时间
 *           example: "2025-12-31T23:59:59.000Z"
 *         is_expired:
 *           type: boolean
 *           description: 是否已过期
 *           example: false
 *         used_by:
 *           type: integer
 *           nullable: true
 *           description: 使用者用户ID
 *           example: 123
 *         used_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: 使用时间
 *           example: "2025-09-15T10:30:00.000Z"
 *         created_by:
 *           type: integer
 *           description: 创建者用户ID
 *           example: 1
 *         created_by_username:
 *           type: string
 *           description: 创建者用户名
 *           example: "admin"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2025-09-12T08:00:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *           example: "2025-09-12T08:00:00.000Z"
 * 
 *     CreateCardKeyRequest:
 *       type: object
 *       required:
 *         - type
 *       properties:
 *         type:
 *           type: string
 *           enum: [vip, points, download]
 *           description: 卡密类型
 *           example: "vip"
 *         vip_level:
 *           type: integer
 *           minimum: 1
 *           description: VIP等级（vip类型时必填）
 *           example: 1
 *         vip_days:
 *           type: integer
 *           minimum: 0
 *           default: 30
 *           description: VIP天数，0表示永久
 *           example: 30
 *         points:
 *           type: integer
 *           minimum: 1
 *           description: 积分数量（points类型时必填）
 *           example: 1000
 *         download_credits:
 *           type: integer
 *           minimum: 1
 *           description: 下载次数（download类型时必填）
 *           example: 5
 *         value_amount:
 *           type: number
 *           format: decimal
 *           minimum: 0
 *           description: 卡密价值金额（可选，用于佣金计算，不填则自动计算）
 *           example: 19.99
 *         expire_at:
 *           type: string
 *           format: date-time
 *           description: 卡密过期时间（可选）
 *           example: "2025-12-31T23:59:59.000Z"
 * 
 *     CreateBatchCardKeysRequest:
 *       type: object
 *       required:
 *         - type
 *         - count
 *       properties:
 *         type:
 *           type: string
 *           enum: [vip, points, download]
 *           description: 卡密类型
 *           example: "vip"
 *         vip_level:
 *           type: integer
 *           minimum: 1
 *           description: VIP等级（vip类型时必填）
 *           example: 1
 *         vip_days:
 *           type: integer
 *           minimum: 0
 *           default: 30
 *           description: VIP天数，0表示永久
 *           example: 30
 *         points:
 *           type: integer
 *           minimum: 1
 *           description: 积分数量（points类型时必填）
 *           example: 500
 *         download_credits:
 *           type: integer
 *           minimum: 1
 *           description: 下载次数（download类型时必填）
 *           example: 20
 *         value_amount:
 *           type: number
 *           format: decimal
 *           minimum: 0
 *           description: 卡密价值金额（可选，用于佣金计算，不填则自动计算）
 *           example: 19.99
 *         count:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           description: 生成数量
 *           example: 100
 *         expire_at:
 *           type: string
 *           format: date-time
 *           description: 卡密过期时间（可选）
 *           example: "2025-12-31T23:59:59.000Z"
 * 
 *     RedeemCardKeyRequest:
 *       type: object
 *       required:
 *         - code
 *       properties:
 *         code:
 *           type: string
 *           minLength: 1
 *           description: 卡密代码
 *           example: "VIP2025091200001"
 * 
 *     UpdateCardStatusRequest:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [unused, used, expired, disabled]
 *           description: 卡密状态
 *           example: "disabled"
 * 
 *     CardKeyBatch:
 *       type: object
 *       properties:
 *         batch_id:
 *           type: string
 *           description: 批次ID
 *           example: "BATCH_20250912_001"
 *         type:
 *           type: string
 *           enum: [vip, points, download]
 *           description: 卡密类型
 *           example: "vip"
 *         vip_level:
 *           type: integer
 *           nullable: true
 *           description: VIP等级
 *           example: 1
 *         vip_days:
 *           type: integer
 *           nullable: true
 *           description: VIP天数
 *           example: 30
 *         points:
 *           type: integer
 *           nullable: true
 *           description: 积分数量
 *           example: 1000
 *         download_credits:
 *           type: integer
 *           nullable: true
 *           description: 下载次数
 *           example: 20
 *         total_count:
 *           type: integer
 *           description: 总数量
 *           example: 100
 *         unused_count:
 *           type: integer
 *           description: 未使用数量
 *           example: 85
 *         used_count:
 *           type: integer
 *           description: 已使用数量
 *           example: 15
 *         expired_count:
 *           type: integer
 *           description: 已过期数量
 *           example: 0
 *         created_by:
 *           type: integer
 *           description: 创建者ID
 *           example: 1
 *         created_by_username:
 *           type: string
 *           description: 创建者用户名
 *           example: "admin"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2025-09-12T08:00:00.000Z"
 * 
 *     CardKeyStatistics:
 *       type: object
 *       properties:
 *         total_count:
 *           type: integer
 *           description: 总卡密数量
 *           example: 500
 *         unused_count:
 *           type: integer
 *           description: 未使用数量
 *           example: 320
 *         used_count:
 *           type: integer
 *           description: 已使用数量
 *           example: 150
 *         expired_count:
 *           type: integer
 *           description: 已过期数量
 *           example: 20
 *         disabled_count:
 *           type: integer
 *           description: 已禁用数量
 *           example: 10
 *         by_type:
 *           type: object
 *           properties:
 *             vip:
 *               type: integer
 *               description: VIP类型卡密数量
 *               example: 300
 *             points:
 *               type: integer
 *               description: 积分类型卡密数量
 *               example: 200
 *             download:
 *               type: integer
 *               description: 下载次数卡密数量
 *               example: 50
 *         recent_usage:
 *           type: object
 *           properties:
 *             today:
 *               type: integer
 *               description: 今日使用数量
 *               example: 5
 *             this_week:
 *               type: integer
 *               description: 本周使用数量
 *               example: 25
 *             this_month:
 *               type: integer
 *               description: 本月使用数量
 *               example: 120
 * 
 *     RedeemCardKeyResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 card_type:
 *                   type: string
 *                   enum: [vip, points]
 *                   description: 卡密类型
 *                   example: "vip"
 *                 vip_level:
 *                   type: integer
 *                   nullable: true
 *                   description: VIP等级
 *                   example: 1
 *                 vip_days:
 *                   type: integer
 *                   nullable: true
 *                   description: VIP天数
 *                   example: 30
 *                 points:
 *                   type: integer
 *                   nullable: true
 *                   description: 积分数量
 *                   example: null
 *                 vip_result:
 *                   type: object
 *                   nullable: true
 *                   description: VIP设置结果
 *                 order:
 *                   type: object
 *                   nullable: true
 *                   description: 生成的订单信息
 * 
 *     BatchCardKeysResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 batch_id:
 *                   type: string
 *                   description: 批次ID
 *                   example: "BATCH_20250912_001"
 *                 count:
 *                   type: integer
 *                   description: 生成数量
 *                   example: 100
 *                 sample_codes:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: 示例卡密代码（前5个）
 *                   example: ["VIP2025091200001", "VIP2025091200002", "VIP2025091200003"]
 */
