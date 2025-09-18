/**
 * @swagger
 * components:
 *   schemas:
 *     CheckinRecord:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: 签到记录ID
 *           example: 1001
 *         user_id:
 *           type: integer
 *           description: 用户ID
 *           example: 1
 *         checkin_date:
 *           type: string
 *           format: date
 *           description: 签到日期
 *           example: "2025-09-12"
 *         base_points:
 *           type: integer
 *           description: 基础积分
 *           example: 10
 *         bonus_points:
 *           type: integer
 *           description: 奖励积分
 *           example: 5
 *         total_points:
 *           type: integer
 *           description: 总获得积分
 *           example: 15
 *         consecutive_days:
 *           type: integer
 *           description: 连续签到天数
 *           example: 7
 *         is_bonus:
 *           type: boolean
 *           description: 是否获得连续签到奖励
 *           example: true
 *         is_makeup:
 *           type: boolean
 *           description: 是否补签
 *           example: false
 *         makeup_by:
 *           type: integer
 *           nullable: true
 *           description: 补签操作者ID
 *           example: null
 *         config_id:
 *           type: integer
 *           description: 使用的签到配置ID
 *           example: 1
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2025-09-12T08:30:00.000Z"
 * 
 *     CheckinStats:
 *       type: object
 *       properties:
 *         total_days:
 *           type: integer
 *           description: 总签到天数
 *           example: 150
 *         consecutive_days:
 *           type: integer
 *           description: 连续签到天数
 *           example: 7
 *         max_consecutive_days:
 *           type: integer
 *           description: 最长连续签到天数
 *           example: 30
 *         this_month_days:
 *           type: integer
 *           description: 本月签到天数
 *           example: 12
 *         total_points_earned:
 *           type: integer
 *           description: 签到累计获得积分
 *           example: 2500
 *         last_checkin_date:
 *           type: string
 *           format: date
 *           nullable: true
 *           description: 最后签到日期
 *           example: "2025-09-12"
 *         last_checkin_points:
 *           type: integer
 *           nullable: true
 *           description: 最后签到获得积分
 *           example: 15
 * 
 *     CheckinConfig:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: 配置ID
 *           example: 1
 *         name:
 *           type: string
 *           description: 配置名称
 *           example: "默认签到配置"
 *         description:
 *           type: string
 *           nullable: true
 *           description: 配置描述
 *           example: "系统默认的签到积分配置"
 *         daily_points:
 *           type: integer
 *           description: 每日基础积分
 *           example: 10
 *         consecutive_bonus:
 *           type: object
 *           description: 连续签到奖励配置
 *           example:
 *             "7": 10
 *             "14": 20
 *             "30": 50
 *         monthly_reset:
 *           type: boolean
 *           description: 是否月度重置连续天数
 *           example: true
 *         is_active:
 *           type: boolean
 *           description: 是否启用
 *           example: true
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
 *           example: "2025-09-01T00:00:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *           example: "2025-09-01T00:00:00.000Z"
 *         roles:
 *           type: array
 *           items:
 *             type: string
 *           description: 绑定的角色列表
 *           example: ["vip", "admin"]
 *
 *     CheckinConfigRole:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: 角色绑定ID
 *           example: 1
 *         checkin_config_id:
 *           type: integer
 *           description: 签到配置ID
 *           example: 1
 *         role_name:
 *           type: string
 *           description: 角色名称
 *           example: "vip"
 *         created_by:
 *           type: integer
 *           nullable: true
 *           description: 创建者ID
 *           example: 1
 *         created_by_username:
 *           type: string
 *           nullable: true
 *           description: 创建者用户名
 *           example: "admin"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2025-09-18T10:00:00.000Z"
 *
 *     CreateCheckinConfigRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           maxLength: 100
 *           description: 配置名称
 *           example: "VIP签到配置"
 *         description:
 *           type: string
 *           maxLength: 500
 *           description: 配置描述
 *           example: "VIP用户专属签到奖励配置"
 *         daily_points:
 *           type: integer
 *           minimum: 0
 *           default: 10
 *           description: 每日基础积分
 *           example: 20
 *         consecutive_bonus:
 *           type: object
 *           description: 连续签到奖励配置（天数:额外积分）
 *           example:
 *             "7": 20
 *             "14": 50
 *             "30": 100
 *         monthly_reset:
 *           type: boolean
 *           default: true
 *           description: 是否月度重置连续天数
 *           example: false
 *         roles:
 *           type: array
 *           items:
 *             type: string
 *           description: 绑定的角色列表
 *           example: ["vip", "admin"]
 *
 *     UpdateCheckinConfigRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           maxLength: 100
 *           description: 配置名称
 *           example: "更新的签到配置"
 *         description:
 *           type: string
 *           maxLength: 500
 *           description: 配置描述
 *           example: "更新后的配置描述"
 *         daily_points:
 *           type: integer
 *           minimum: 0
 *           description: 每日基础积分
 *           example: 15
 *         consecutive_bonus:
 *           type: object
 *           description: 连续签到奖励配置
 *           example:
 *             "5": 15
 *             "10": 30
 *             "20": 60
 *         monthly_reset:
 *           type: boolean
 *           description: 是否月度重置连续天数
 *           example: true
 *         is_active:
 *           type: boolean
 *           description: 是否启用
 *           example: true
 *         roles:
 *           type: array
 *           items:
 *             type: string
 *           description: 绑定的角色列表
 *           example: ["vip", "admin", "moderator"]
 *
 *     AddConfigRoleRequest:
 *       type: object
 *       required:
 *         - role_name
 *       properties:
 *         role_name:
 *           type: string
 *           description: 角色名称
 *           example: "vip"
 *
 *     MakeupCheckinRequest:
 *       type: object
 *       required:
 *         - date
 *       properties:
 *         date:
 *           type: string
 *           format: date
 *           description: 补签日期（YYYY-MM-DD格式）
 *           example: "2025-09-10"
 * 
 *     CheckinLeaderboardItem:
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
 *           example: "checkin_master"
 *         nickname:
 *           type: string
 *           description: 用户昵称
 *           example: "签到达人"
 *         avatar_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: 用户头像
 *           example: "https://example.com/avatar.jpg"
 *         consecutive_days:
 *           type: integer
 *           nullable: true
 *           description: 连续签到天数（consecutive类型时）
 *           example: 365
 *         total_days:
 *           type: integer
 *           nullable: true
 *           description: 总签到天数（total类型时）
 *           example: 300
 *         monthly_days:
 *           type: integer
 *           nullable: true
 *           description: 本月签到天数（monthly类型时）
 *           example: 12
 *         value:
 *           type: integer
 *           description: 排行榜数值
 *           example: 365
 * 
 *     CheckinStatistics:
 *       type: object
 *       properties:
 *         total_users:
 *           type: integer
 *           description: 总用户数
 *           example: 1000
 *         checkin_users_today:
 *           type: integer
 *           description: 今日签到用户数
 *           example: 150
 *         checkin_rate_today:
 *           type: number
 *           format: float
 *           description: 今日签到率
 *           example: 15.5
 *         total_checkins:
 *           type: integer
 *           description: 总签到次数
 *           example: 50000
 *         avg_consecutive_days:
 *           type: number
 *           format: float
 *           description: 平均连续签到天数
 *           example: 7.5
 *         max_consecutive_record:
 *           type: integer
 *           description: 最高连续签到记录
 *           example: 365
 *         daily_stats:
 *           type: object
 *           properties:
 *             checkin_count:
 *               type: integer
 *               description: 每日签到统计
 *               example: 150
 *             new_users:
 *               type: integer
 *               description: 新增签到用户
 *               example: 10
 *             points_distributed:
 *               type: integer
 *               description: 发放的积分总数
 *               example: 2500
 *         active_config:
 *           type: object
 *           nullable: true
 *           description: 当前活跃的签到配置
 *           properties:
 *             id:
 *               type: integer
 *               example: 1
 *             name:
 *               type: string
 *               example: "默认配置"
 *             daily_points:
 *               type: integer
 *               example: 10
 * 
 *     PerformCheckinResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: 签到记录ID
 *                 base_points:
 *                   type: integer
 *                   description: 基础积分
 *                 bonus_points:
 *                   type: integer
 *                   description: 奖励积分
 *                 total_points:
 *                   type: integer
 *                   description: 总积分
 *                 consecutive_days:
 *                   type: integer
 *                   description: 连续签到天数
 *                 is_bonus:
 *                   type: boolean
 *                   description: 是否获得奖励
 *                 points_record_id:
 *                   type: integer
 *                   description: 积分记录ID
 */