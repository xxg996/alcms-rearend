/**
 * @swagger
 * components:
 *   schemas:
 *     UserDownloadStats:
 *       type: object
 *       properties:
 *         daily:
 *           type: object
 *           description: 每日下载限制和使用情况
 *           properties:
 *             limit:
 *               type: integer
 *               description: 每日下载限制次数
 *               example: 100
 *             used:
 *               type: integer
 *               description: 今日已使用次数
 *               example: 15
 *             remaining:
 *               type: integer
 *               description: 今日剩余次数
 *               example: 85
 *             canDownload:
 *               type: boolean
 *               description: 是否还能下载
 *               example: true
 *         statistics:
 *           type: object
 *           description: 下载统计数据
 *           properties:
 *             today:
 *               type: integer
 *               description: 今日下载次数
 *               example: 15
 *             thisWeek:
 *               type: integer
 *               description: 本周下载次数
 *               example: 45
 *             thisMonth:
 *               type: integer
 *               description: 本月下载次数
 *               example: 120
 *             total:
 *               type: integer
 *               description: 总下载次数
 *               example: 500
 *
 *     DownloadRecord:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: 下载记录ID
 *           example: 1001
 *         user_id:
 *           type: integer
 *           description: 用户ID
 *           example: 123
 *         resource_id:
 *           type: integer
 *           description: 资源ID
 *           example: 456
 *         ip_address:
 *           type: string
 *           description: 下载IP地址
 *           example: "192.168.1.100"
 *         user_agent:
 *           type: string
 *           description: 用户代理
 *           example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
 *         download_url:
 *           type: string
 *           description: 实际下载链接
 *           example: "https://example.com/files/resource.pdf"
 *         expires_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: 链接过期时间
 *           example: "2025-09-17T15:30:00.000Z"
 *         is_successful:
 *           type: boolean
 *           description: 下载是否成功
 *           example: true
 *         downloaded_at:
 *           type: string
 *           format: date-time
 *           description: 下载时间
 *           example: "2025-09-17T14:30:00.000Z"
 */