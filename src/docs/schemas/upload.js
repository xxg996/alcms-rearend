/**
 * @swagger
 * components:
 *   schemas:
 *     FileUploadResponse:
 *       type: object
 *       properties:
 *         fileName:
 *           type: string
 *           description: 存储的文件名
 *           example: "1709876543210_abc123def456.jpg"
 *         originalName:
 *           type: string
 *           description: 原始文件名
 *           example: "avatar.jpg"
 *         url:
 *           type: string
 *           description: 文件访问URL
 *           example: "http://minio.example.com:9000/alcms-images/1709876543210_abc123def456.jpg"
 *         bucket:
 *           type: string
 *           description: 存储桶名称
 *           example: "alcms-images"
 *         size:
 *           type: integer
 *           description: 文件大小(字节)
 *           example: 102400
 *         mimeType:
 *           type: string
 *           description: 文件MIME类型
 *           example: "image/jpeg"
 *         etag:
 *           type: string
 *           description: 文件ETag
 *           example: "d41d8cd98f00b204e9800998ecf8427e"
 * 
 *     MultipleUploadResponse:
 *       type: object
 *       properties:
 *         successful:
 *           type: array
 *           description: 上传成功的文件列表
 *           items:
 *             $ref: '#/components/schemas/FileUploadResponse'
 *         failed:
 *           type: array
 *           description: 上传失败的文件列表
 *           items:
 *             type: object
 *             properties:
 *               fileName:
 *                 type: string
 *                 description: 文件名
 *               error:
 *                 type: string
 *                 description: 错误信息
 *         total:
 *           type: integer
 *           description: 总文件数量
 *           example: 5
 *         successCount:
 *           type: integer
 *           description: 成功上传文件数量
 *           example: 4
 *         failureCount:
 *           type: integer
 *           description: 上传失败文件数量
 *           example: 1
 * 
 *     DeleteFileRequest:
 *       type: object
 *       required:
 *         - bucket
 *         - fileName
 *       properties:
 *         bucket:
 *           type: string
 *           description: 存储桶名称
 *           example: "alcms-images"
 *         fileName:
 *           type: string
 *           description: 文件名称
 *           example: "1709876543210_abc123def456.jpg"
 * 
 *     UploadConfigResponse:
 *       type: object
 *       properties:
 *         maxFileSize:
 *           type: integer
 *           description: 最大文件大小(字节)
 *           example: 10485760
 *         maxFiles:
 *           type: integer
 *           description: 最大文件数量
 *           example: 10
 *         supportedMimeTypes:
 *           type: array
 *           items:
 *             type: string
 *           description: 支持的MIME类型列表
 *           example: ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]
 *         buckets:
 *           type: array
 *           items:
 *             type: string
 *           description: 可用的存储桶列表
 *           example: ["images", "documents", "avatars"]
 * 
 *     AvatarUploadResponse:
 *       type: object
 *       properties:
 *         avatarUrl:
 *           type: string
 *           description: 头像访问URL
 *           example: "http://minio.example.com:9000/alcms-avatars/1709876543210_abc123def456.jpg"
 *         fileName:
 *           type: string
 *           description: 存储的文件名
 *           example: "1709876543210_abc123def456.jpg"
 *         size:
 *           type: integer
 *           description: 文件大小
 *           example: 51200
 */