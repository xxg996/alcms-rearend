/**
 * @swagger
 * components:
 *   schemas:
 *     ResourceComment:
 *       type: object
 *       required:
 *         - id
 *         - resource_id
 *         - user_id
 *         - content
 *         - is_approved
 *         - like_count
 *         - created_at
 *         - updated_at
 *       properties:
 *         id:
 *           type: integer
 *           description: 评论ID
 *           example: 1001
 *         resource_id:
 *           type: integer
 *           description: 资源ID
 *           example: 123
 *         user_id:
 *           type: integer
 *           description: 用户ID
 *           example: 456
 *         parent_id:
 *           type: integer
 *           nullable: true
 *           description: 父评论ID（子评论时使用）
 *           example: 999
 *         content:
 *           type: string
 *           description: 评论内容
 *           example: "这个资源很有用，谢谢分享！"
 *         is_approved:
 *           type: boolean
 *           description: 是否审核通过
 *           example: true
 *         like_count:
 *           type: integer
 *           description: 点赞数
 *           example: 15
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2025-01-20T10:30:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *           example: "2025-01-20T10:30:00.000Z"
 *         username:
 *           type: string
 *           description: 用户名
 *           example: "user123"
 *         nickname:
 *           type: string
 *           description: 用户昵称
 *           example: "小明"
 *         avatar_url:
 *           type: string
 *           nullable: true
 *           description: 用户头像URL
 *           example: "https://example.com/avatar.jpg"
 *         reply_count:
 *           type: integer
 *           description: 直接子回复数量
 *           example: 5
 *         replies:
 *           type: array
 *           description: 子评论列表（按时间顺序）
 *           items:
 *             $ref: '#/components/schemas/ResourceComment'
 *
 *     ResourceCommentDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/ResourceComment'
 *         - type: object
 *           properties:
 *             resource_title:
 *               type: string
 *               description: 资源标题
 *               example: "React高级开发教程"
 *             parent_content:
 *               type: string
 *               nullable: true
 *               description: 父评论内容（仅子评论显示）
 *               example: "我觉得这个教程还不错"
 *
 *     CreateCommentRequest:
 *       type: object
 *       required:
 *         - content
 *       properties:
 *         content:
 *           type: string
 *           minLength: 1
 *           maxLength: 1000
 *           description: 评论内容
 *           example: "这个资源很有用，谢谢分享！"
 *         parent_id:
 *           type: integer
 *           nullable: true
 *           description: 父评论ID（回复评论时使用）
 *           example: 123
 *
 *     UpdateCommentRequest:
 *       type: object
 *       required:
 *         - content
 *       properties:
 *         content:
 *           type: string
 *           minLength: 1
 *           maxLength: 1000
 *           description: 新的评论内容
 *           example: "更新后的评论内容"
 *
 *     ApproveCommentRequest:
 *       type: object
 *       required:
 *         - approved
 *       properties:
 *         approved:
 *           type: boolean
 *           description: 是否通过审核
 *           example: true
 *
 *     CommentStatistics:
 *       type: object
 *       properties:
 *         total_comments:
 *           type: integer
 *           description: 总评论数
 *           example: 150
 *         approved_comments:
 *           type: integer
 *           description: 已审核通过的评论数
 *           example: 140
 *         pending_comments:
 *           type: integer
 *           description: 待审核的评论数
 *           example: 10
 *         root_comments:
 *           type: integer
 *           description: 根评论数
 *           example: 85
 *         reply_comments:
 *           type: integer
 *           description: 回复评论数
 *           example: 65
 *
 *     CommentListResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 comments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ResourceComment'
 *                   description: 评论列表（包含嵌套子评论）
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *
 *     ReplyListResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 replies:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ResourceComment'
 *                   description: 回复列表
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *
 *     CommentDetailResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               $ref: '#/components/schemas/ResourceCommentDetail'
 *
 *     CommentStatisticsResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               $ref: '#/components/schemas/CommentStatistics'
 *
 *     LikeCommentResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 comment_id:
 *                   type: integer
 *                   description: 评论ID
 *                   example: 1001
 *                 like_count:
 *                   type: integer
 *                   description: 更新后的点赞数
 *                   example: 16
 */
