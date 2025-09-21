/**
 * @swagger
 * components:
 *   schemas:
 *     CommissionStats:
 *       type: object
 *       properties:
 *         invite_count:
 *           type: integer
 *           description: 已邀请的用户数量
 *           example: 5
 *         commission_balance:
 *           type: number
 *           format: float
 *           description: 当前可提现余额（已审核通过且尚未提现）
 *           example: 18.50
 *         total_commission_earned:
 *           type: number
 *           format: float
 *           description: 累计获得的佣金总额（包含已提现和审批中金额）
 *           example: 42.75
 *         approved_amount:
 *           type: number
 *           format: float
 *           description: 已审核通过但尚未提现的佣金金额
 *           example: 12.50
 *         pending_amount:
 *           type: number
 *           format: float
 *           description: 待审核的佣金金额
 *           example: 6.00
 *         payout_processing_amount:
 *           type: number
 *           format: float
 *           description: 已提交提现申请但尚未打款的金额
 *           example: 5
 *         payout_paid_amount:
 *           type: number
 *           format: float
 *           description: 历史已成功打款的提现金额
 *           example: 20
 *     CommissionInvitee:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: 下级用户ID
 *           example: 23
 *         username:
 *           type: string
 *           description: 下级用户名
 *           example: "newbie"
 *         email:
 *           type: string
 *           format: email
 *           description: 下级邮箱
 *           example: "newbie@example.com"
 *         nickname:
 *           type: string
 *           nullable: true
 *           description: 下级昵称
 *           example: "新手"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 注册时间
 *           example: "2025-10-01T12:00:00.000Z"
 *         invited_at:
 *           type: string
 *           format: date-time
 *           description: 绑定时间
 *           example: "2025-10-01T12:05:00.000Z"
 *         is_vip:
 *           type: boolean
 *           description: 是否已成为VIP
 *           example: true
 *         vip_level:
 *           type: integer
 *           nullable: true
 *           description: 当前VIP等级
 *           example: 1
 *         vip_expire_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: VIP到期时间
 *           example: "2026-01-01T00:00:00.000Z"
 *     CommissionDashboardResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 referral_code:
 *                   type: string
 *                   nullable: true
 *                   description: 当前邀请码，未生成时返回 null
 *                   example: "ABCD1234"
 *                 stats:
 *                   $ref: '#/components/schemas/CommissionStats'
 *                 invites:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CommissionInvitee'
 *                 inviter:
 *                   type: object
 *                   nullable: true
 *                   description: 邀请当前用户的上级信息
 *                   properties:
 *                     inviter_id:
 *                       type: integer
 *                       nullable: true
 *                       description: 上级用户ID
 *                       example: 12
 *                     inviter_username:
 *                       type: string
 *                       nullable: true
 *                       description: 上级用户名
 *                       example: "mentor"
 *                     inviter_nickname:
 *                       type: string
 *                       nullable: true
 *                       description: 上级昵称
 *                       example: "导师"
 *                 payout_setting:
 *                   $ref: '#/components/schemas/CommissionPayoutSetting'
 *     CommissionCodeResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 referral_code:
 *                   type: string
 *                   description: 最新生成的邀请码
 *                   example: "EFGH5678"
 *     CommissionConfig:
 *       type: object
 *       properties:
 *         enabled:
 *           type: boolean
 *           description: 是否启用邀请佣金
 *           example: true
 *         first_rate:
 *           type: number
 *           format: float
 *           description: 首次充值佣金比例（0-1）
 *           example: 0.1
 *         renewal_rate:
 *           type: number
 *           format: float
 *           description: 续费佣金比例（0-1）
 *           example: 0.05
 *     CommissionConfigResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               $ref: '#/components/schemas/CommissionConfig'
 *     CommissionRecord:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: 佣金记录ID
 *           example: 1001
 *         inviter_id:
 *           type: integer
 *           description: 邀请人用户ID
 *           example: 1
 *         invitee_id:
 *           type: integer
 *           description: 下级用户ID
 *           example: 22
 *         order_id:
 *           type: integer
 *           description: 关联订单ID
 *           example: 120
 *         order_amount:
 *           type: number
 *           format: float
 *           description: 订单金额
 *           example: 30
 *         commission_amount:
 *           type: number
 *           format: float
 *           description: 实际获得的佣金金额
 *           example: 3
 *         commission_rate:
 *           type: number
 *           format: float
 *           description: 佣金比例
 *           example: 0.1
 *         event_type:
 *           type: string
 *           enum: [first_recharge, renewal]
 *           description: 佣金事件类型
 *           example: "first_recharge"
 *         status:
 *           type: string
 *           description: 佣金状态
 *           example: "paid"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 佣金创建时间
 *           example: "2025-09-21T15:21:00.000Z"
 *         settled_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: 佣金结算时间
 *           example: null
 *         settlement_method:
 *           type: string
 *           nullable: true
 *           description: 审核通过时记录的提现方式
 *           example: "alipay"
 *         settlement_account:
 *           type: string
 *           nullable: true
 *           description: 审核通过时记录的提现账号
 *           example: "user@example.com"
 *         review_notes:
 *           type: string
 *           nullable: true
 *           description: 审核备注
 *           example: "已转账"
 *     CommissionRecordListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             items:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CommissionRecord'
 *             pagination:
 *               $ref: '#/components/schemas/Pagination'
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2025-09-21T15:22:00.000Z"
 *     CommissionPayoutSetting:
 *       type: object
 *       nullable: true
 *       properties:
 *         method:
 *           type: string
 *           enum: [alipay, usdt]
 *           description: 提现方式
 *           example: "alipay"
 *         account:
 *           type: string
 *           description: 提现账号
 *           example: "user@example.com"
 *         account_name:
 *           type: string
 *           nullable: true
 *           description: 账户名称或备注
 *           example: "张三"
 *         extra:
 *           type: object
 *           additionalProperties: true
 *           description: 附加信息（例如 USDT 网络）
 *           example:
 *             usdt_network: "TRC20"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 最近更新时间
 *           example: "2025-09-21T10:00:00.000Z"
 *     CommissionPayoutResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               $ref: '#/components/schemas/CommissionPayoutSetting'
 *     CommissionPayoutApplyResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               $ref: '#/components/schemas/CommissionPayoutRecord'
 *     CommissionPayoutSettingRequest:
 *       type: object
 *       required:
 *         - method
 *         - account
 *       properties:
 *         method:
 *           type: string
 *           enum: [alipay, usdt]
 *           description: 提现方式
 *           example: "alipay"
 *         account:
 *           type: string
 *           description: 提现账号
 *           example: "user@example.com"
 *         account_name:
 *           type: string
 *           nullable: true
 *           description: 账户姓名或备注
 *           example: "张三"
 *         usdt_network:
 *           type: string
 *           nullable: true
 *           description: USDT 网络，例如 ERC20、TRC20
 *           example: "TRC20"
 *     CommissionPayoutApplyRequest:
 *       type: object
 *       required:
 *         - amount
 *       properties:
 *         amount:
 *           type: number
 *           format: float
 *           description: 本次申请提现的金额
 *           example: 15
 *         method:
 *           type: string
 *           enum: [alipay, usdt]
 *           nullable: true
 *           description: 可覆盖默认提现方式
 *           example: "usdt"
 *         account:
 *           type: string
 *           nullable: true
 *           description: 可覆盖默认提现账号
 *           example: "TPaoY7Fst6..."
 *         account_name:
 *           type: string
 *           nullable: true
 *           description: 可覆盖默认账户姓名
 *           example: "张三"
 *         usdt_network:
 *           type: string
 *           nullable: true
 *           description: USDT 网络，例如 ERC20、TRC20
 *           example: "TRC20"
 *         requested_notes:
 *           type: string
 *           nullable: true
 *           description: 备注信息
 *           example: "请尽快处理"
 *     CommissionReviewRequest:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected, paid]
 *           description: 审核后的状态
 *           example: "approved"
 *         review_notes:
 *           type: string
 *           nullable: true
 *           description: 审核备注
 *           example: "已完成打款"
 *     CommissionPayoutReviewRequest:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected, paid]
 *           description: 提现申请状态
 *           example: "approved"
 *         review_notes:
 *           type: string
 *           nullable: true
 *           description: 审核备注
 *           example: "信息核对无误"
*     CommissionPayoutRecord:
*       type: object
*       properties:
*         id:
*           type: integer
*           example: 10
*         user_id:
*           type: integer
*           example: 1
*         username:
*           type: string
*           example: "admin"
*         email:
*           type: string
*           format: email
*           example: "admin@example.com"
*         amount:
*           type: number
*           format: float
*           example: 20
*         method:
*           type: string
*           enum: [alipay, usdt]
*           example: "alipay"
*         account:
*           type: string
*           example: "user@example.com"
*         account_name:
*           type: string
*           nullable: true
*           example: "张三"
 *         extra:
 *           type: object
 *           additionalProperties: true
 *           description: 附加参数（如 USDT 网络）
*         status:
*           type: string
*           enum: [pending, approved, rejected, paid]
*           example: "pending"
*         requested_notes:
*           type: string
*           nullable: true
*           example: "请尽快处理"
*         review_notes:
*           type: string
*           nullable: true
*           example: "已打款"
*         created_at:
*           type: string
*           format: date-time
*         reviewed_at:
*           type: string
*           format: date-time
*           nullable: true
 *         reviewed_by:
 *           type: integer
 *           nullable: true
 *           description: 审核管理员ID
*         paid_at:
*           type: string
*           format: date-time
*           nullable: true
 *     CommissionPayoutListResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CommissionPayoutRecord'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
