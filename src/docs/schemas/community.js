/**
 * 社区模块的数据模型定义
 * @swagger
 * components:
 *   schemas:
 *     CommunityBoard:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: 板块ID
 *           example: 1
 *         name:
 *           type: string
 *           description: 板块英文唯一名称
 *           example: "tech-discussion"
 *         display_name:
 *           type: string
 *           description: 板块显示名称
 *           example: "技术讨论"
 *         description:
 *           type: string
 *           description: 板块描述
 *           example: "技术相关话题讨论区"
 *         icon_url:
 *           type: string
 *           description: 板块图标URL
 *           example: "https://example.com/tech-icon.png"
 *         cover_image_url:
 *           type: string
 *           nullable: true
 *           description: 板块封面图URL
 *           example: "https://example.com/tech-cover.png"
 *         sort_order:
 *           type: integer
 *           description: 排序顺序
 *           example: 1
 *         is_active:
 *           type: boolean
 *           description: 是否激活
 *           example: true
 *         moderator_ids:
 *           type: array
 *           items:
 *             type: integer
 *           description: 版主用户ID列表
 *           example: [2, 3]
 *         post_count:
 *           type: integer
 *           description: 帖子数量
 *           example: 150
 *         comment_count:
 *           type: integer
 *           description: 评论数量
 *           example: 320
 *         last_post_at:
 *           type: string
 *           format: date-time
 *           description: 最后发帖时间
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *         moderators:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/User'
 *           description: 版主列表
 *
 *     CommunityPost:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: 帖子ID
 *           example: 1
 *         board_id:
 *           type: integer
 *           description: 所属板块ID
 *           example: 1
 *         author_id:
 *           type: integer
 *           description: 作者ID
 *           example: 123
 *         title:
 *           type: string
 *           description: 帖子标题
 *           example: "如何学习Node.js"
 *         content:
 *           type: string
 *           description: 帖子内容
 *           example: "这是一篇关于Node.js学习的帖子..."
 *         content_type:
 *           type: string
 *           enum: [text, markdown, html]
 *           description: 内容类型
 *           example: "markdown"
 *         status:
 *           type: string
 *           enum: [draft, published, hidden, locked]
 *           description: 帖子状态
 *           example: "published"
 *         is_pinned:
 *           type: boolean
 *           description: 是否置顶
 *           example: false
 *         is_featured:
 *           type: boolean
 *           description: 是否精华
 *           example: false
 *         is_locked:
 *           type: boolean
 *           description: 是否锁定
 *           example: false
 *         view_count:
 *           type: integer
 *           description: 浏览次数
 *           example: 100
 *         like_count:
 *           type: integer
 *           description: 点赞数
 *           example: 25
 *         reply_count:
 *           type: integer
 *           description: 回复数
 *           example: 10
 *         last_reply_at:
 *           type: string
 *           format: date-time
 *           description: 最后回复时间
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: 标签列表
 *           example: ["nodejs", "javascript", "教程"]
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *         author:
 *           $ref: '#/components/schemas/User'
 *           description: 作者信息
 *         board:
 *           $ref: '#/components/schemas/CommunityBoard'
 *           description: 板块信息
 *
 *     CommunityComment:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: 评论ID
 *           example: 1
 *         post_id:
 *           type: integer
 *           description: 所属帖子ID
 *           example: 1
 *         author_id:
 *           type: integer
 *           description: 评论者ID
 *           example: 456
 *         parent_id:
 *           type: integer
 *           nullable: true
 *           description: 父评论ID（回复）
 *           example: null
 *         content:
 *           type: string
 *           description: 评论内容
 *           example: "很有用的教程，感谢分享！"
 *         content_type:
 *           type: string
 *           enum: [text, markdown, html]
 *           description: 内容类型
 *           example: "text"
 *         status:
 *           type: string
 *           enum: [published, hidden, deleted]
 *           description: 评论状态
 *           example: "published"
 *         like_count:
 *           type: integer
 *           description: 点赞数
 *           example: 5
 *         reply_count:
 *           type: integer
 *           description: 回复数
 *           example: 2
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *         author:
 *           $ref: '#/components/schemas/User'
 *           description: 评论者信息
 *         children:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CommunityComment'
 *           description: 子评论列表
 *
 *     CommunityInteraction:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: 互动ID
 *           example: 1
 *         user_id:
 *           type: integer
 *           description: 用户ID
 *           example: 123
 *         target_type:
 *           type: string
 *           enum: [post, comment]
 *           description: 目标类型
 *           example: "post"
 *         target_id:
 *           type: integer
 *           description: 目标ID
 *           example: 1
 *         interaction_type:
 *           type: string
 *           enum: [like, favorite, share, report]
 *           description: 互动类型
 *           example: "like"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *
 *     CreateBoardRequest:
 *       type: object
 *       required:
 *         - name
 *         - display_name
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: 板块英文唯一名称（用于URL）
 *           example: "tech-discussion"
 *         display_name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: 板块显示名称
 *           example: "技术讨论"
 *         description:
 *           type: string
 *           maxLength: 500
 *           description: 板块描述
 *           example: "技术相关话题讨论区"
 *         icon_url:
 *           type: string
 *           maxLength: 500
 *           description: 板块图标URL
 *           example: "https://example.com/tech-icon.png"
 *         cover_image_url:
 *           type: string
 *           maxLength: 500
 *           description: 板块封面图URL
 *           example: "https://example.com/tech-cover.png"
 *         sort_order:
 *           type: integer
 *           minimum: 0
 *           description: 排序顺序
 *           example: 1
 *         is_active:
 *           type: boolean
 *           description: 是否激活
 *           example: true
 *         moderator_ids:
 *           type: array
 *           items:
 *             type: integer
 *           description: 版主用户ID列表
 *           example: [2, 3]
 *
 *     CreatePostRequest:
 *       type: object
 *       required:
 *         - board_id
 *         - title
 *         - content
 *       properties:
 *         board_id:
 *           type: integer
 *           description: 板块ID
 *           example: 1
 *         title:
 *           type: string
 *           minLength: 1
 *           maxLength: 200
 *           description: 帖子标题
 *           example: "Node.js学习心得"
*         content:
*           type: string
*           minLength: 1
*           description: 帖子内容
*           example: "分享一下我的Node.js学习经验..."
*         content_type:
*           type: string
*           enum: [text, markdown, html]
*           default: text
*           description: 内容类型
*           example: "markdown"
 *         summary:
 *           type: string
 *           maxLength: 500
 *           nullable: true
 *           description: 摘要（可选）
 *           example: "本文分享了从基础到进阶的学习路径"
*         tags:
*           type: array
*           items:
*             type: string
*           description: 标签列表
*           example: ["nodejs", "学习"]
 *         status:
 *           type: string
 *           enum: [draft, published]
 *           default: published
 *           description: 发布状态
 *           example: "published"
 *
 *     CreateCommentRequest:
 *       type: object
 *       required:
 *         - post_id
 *         - content
 *       properties:
 *         post_id:
 *           type: integer
 *           description: 帖子ID
 *           example: 1
 *         parent_id:
 *           type: integer
 *           nullable: true
 *           description: 父评论ID（回复）
 *           example: null
 *         content:
 *           type: string
 *           minLength: 1
 *           maxLength: 2000
 *           description: 评论内容
 *           example: "很有用的分享，谢谢！"
 *         content_type:
 *           type: string
 *           enum: [text, markdown, html]
 *           default: text
 *           description: 内容类型
 *           example: "text"
 *
 *     ToggleLikeRequest:
 *       type: object
 *       required:
 *         - target_type
 *         - target_id
 *       properties:
 *         target_type:
 *           type: string
 *           enum: [post, comment]
 *           description: 目标类型
 *           example: "post"
 *         target_id:
 *           type: integer
 *           description: 目标ID
 *           example: 1
 *
 *     ReportContentRequest:
 *       type: object
 *       required:
 *         - target_type
 *         - target_id
 *         - reason
 *       properties:
 *         target_type:
 *           type: string
 *           enum: [post, comment]
 *           description: 举报目标类型
 *           example: "post"
 *         target_id:
 *           type: integer
 *           description: 举报目标ID
 *           example: 1
 *         reason:
 *           type: string
 *           enum: [spam, inappropriate, harassment, fake, other]
 *           description: 举报原因
 *           example: "spam"
 *         description:
 *           type: string
 *           maxLength: 500
 *           description: 详细描述
 *           example: "这是垃圾信息"
 *
 *     CommunityStats:
 *       type: object
 *       properties:
 *         total_boards:
 *           type: integer
 *           description: 总板块数
 *           example: 10
 *         total_posts:
 *           type: integer
 *           description: 总帖子数
 *           example: 500
 *         total_comments:
 *           type: integer
 *           description: 总评论数
 *           example: 1500
 *         active_users:
 *           type: integer
 *           description: 活跃用户数
 *           example: 200
 *         posts_today:
 *           type: integer
 *           description: 今日发帖数
 *           example: 25
 *         hot_posts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CommunityPost'
 *           description: 热门帖子
 */

module.exports = {};
