/**
 * @swagger
 * components:
 *   schemas:
 *     ApiResponse:
 *       type: object
 *       required:
 *         - success
 *         - message
 *       properties:
 *         success:
 *           type: boolean
 *           description: 请求是否成功
 *           example: true
 *         message:
 *           type: string
 *           description: 响应消息
 *           example: "操作成功"
 *         data:
 *           type: object
 *           description: 响应数据（可选）
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: 响应时间戳
 *           example: "2025-09-12T12:00:00.000Z"
 * 
 *     PaginationParams:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           description: 页码
 *           example: 1
 *         limit:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *           description: 每页数量
 *           example: 20
 * 
 *     PaginationInfo:
 *       type: object
 *       required:
 *         - page
 *         - limit
 *         - total
 *         - totalPages
 *         - hasNext
 *         - hasPrev
 *       properties:
 *         page:
 *           type: integer
 *           description: 当前页码
 *           example: 1
 *         limit:
 *           type: integer
 *           description: 每页数量
 *           example: 20
 *         total:
 *           type: integer
 *           description: 总记录数
 *           example: 100
 *         totalPages:
 *           type: integer
 *           description: 总页数
 *           example: 5
 *         hasNext:
 *           type: boolean
 *           description: 是否有下一页
 *           example: true
 *         hasPrev:
 *           type: boolean
 *           description: 是否有上一页
 *           example: false
 * 
 *     PaginatedResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/ApiResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               required:
 *                 - items
 *                 - pagination
 *               properties:
 *                 items:
 *                   type: array
 *                   description: 数据项列表
 *                   items:
 *                     type: object
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 * 
 *     SuccessResponse:
 *       type: object
 *       required:
 *         - success
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           description: 成功消息
 *           example: "操作成功"
 *         data:
 *           type: object
 *           description: 响应数据（可选）
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: 响应时间戳
 *           example: "2025-09-12T12:00:00.000Z"
 * 
 *     ErrorResponse:
 *       type: object
 *       required:
 *         - success
 *         - message
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           description: 错误消息
 *           example: "操作失败"
 *         details:
 *           type: string
 *           description: 错误详情（可选）
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2025-09-12T12:00:00.000Z"
 * 
 *     ValidationErrorResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/ErrorResponse'
 *         - type: object
 *           properties:
 *             errors:
 *               type: array
 *               description: 验证错误详情
 *               items:
 *                 type: object
 *                 properties:
 *                   field:
 *                     type: string
 *                     description: 字段名
 *                     example: "email"
 *                   message:
 *                     type: string
 *                     description: 错误信息
 *                     example: "邮箱格式不正确"
 */