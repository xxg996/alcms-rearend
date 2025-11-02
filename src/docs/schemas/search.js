/**
 * @swagger
 * components:
 *   schemas:
 *     HotSearchItem:
 *       type: object
 *       properties:
 *         keyword:
 *           type: string
 *           description: 搜索关键词原文
 *           example: "vue"
 *         normalized_keyword:
 *           type: string
 *           description: 标准化后的关键词（小写）
 *           example: "vue"
 *         search_type:
 *           type: string
 *           enum: [resource, community]
 *           description: 搜索类型
 *           example: "resource"
 *         search_count:
 *           type: integer
 *           description: 搜索次数
 *           example: 128
 *         last_searched_at:
 *           type: string
 *           format: date-time
 *           description: 最近一次搜索时间
 *           example: "2025-10-31T12:45:00.000Z"
 *
 *     HotSearchList:
 *       type: object
 *       properties:
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/HotSearchItem'
 *       example:
 *         items:
 *           - keyword: "vue"
 *             normalized_keyword: "vue"
 *             search_type: "resource"
 *             search_count: 128
 *             last_searched_at: "2025-10-31T12:45:00.000Z"
 *           - keyword: "开源社区"
 *             normalized_keyword: "开源社区"
 *             search_type: "community"
 *             search_count: 56
 *             last_searched_at: "2025-10-31T09:10:00.000Z"
 */
