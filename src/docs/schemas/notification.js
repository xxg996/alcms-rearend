/**
 * @swagger
 * components:
 *   schemas:
 *     NotificationSender:
 *       type: object
 *       description: 通知发送者信息
 *       properties:
 *         id:
 *           type: integer
 *           description: 发送者ID
 *           example: 5
 *         username:
 *           type: string
 *           description: 发送者用户名
 *           example: "alice"
 *         nickname:
 *           type: string
 *           description: 发送者昵称
 *           example: "Alice"
 *         avatar_url:
 *           type: string
 *           format: uri
 *           description: 发送者头像地址
 *           example: "https://cdn.example.com/avatars/5.png"
 *
 *     Notification:
 *       type: object
 *       description: 通知基础信息
 *       properties:
 *         id:
 *           type: integer
 *           description: 通知ID
 *           example: 128
 *         user_id:
 *           type: integer
 *           description: 接收者用户ID
 *           example: 3
 *         type:
 *           type: string
 *           description: 通知类型，resource/community/system 对应分类
 *           example: "resource.comment"
 *         category:
 *           type: string
 *           description: 通知类别
 *           enum: [resource, community, system]
 *           example: "resource"
 *         title:
 *           type: string
 *           description: 通知标题
 *           example: "《高可用架构实践》收到新的评论"
 *         content:
 *           type: string
 *           description: 通知原始内容（JSON字符串或纯文本）
 *         metadata:
 *           type: object
 *           description: 通知内容解析结果
 *           example:
 *             commentId: 512
 *             resourceId: 88
 *             preview: "写得太赞了！"
 *         related_type:
 *           type: string
 *           description: 关联资源类型
 *           example: "resource_comment"
 *         related_id:
 *           type: integer
 *           description: 关联资源ID
 *           example: 512
 *         sender_id:
 *           type: integer
 *           description: 发送者ID
 *           example: 5
 *         sender:
 *           $ref: '#/components/schemas/NotificationSender'
 *         is_read:
 *           type: boolean
 *           description: 是否已读
 *           example: false
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 通知创建时间
 *           example: "2025-09-24T03:58:41.321Z"
 *
 *     NotificationDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/Notification'
 *         - type: object
 *           properties:
 *             detail:
 *               type: object
 *               description: 通知关联对象的补充信息
 *               nullable: true
 *               example:
 *                 id: 512
 *                 content: "写得太赞了！"
 *                 resource_id: 88
 *                 resource_title: "高可用架构实践"
 *
 *     NotificationListResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               required:
 *                 - data
 *                 - pagination
 *               properties:
 *                 data:
 *                   type: array
 *                   description: 通知列表
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *
 *     NotificationDetailResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               $ref: '#/components/schemas/NotificationDetail'
 *
 *     NotificationMarkRequest:
 *       type: object
 *       description: 通知已读状态设置
 *       properties:
 *         is_read:
 *           type: boolean
 *           description: 目标状态，默认 true
 *           example: true
 *
 *     NotificationBatchMarkRequest:
 *       type: object
 *       description: 批量通知已读状态设置
 *       properties:
 *         ids:
 *           type: array
 *           description: 需要更新的通知ID列表
 *           items:
 *             type: integer
 *           example: [128, 129, 135]
 *         category:
 *           type: string
 *           description: 限定通知类别
 *           enum: [resource, community, system]
 *           example: "resource"
 *         is_read:
 *           type: boolean
 *           description: 目标状态，默认 true
 *           example: true
 */
