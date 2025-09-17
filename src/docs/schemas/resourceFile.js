/**
 * @swagger
 * components:
 *   schemas:
 *     ResourceFile:
 *       type: object
 *       required:
 *         - id
 *         - resource_id
 *         - name
 *         - url
 *         - created_at
 *         - updated_at
 *       properties:
 *         id:
 *           type: integer
 *           description: 文件ID
 *           example: 1
 *         resource_id:
 *           type: integer
 *           description: 绑定的资源ID
 *           example: 123
 *         name:
 *           type: string
 *           description: 文件名称
 *           example: "高清视频下载"
 *         url:
 *           type: string
 *           format: uri
 *           description: 文件下载地址
 *           example: "https://example.com/files/video.mp4"
 *         file_size:
 *           type: integer
 *           description: 文件大小（字节）
 *           example: 1073741824
 *         file_type:
 *           type: string
 *           description: 文件类型
 *           example: "video"
 *         file_extension:
 *           type: string
 *           description: 文件扩展名
 *           example: "mp4"
 *         quality:
 *           type: string
 *           nullable: true
 *           description: 文件质量
 *           example: "1080p"
 *         version:
 *           type: string
 *           nullable: true
 *           description: 版本信息
 *           example: "v1.0"
 *         language:
 *           type: string
 *           nullable: true
 *           description: 语言版本
 *           example: "zh-CN"
 *         is_active:
 *           type: boolean
 *           description: 是否启用
 *           example: true
 *         sort_order:
 *           type: integer
 *           description: 排序顺序
 *           example: 0
 *         download_count:
 *           type: integer
 *           description: 下载次数
 *           example: 1500
 *         last_downloaded_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: 最后下载时间
 *           example: "2025-09-17T10:30:00.000Z"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2025-09-17T08:00:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *           example: "2025-09-17T10:00:00.000Z"
 *         deleted_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: 删除时间（软删除）
 *           example: null
 *
 *     CreateResourceFileRequest:
 *       type: object
 *       required:
 *         - name
 *         - url
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 255
 *           description: 文件名称
 *           example: "高清视频下载"
 *         url:
 *           type: string
 *           format: uri
 *           maxLength: 1000
 *           description: 文件下载地址
 *           example: "https://example.com/files/video.mp4"
 *         file_size:
 *           type: integer
 *           minimum: 0
 *           description: 文件大小（字节）
 *           example: 1073741824
 *         file_type:
 *           type: string
 *           maxLength: 50
 *           description: 文件类型
 *           example: "video"
 *         file_extension:
 *           type: string
 *           maxLength: 10
 *           description: 文件扩展名
 *           example: "mp4"
 *         quality:
 *           type: string
 *           maxLength: 20
 *           description: 文件质量
 *           example: "1080p"
 *         version:
 *           type: string
 *           maxLength: 50
 *           description: 版本信息
 *           example: "v1.0"
 *         language:
 *           type: string
 *           maxLength: 10
 *           description: 语言版本
 *           example: "zh-CN"
 *         sort_order:
 *           type: integer
 *           minimum: 0
 *           description: 排序顺序
 *           example: 0
 *
 *     UpdateResourceFileRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 255
 *           description: 文件名称
 *           example: "更新的文件名"
 *         url:
 *           type: string
 *           format: uri
 *           maxLength: 1000
 *           description: 文件下载地址
 *           example: "https://example.com/files/updated-video.mp4"
 *         file_size:
 *           type: integer
 *           minimum: 0
 *           description: 文件大小（字节）
 *           example: 2147483648
 *         file_type:
 *           type: string
 *           maxLength: 50
 *           description: 文件类型
 *           example: "video"
 *         file_extension:
 *           type: string
 *           maxLength: 10
 *           description: 文件扩展名
 *           example: "mp4"
 *         quality:
 *           type: string
 *           maxLength: 20
 *           description: 文件质量
 *           example: "4K"
 *         version:
 *           type: string
 *           maxLength: 50
 *           description: 版本信息
 *           example: "v2.0"
 *         language:
 *           type: string
 *           maxLength: 10
 *           description: 语言版本
 *           example: "en-US"
 *         is_active:
 *           type: boolean
 *           description: 是否启用
 *           example: true
 *         sort_order:
 *           type: integer
 *           minimum: 0
 *           description: 排序顺序
 *           example: 1
 *
 *     ResourceFileStatistics:
 *       type: object
 *       properties:
 *         total_files:
 *           type: integer
 *           description: 总文件数
 *           example: 1500
 *         active_files:
 *           type: integer
 *           description: 启用的文件数
 *           example: 1450
 *         total_downloads:
 *           type: integer
 *           description: 总下载次数
 *           example: 50000
 *         total_size:
 *           type: integer
 *           description: 总文件大小（字节）
 *           example: 107374182400
 *         file_types_count:
 *           type: integer
 *           description: 文件类型数量
 *           example: 8
 */