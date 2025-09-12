/**
 * @swagger
 * components:
 *   schemas:
 *     Favorite:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: 收藏记录ID
 *           example: 1001
 *         user_id:
 *           type: integer
 *           description: 用户ID
 *           example: 1
 *         resource_id:
 *           type: integer
 *           description: 资源ID
 *           example: 123
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 收藏时间
 *           example: "2025-09-12T10:30:00.000Z"
 *         resource:
 *           type: object
 *           description: 资源详情
 *           properties:
 *             id:
 *               type: integer
 *               example: 123
 *             title:
 *               type: string
 *               example: "精美UI设计素材"
 *             description:
 *               type: string
 *               example: "高质量的UI设计素材包"
 *             thumbnail:
 *               type: string
 *               format: uri
 *               example: "https://example.com/thumbnail.jpg"
 *             category_name:
 *               type: string
 *               example: "UI设计"
 *             type_name:
 *               type: string
 *               example: "PSD文件"
 *             download_count:
 *               type: integer
 *               example: 150
 *             favorite_count:
 *               type: integer
 *               example: 25
 *             file_size:
 *               type: integer
 *               description: 文件大小（字节）
 *               example: 15728640
 *             status:
 *               type: string
 *               example: "published"
 * 
 *     FavoriteToggleRequest:
 *       type: object
 *       description: 切换收藏状态的请求（通过路径参数传递resourceId）
 * 
 *     BatchCheckFavoriteStatusRequest:
 *       type: object
 *       required:
 *         - resource_ids
 *       properties:
 *         resource_ids:
 *           type: array
 *           items:
 *             type: integer
 *           minItems: 1
 *           maxItems: 100
 *           description: 资源ID列表
 *           example: [123, 456, 789]
 * 
 *     BatchRemoveFavoritesRequest:
 *       type: object
 *       required:
 *         - resource_ids
 *       properties:
 *         resource_ids:
 *           type: array
 *           items:
 *             type: integer
 *           minItems: 1
 *           maxItems: 50
 *           description: 要取消收藏的资源ID列表
 *           example: [123, 456, 789]
 * 
 *     FavoriteStatus:
 *       type: object
 *       properties:
 *         is_favorited:
 *           type: boolean
 *           description: 是否已收藏
 *           example: true
 *         resource_id:
 *           type: integer
 *           description: 资源ID
 *           example: 123
 *         favorited_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: 收藏时间
 *           example: "2025-09-12T10:30:00.000Z"
 * 
 *     FavoriteToggleResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 is_favorited:
 *                   type: boolean
 *                   description: 操作后的收藏状态
 *                 resource_id:
 *                   type: integer
 *                   description: 资源ID
 *                 favorited_at:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                   description: 收藏时间（收藏时有值）
 *                 action:
 *                   type: string
 *                   enum: [favorited, unfavorited]
 *                   description: 执行的操作
 * 
 *     BatchFavoriteStatusResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               additionalProperties:
 *                 type: object
 *                 properties:
 *                   is_favorited:
 *                     type: boolean
 *                   favorited_at:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *               example:
 *                 "123":
 *                   is_favorited: true
 *                   favorited_at: "2025-09-12T10:30:00.000Z"
 *                 "456":
 *                   is_favorited: false
 *                   favorited_at: null
 * 
 *     UserFavoriteStats:
 *       type: object
 *       properties:
 *         total_count:
 *           type: integer
 *           description: 总收藏数
 *           example: 25
 *         this_month_count:
 *           type: integer
 *           description: 本月收藏数
 *           example: 5
 *         by_category:
 *           type: object
 *           description: 按分类统计
 *           additionalProperties:
 *             type: integer
 *           example:
 *             "UI设计": 10
 *             "图标素材": 8
 *             "字体文件": 7
 *         by_type:
 *           type: object
 *           description: 按类型统计
 *           additionalProperties:
 *             type: integer
 *           example:
 *             "PSD文件": 12
 *             "AI文件": 8
 *             "字体": 5
 *         recent_favorites:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               resource_id:
 *                 type: integer
 *               title:
 *                 type: string
 *               favorited_at:
 *                 type: string
 *                 format: date-time
 *           description: 最近收藏的资源（最多5个）
 *           example:
 *             - resource_id: 123
 *               title: "精美UI设计素材"
 *               favorited_at: "2025-09-12T10:30:00.000Z"
 * 
 *     ResourceFavoriteStats:
 *       type: object
 *       properties:
 *         resource_id:
 *           type: integer
 *           description: 资源ID
 *           example: 123
 *         resource_title:
 *           type: string
 *           description: 资源标题
 *           example: "精美UI设计素材"
 *         total_favorites:
 *           type: integer
 *           description: 总收藏数
 *           example: 150
 *         today_favorites:
 *           type: integer
 *           description: 今日收藏数
 *           example: 5
 *         this_week_favorites:
 *           type: integer
 *           description: 本周收藏数
 *           example: 25
 *         this_month_favorites:
 *           type: integer
 *           description: 本月收藏数
 *           example: 80
 *         favorite_trend:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               count:
 *                 type: integer
 *           description: 收藏趋势（近30天）
 *           example:
 *             - date: "2025-09-12"
 *               count: 5
 *             - date: "2025-09-11"
 *               count: 3
 * 
 *     PopularFavorite:
 *       type: object
 *       properties:
 *         resource_id:
 *           type: integer
 *           description: 资源ID
 *           example: 123
 *         title:
 *           type: string
 *           description: 资源标题
 *           example: "精美UI设计素材"
 *         description:
 *           type: string
 *           description: 资源描述
 *           example: "高质量的UI设计素材包"
 *         thumbnail:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: 缩略图
 *           example: "https://example.com/thumbnail.jpg"
 *         category_name:
 *           type: string
 *           description: 分类名称
 *           example: "UI设计"
 *         type_name:
 *           type: string
 *           description: 类型名称
 *           example: "PSD文件"
 *         favorite_count:
 *           type: integer
 *           description: 收藏数量
 *           example: 150
 *         period_favorites:
 *           type: integer
 *           description: 指定时间段内的收藏数
 *           example: 80
 *         growth_rate:
 *           type: number
 *           format: float
 *           description: 增长率
 *           example: 53.3
 * 
 *     BatchRemoveFavoritesResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       resource_id:
 *                         type: integer
 *                       success:
 *                         type: boolean
 *                       action:
 *                         type: string
 *                         nullable: true
 *                       message:
 *                         type: string
 *                         nullable: true
 *                 errors:
 *                   type: array
 *                   nullable: true
 *                   items:
 *                     type: object
 *                     properties:
 *                       resource_id:
 *                         type: integer
 *                       error:
 *                         type: string
 * 
 *     UserFavoritesList:
 *       type: object
 *       properties:
 *         favorites:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Favorite'
 *           description: 收藏列表
 *         pagination:
 *           type: object
 *           properties:
 *             current_page:
 *               type: integer
 *               example: 1
 *             per_page:
 *               type: integer
 *               example: 20
 *             total:
 *               type: integer
 *               example: 100
 *             total_pages:
 *               type: integer
 *               example: 5
 *             has_next:
 *               type: boolean
 *               example: true
 *             has_prev:
 *               type: boolean
 *               example: false
 *         filters:
 *           type: object
 *           properties:
 *             category:
 *               type: integer
 *               nullable: true
 *               description: 筛选的分类ID
 *             type:
 *               type: integer
 *               nullable: true
 *               description: 筛选的类型ID
 *             search:
 *               type: string
 *               nullable: true
 *               description: 搜索关键词
 */