/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - display_name
 *         - is_active
 *         - created_at
 *         - updated_at
 *       properties:
 *         id:
 *           type: integer
 *           description: 分类ID
 *           example: 1
 *         name:
 *           type: string
 *           description: 分类名称（用于URL）
 *           example: "technology"
 *         display_name:
 *           type: string
 *           description: 分类显示名称
 *           example: "科技"
 *         description:
 *           type: string
 *           nullable: true
 *           description: 分类描述
 *           example: "科技相关的资源和内容"
 *         parent_id:
 *           type: integer
 *           nullable: true
 *           description: 父分类ID
 *           example: null
 *         sort_order:
 *           type: integer
 *           description: 排序权重
 *           example: 0
 *         icon_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: 分类图标URL
 *           example: "https://example.com/icons/tech.svg"
 *         is_active:
 *           type: boolean
 *           description: 是否启用
 *           example: true
 *         resource_count:
 *           type: integer
 *           description: 该分类下的资源数量
 *           example: 25
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
 *         children:
 *           type: array
 *           description: 子分类列表（仅在树形结构时返回）
 *           items:
 *             $ref: '#/components/schemas/Category'
 *         path:
 *           type: array
 *           description: 分类路径（面包屑）
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               name:
 *                 type: string
 *               display_name:
 *                 type: string
 * 
 *     CategoryTree:
 *       type: array
 *       items:
 *         $ref: '#/components/schemas/Category'
 *       description: 分类树形结构
 * 
 *     CreateCategoryRequest:
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
 *           description: 分类名称（小写字母、数字、连字符）
 *           example: "web-development"
 *         displayName:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: 分类显示名称
 *           example: "Web开发"
 *         description:
 *           type: string
 *           maxLength: 500
 *           description: 分类描述
 *           example: "Web开发相关的教程和资源"
 *         parentId:
 *           type: integer
 *           description: 父分类ID
 *           example: 1
 *         sortOrder:
 *           type: integer
 *           default: 0
 *           description: 排序权重
 *           example: 10
 *         iconUrl:
 *           type: string
 *           format: uri
 *           description: 分类图标URL
 *           example: "https://example.com/icons/web.svg"
 * 
 *     UpdateCategoryRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *           pattern: '^[a-z0-9-_]+$'
 *           description: 分类名称
 *           example: "updated-category"
 *         displayName:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: 分类显示名称
 *           example: "更新的分类"
 *         description:
 *           type: string
 *           maxLength: 500
 *           description: 分类描述
 *           example: "更新的分类描述"
 *         parentId:
 *           type: integer
 *           nullable: true
 *           description: 父分类ID
 *           example: 2
 *         sortOrder:
 *           type: integer
 *           description: 排序权重
 *           example: 20
 *         iconUrl:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: 分类图标URL
 *           example: "https://example.com/icons/updated.svg"
 *         isActive:
 *           type: boolean
 *           description: 是否启用
 *           example: true
 * 
 *     CategoryListResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/SuccessResponse'
 *         - type: object
 *           properties:
 *             data:
 *               oneOf:
 *                 - $ref: '#/components/schemas/CategoryTree'
 *                 - type: array
 *                   items:
 *                     $ref: '#/components/schemas/Category'
 * 
 *     PopularCategory:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: 分类ID
 *           example: 1
 *         name:
 *           type: string
 *           description: 分类名称
 *           example: "technology"
 *         display_name:
 *           type: string
 *           description: 分类显示名称
 *           example: "科技"
 *         resource_count:
 *           type: integer
 *           description: 资源数量
 *           example: 150
 *         icon_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: 分类图标URL
 *           example: "https://example.com/icons/tech.svg"
 */