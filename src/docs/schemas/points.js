/**
 * @swagger
 * components:
 *   schemas:
 *     UserPoints:
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
 *         current_points:
 *           type: integer
 *           description: 当前积分余额
 *           example: 2500
 *         total_earned:
 *           type: integer
 *           description: 累计获得积分
 *           example: 5000
 *         total_spent:
 *           type: integer
 *           description: 累计消费积分
 *           example: 2500
 *         last_updated:
 *           type: string
 *           format: date-time
 *           description: 积分最后更新时间
 *           example: "2025-09-12T10:30:00.000Z"
 * 
 *     PointsRecord:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: 记录ID
 *           example: 1001
 *         user_id:
 *           type: integer
 *           description: 用户ID
 *           example: 1
 *         amount:
 *           type: integer
 *           description: 积分变化量（正数为获得，负数为消费）
 *           example: 100
 *         balance_after:
 *           type: integer
 *           description: 操作后积分余额
 *           example: 2500
 *         type:
 *           type: string
 *           description: 积分变化类型
 *           enum: [system_reward, checkin, resource_download, admin_adjust, transfer_in, transfer_out, card_redeem, purchase]
 *           example: "checkin"
 *         description:
 *           type: string
 *           nullable: true
 *           description: 积分变化描述
 *           example: "每日签到奖励"
 *         related_id:
 *           type: integer
 *           nullable: true
 *           description: 关联对象ID（如资源ID、订单ID等）
 *           example: 123
 *         operator_id:
 *           type: integer
 *           nullable: true
 *           description: 操作者ID（管理员调整时使用）
 *           example: null
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2025-09-12T10:30:00.000Z"
 * 
 *     AdjustPointsRequest:
 *       type: object
 *       required:
 *         - amount
 *       properties:
 *         amount:
 *           type: integer
 *           description: 积分调整数量（正数为增加，负数为扣除）
 *           example: 500
 *         description:
 *           type: string
 *           maxLength: 200
 *           description: 调整原因描述
 *           example: "管理员手动调整积分"
 * 
 *     BatchGrantPointsRequest:
 *       type: object
 *       required:
 *         - user_ids
 *         - amount
 *       properties:
 *         user_ids:
 *           type: array
 *           items:
 *             type: integer
 *           minItems: 1
 *           maxItems: 1000
 *           description: 用户ID列表
 *           example: [1, 2, 3, 4, 5]
 *         amount:
 *           type: integer
 *           minimum: 1
 *           description: 发放积分数量
 *           example: 100
 *         description:
 *           type: string
 *           maxLength: 200
 *           description: 发放原因描述
 *           example: "活动奖励发放"
 * 
 *     TransferPointsRequest:
 *       type: object
 *       required:
 *         - to_user_id
 *         - amount
 *       properties:
 *         to_user_id:
 *           type: integer
 *           description: 目标用户ID
 *           example: 123
 *         amount:
 *           type: integer
 *           minimum: 1
 *           maximum: 10000
 *           description: 转账积分数量
 *           example: 500
 *         description:
 *           type: string
 *           maxLength: 100
 *           description: 转账备注
 *           example: "感谢帮助"
 * 
 *     PointsLeaderboardItem:
 *       type: object
 *       properties:
 *         rank:
 *           type: integer
 *           description: 排名
 *           example: 1
 *         user_id:
 *           type: integer
 *           description: 用户ID
 *           example: 1
 *         username:
 *           type: string
 *           description: 用户名
 *           example: "topuser"
 *         nickname:
 *           type: string
 *           description: 用户昵称
 *           example: "积分达人"
 *         avatar_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: 用户头像
 *           example: "https://example.com/avatar.jpg"
 *         points:
 *           type: integer
 *           description: 积分数量
 *           example: 10000
 *         points_type:
 *           type: string
 *           enum: [current, total]
 *           description: 积分类型（当前积分或累计积分）
 *           example: "current"
 * 
 *     PointsRank:
 *       type: object
 *       properties:
 *         rank:
 *           type: integer
 *           description: 当前排名
 *           example: 15
 *         total_users:
 *           type: integer
 *           description: 总用户数
 *           example: 1000
 *         current_points:
 *           type: integer
 *           description: 当前积分
 *           example: 2500
 *         points_type:
 *           type: string
 *           enum: [current, total]
 *           description: 积分类型
 *           example: "current"
 *         percentile:
 *           type: number
 *           format: float
 *           description: 百分位排名
 *           example: 85.5
 * 
 *     PointsStatistics:
 *       type: object
 *       properties:
 *         total_users:
 *           type: integer
 *           description: 总用户数
 *           example: 1000
 *         total_points_issued:
 *           type: integer
 *           description: 系统总发放积分
 *           example: 1000000
 *         total_points_spent:
 *           type: integer
 *           description: 系统总消费积分
 *           example: 600000
 *         current_circulating:
 *           type: integer
 *           description: 当前流通积分
 *           example: 400000
 *         avg_user_points:
 *           type: number
 *           format: float
 *           description: 用户平均积分
 *           example: 400.5
 *         daily_stats:
 *           type: object
 *           properties:
 *             today_earned:
 *               type: integer
 *               description: 今日获得积分
 *               example: 5000
 *             today_spent:
 *               type: integer
 *               description: 今日消费积分
 *               example: 3000
 *             active_users:
 *               type: integer
 *               description: 今日活跃用户数
 *               example: 150
 *         by_type:
 *           type: object
 *           additionalProperties:
 *             type: integer
 *           description: 按类型统计的积分分布
 *           example:
 *             checkin: 100000
 *             system_reward: 200000
 *             transfer_in: 50000
 *             admin_adjust: 30000
 * 
 *     BatchGrantResult:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           description: 总处理数量
 *           example: 100
 *         success_count:
 *           type: integer
 *           description: 成功数量
 *           example: 95
 *         fail_count:
 *           type: integer
 *           description: 失败数量
 *           example: 5
 *         results:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: integer
 *                 example: 1
 *               success:
 *                 type: boolean
 *                 example: true
 *               error:
 *                 type: string
 *                 nullable: true
 *                 example: null
 *               points_after:
 *                 type: integer
 *                 nullable: true
 *                 example: 1500
 */