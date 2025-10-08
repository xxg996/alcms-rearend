/**
 * @swagger
 * components:
 *   schemas:
 *     Resource:
 *       type: object
 *       required:
 *         - id
 *         - title
 *         - slug
 *         - description
 *         - author_id
 *         - status
 *         - created_at
 *         - updated_at
 *       properties:
 *         id:
 *           type: integer
 *           description: 资源ID
 *           example: 1
 *         title:
 *           type: string
 *           description: 资源标题
 *           example: "Vue.js 完整教程"
 *         slug:
 *           type: string
 *           description: 资源链接标识符
 *           example: "vue-complete-tutorial"
 *         description:
 *           type: string
 *           description: 资源详细描述
 *           example: "从基础到高级的 Vue.js 学习教程"
 *         summary:
 *           type: string
 *           nullable: true
 *           description: 资源摘要
 *           example: "适合初学者的 Vue.js 教程"
 *         cover_image_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: 封面图片URL
 *           example: "https://example.com/covers/vue-tutorial.jpg"
 *         resource_type_id:
 *           type: integer
 *           nullable: true
 *           description: 资源类型ID
 *           example: 1
 *         resource_type_name:
 *           type: string
 *           nullable: true
 *           description: 资源类型名称
 *           example: "article"
 *         resource_type_display_name:
 *           type: string
 *           nullable: true
 *           description: 资源类型显示名称
 *           example: "文章"
 *         official:
 *           type: boolean
 *           description: 是否为官方资源
 *           example: false
 *         category_id:
 *           type: integer
 *           nullable: true
 *           description: 分类ID
 *           example: 1
 *         category_name:
 *           type: string
 *           nullable: true
 *           description: 分类名称
 *           example: "technology"
 *         category_display_name:
 *           type: string
 *           nullable: true
 *           description: 分类显示名称
 *           example: "科技"
 *         author_id:
 *           type: integer
 *           description: 作者ID
 *           example: 1
 *         author_username:
 *           type: string
 *           description: 作者用户名
 *           example: "admin"
 *         author_nickname:
 *           type: string
 *           description: 作者昵称
 *           example: "管理员"
 *         author_avatar_url:
 *           type: string
 *           format: uri
 *           description: 作者头像地址（若缺失则为自动生成的 UI Avatars 链接）
 *           example: "https://ui-avatars.com/api/?name=管理员&background=random&size=128"
 *         is_public:
 *           type: boolean
 *           description: 是否公开
 *           example: true
 *         is_free:
 *           type: boolean
 *           description: 是否免费
 *           example: false
 *         required_points:
 *           type: integer
 *           description: 所需积分
 *           example: 100
 *         view_count:
 *           type: integer
 *           description: 浏览次数
 *           example: 1250
 *         download_count:
 *           type: integer
 *           description: 下载次数
 *           example: 89
 *         like_count:
 *           type: integer
 *           description: 点赞次数
 *           example: 45
 *         status:
 *           type: string
 *           enum: [draft, published, archived, deleted]
 *           description: 资源状态
 *           example: "published"
 *         published_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: 发布时间
 *           example: "2025-09-12T08:00:00.000Z"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2025-09-11T10:00:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *           example: "2025-09-12T08:00:00.000Z"
 *         tags:
 *           type: array
 *           description: 标签列表
 *           items:
 *             $ref: '#/components/schemas/Tag'
 * 
 *     Tag:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - display_name
 *       properties:
 *         id:
 *           type: integer
 *           description: 标签ID
 *           example: 1
 *         name:
 *           type: string
 *           description: 标签名称
 *           example: "vue"
 *         display_name:
 *           type: string
 *           description: 标签显示名称
 *           example: "Vue.js"
 *         color:
 *           type: string
 *           description: 标签颜色
 *           example: "#4CAF50"
 * 
 *
 *     ResourceListParams:
 *       allOf:
 *         - $ref: '#/components/schemas/PaginationParams'
 *         - type: object
 *           properties:
 *             category_id:
 *               type: integer
 *               description: 分类ID过滤
 *               example: 1
 *             resource_type_id:
 *               type: integer
 *               description: 资源类型ID过滤
 *               example: 1
 *             author_id:
 *               type: integer
 *               description: 作者ID过滤
 *               example: 1
 *             status:
 *               type: string
 *               enum: [draft, published, archived, deleted]
 *               default: published
 *               description: 状态过滤
 *               example: "published"
 *             is_public:
 *               type: boolean
 *               description: 是否公开过滤
 *               example: true
 *             is_free:
 *               type: boolean
 *               description: 是否免费过滤
 *               example: false
 *             search:
 *               type: string
 *               description: 搜索关键词
 *               example: "Vue"
 *             tags:
 *               type: string
 *               description: 标签ID列表，逗号分隔
 *               example: "1,2,3"
 *             sort_by:
 *               type: string
 *               enum: [created_at, updated_at, published_at, view_count, download_count, like_count]
 *               default: created_at
 *               description: 排序字段
 *               example: "view_count"
 *             sort_order:
 *               type: string
 *               enum: [asc, desc]
 *               default: desc
 *               description: 排序方向
 *               example: "desc"
 * 
 *     ResourceListResponse:
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
 *                     $ref: '#/components/schemas/Resource'
 * 
 *     CreateResourceRequest:
 *       type: object
 *       required:
 *         - title
 *         - description
 *       properties:
 *         title:
 *           type: string
 *           minLength: 1
 *           maxLength: 200
 *           description: 资源标题
 *           example: "新的Vue.js教程"
 *         slug:
 *           type: string
 *           maxLength: 255
 *           description: URL标识符（可选，系统自动生成）
 *           example: "new-vue-tutorial"
 *         description:
 *           type: string
 *           minLength: 1
 *           description: 详细描述
 *           example: "这是一个全面的Vue.js学习教程"
 *         summary:
 *           type: string
 *           maxLength: 500
 *           description: 摘要
 *           example: "适合初学者的教程"
 *         cover_image_url:
 *           type: string
 *           format: uri
 *           description: 封面图片URL
 *           example: "https://example.com/cover.jpg"
 *         category_id:
 *           type: integer
 *           description: 分类ID
 *           example: 1
 *         resource_type_id:
 *           type: integer
 *           description: 资源类型ID
 *           example: 1
 *         is_public:
 *           type: boolean
 *           default: true
 *           description: 是否公开
 *           example: true
 *         is_free:
 *           type: boolean
 *           default: true
 *           description: 是否免费
 *           example: false
 *         required_points:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *           description: 所需积分
 *           example: 50
 *         tags:
 *           type: array
 *           items:
 *             type: integer
 *           description: 标签ID数组
 *           example: [1, 2, 3]
 * 
 *     UpdateResourceRequest:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           minLength: 1
 *           maxLength: 200
 *           description: 资源标题
 *           example: "更新的教程标题"
 *         description:
 *           type: string
 *           minLength: 1
 *           description: 详细描述
 *           example: "更新后的描述内容"
 *         summary:
 *           type: string
 *           maxLength: 500
 *           description: 摘要
 *           example: "更新的摘要"
 *         cover_image_url:
 *           type: string
 *           format: uri
 *           description: 封面图片URL
 *           example: "https://example.com/new-cover.jpg"
 *         category_id:
 *           type: integer
 *           description: 分类ID
 *           example: 2
 *         is_public:
 *           type: boolean
 *           description: 是否公开
 *           example: false
 *         is_free:
 *           type: boolean
 *           description: 是否免费
 *           example: true
 *         required_points:
 *           type: integer
 *           minimum: 0
 *           description: 所需积分
 *           example: 100
 *         tags:
 *           type: array
 *           items:
 *             type: integer
 *           description: 标签ID数组
 *           example: [1, 4, 5]
 */
