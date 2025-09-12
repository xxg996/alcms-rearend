/**
 * @swagger
 * components:
 *   schemas:
 *     Tag:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - display_name
 *         - color
 *         - created_at
 *         - updated_at
 *       properties:
 *         id:
 *           type: integer
 *           description: 标签ID
 *           example: 1
 *         name:
 *           type: string
 *           description: 标签名称（用于URL和查询）
 *           example: "vue"
 *         display_name:
 *           type: string
 *           description: 标签显示名称
 *           example: "Vue.js"
 *         description:
 *           type: string
 *           nullable: true
 *           description: 标签描述
 *           example: "Vue.js 相关的资源和教程"
 *         color:
 *           type: string
 *           description: 标签颜色（十六进制）
 *           example: "#4CAF50"
 *         usage_count:
 *           type: integer
 *           description: 标签使用次数
 *           example: 150
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2025-09-11T08:00:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *           example: "2025-09-12T10:00:00.000Z"
 * 
 *     CreateTagRequest:
 *       type: object
 *       required:
 *         - name
 *         - displayName
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *           pattern: '^[a-z0-9-_]+$'
 *           description: 标签名称（小写字母、数字、连字符）
 *           example: "javascript"
 *         displayName:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: 标签显示名称
 *           example: "JavaScript"
 *         description:
 *           type: string
 *           maxLength: 500
 *           description: 标签描述
 *           example: "JavaScript 编程语言相关内容"
 *         color:
 *           type: string
 *           pattern: '^#[0-9A-Fa-f]{6}$'
 *           default: "#007bff"
 *           description: 标签颜色（十六进制格式）
 *           example: "#f39c12"
 * 
 *     UpdateTagRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *           pattern: '^[a-z0-9-_]+$'
 *           description: 标签名称
 *           example: "updated-tag"
 *         displayName:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: 标签显示名称
 *           example: "更新的标签"
 *         description:
 *           type: string
 *           maxLength: 500
 *           description: 标签描述
 *           example: "更新的标签描述"
 *         color:
 *           type: string
 *           pattern: '^#[0-9A-Fa-f]{6}$'
 *           description: 标签颜色
 *           example: "#e74c3c"
 * 
 *     CreateTagsRequest:
 *       type: object
 *       required:
 *         - tags
 *       properties:
 *         tags:
 *           type: array
 *           minItems: 1
 *           maxItems: 50
 *           description: 标签数据数组
 *           items:
 *             $ref: '#/components/schemas/CreateTagRequest'
 *           example:
 *             - name: "react"
 *               displayName: "React"
 *               description: "React 前端框架"
 *               color: "#61dafb"
 *             - name: "nodejs"
 *               displayName: "Node.js"
 *               description: "Node.js 后端技术"
 *               color: "#68a063"
 * 
 *     TagListResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 tags:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tag'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 * 
 *     TagSearchResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 tags:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tag'
 *                 query:
 *                   type: string
 *                   description: 搜索关键词
 *                   example: "vue"
 * 
 *     CreateTagsResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 created:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tag'
 *                   description: 成功创建的标签列表
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       tag:
 *                         type: object
 *                         description: 失败的标签数据
 *                       error:
 *                         type: string
 *                         description: 错误信息
 *                   description: 创建失败的标签列表（可选）
 * 
 *     PopularTag:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: 标签ID
 *           example: 1
 *         name:
 *           type: string
 *           description: 标签名称
 *           example: "javascript"
 *         display_name:
 *           type: string
 *           description: 标签显示名称
 *           example: "JavaScript"
 *         color:
 *           type: string
 *           description: 标签颜色
 *           example: "#f39c12"
 *         usage_count:
 *           type: integer
 *           description: 使用次数
 *           example: 250
 */