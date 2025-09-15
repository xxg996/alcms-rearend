/**
 * @fileoverview 预签名上传控制器
 * @description 处理预签名URL生成，客户端直接上传到MinIO
 * @module presignedUploadController
 */

const PresignedUploadService = require('../services/PresignedUploadService');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/upload/presigned/image:
 *   post:
 *     tags: [文件上传]
 *     summary: 获取图片上传预签名URL
 *     description: 获取预签名URL，客户端直接上传到MinIO，不消耗服务器带宽，上传速度更快
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileName
 *               - contentType
 *             properties:
 *               fileName:
 *                 type: string
 *                 description: 原始文件名
 *                 example: "my-image.jpg"
 *               contentType:
 *                 type: string
 *                 enum: [image/jpeg, image/jpg, image/png, image/gif, image/webp]
 *                 description: 文件MIME类型
 *                 example: "image/jpeg"
 *     responses:
 *       200:
 *         description: 预签名URL生成成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         uploadUrl:
 *                           type: string
 *                           description: 上传URL
 *                           example: "http://minio.example.com:9000/alcms-images"
 *                         formData:
 *                           type: object
 *                           description: 上传表单数据
 *                           additionalProperties: true
 *                         fileName:
 *                           type: string
 *                           description: 生成的唯一文件名
 *                           example: "1709876543210_abc123def456.jpg"
 *                         fileUrl:
 *                           type: string
 *                           description: 上传完成后的访问URL
 *                           example: "http://minio.example.com:9000/alcms-images/1709876543210_abc123def456.jpg"
 *                         bucket:
 *                           type: string
 *                           description: 存储桶名称
 *                           example: "alcms-images"
 *                         expiresIn:
 *                           type: integer
 *                           description: 预签名URL有效期(秒)
 *                           example: 900
 *                         maxSize:
 *                           type: integer
 *                           description: 最大文件大小(字节)
 *                           example: 10485760
 *             example:
 *               success: true
 *               message: "图片预签名URL生成成功"
 *               data:
 *                 uploadUrl: "http://minio.example.com:9000/alcms-images"
 *                 formData:
 *                   key: "1709876543210_abc123def456.jpg"
 *                   policy: "eyJleHBpcmF0aW9uIjoi..."
 *                   "x-amz-algorithm": "AWS4-HMAC-SHA256"
 *                   "x-amz-credential": "minioadmin/20240101/us-east-1/s3/aws4_request"
 *                   "x-amz-date": "20240101T000000Z"
 *                   "x-amz-signature": "abc123..."
 *                 fileName: "1709876543210_abc123def456.jpg"
 *                 fileUrl: "http://minio.example.com:9000/alcms-images/1709876543210_abc123def456.jpg"
 *                 bucket: "alcms-images"
 *                 expiresIn: 900
 *                 maxSize: 10485760
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getImagePresignedUrl = async (req, res) => {
  try {
    const { fileName, contentType } = req.body;

    if (!fileName || !contentType) {
      return res.status(400).json({
        success: false,
        message: '文件名和内容类型不能为空'
      });
    }

    const result = await PresignedUploadService.generateImageUploadUrl(fileName, contentType);

    res.json({
      success: true,
      message: '图片预签名URL生成成功',
      data: result
    });

  } catch (error) {
    logger.error('获取图片预签名URL失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '获取图片预签名URL失败'
    });
  }
};

/**
 * @swagger
 * /api/upload/presigned/avatar:
 *   post:
 *     tags: [文件上传]
 *     summary: 获取头像上传预签名URL
 *     description: 获取头像上传预签名URL，客户端直接上传到MinIO，不消耗服务器带宽
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileName
 *               - contentType
 *             properties:
 *               fileName:
 *                 type: string
 *                 description: 原始文件名
 *                 example: "avatar.png"
 *               contentType:
 *                 type: string
 *                 enum: [image/jpeg, image/jpg, image/png, image/gif, image/webp]
 *                 description: 文件MIME类型
 *                 example: "image/png"
 *     responses:
 *       200:
 *         description: 头像预签名URL生成成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         uploadUrl:
 *                           type: string
 *                           description: 上传URL
 *                         formData:
 *                           type: object
 *                           description: 上传表单数据
 *                           additionalProperties: true
 *                         fileName:
 *                           type: string
 *                           description: 生成的唯一文件名
 *                         fileUrl:
 *                           type: string
 *                           description: 上传完成后的访问URL
 *                         bucket:
 *                           type: string
 *                           description: 存储桶名称
 *                         expiresIn:
 *                           type: integer
 *                           description: 预签名URL有效期(秒)
 *                         maxSize:
 *                           type: integer
 *                           description: 最大文件大小(字节，头像限制5MB)
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getAvatarPresignedUrl = async (req, res) => {
  try {
    const { fileName, contentType } = req.body;

    if (!fileName || !contentType) {
      return res.status(400).json({
        success: false,
        message: '文件名和内容类型不能为空'
      });
    }

    const result = await PresignedUploadService.generateAvatarUploadUrl(fileName, contentType);

    res.json({
      success: true,
      message: '头像预签名URL生成成功',
      data: result
    });

  } catch (error) {
    logger.error('获取头像预签名URL失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '获取头像预签名URL失败'
    });
  }
};

/**
 * @swagger
 * /api/upload/presigned/info:
 *   get:
 *     tags: [文件上传]
 *     summary: 获取预签名上传配置信息
 *     description: 获取预签名上传的配置信息、使用说明和最佳实践
 *     responses:
 *       200:
 *         description: 获取配置信息成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         maxFileSizes:
 *                           type: object
 *                           properties:
 *                             image:
 *                               type: integer
 *                               example: 10485760
 *                             avatar:
 *                               type: integer
 *                               example: 5242880
 *                         supportedMimeTypes:
 *                           type: array
 *                           items:
 *                             type: string
 *                         urlExpiresIn:
 *                           type: integer
 *                           description: 预签名URL有效期(秒)
 *                           example: 900
 *                         endpoints:
 *                           type: object
 *                           properties:
 *                             image:
 *                               type: string
 *                             avatar:
 *                               type: string
 *                         usage:
 *                           type: string
 *                           description: 使用说明
 */
const getPresignedInfo = async (req, res) => {
  try {
    const supportedMimeTypes = PresignedUploadService.getSupportedImageTypes();
    
    res.json({
      success: true,
      message: '获取预签名上传配置信息成功',
      data: {
        maxFileSizes: {
          image: 10 * 1024 * 1024, // 10MB
          avatar: 5 * 1024 * 1024  // 5MB
        },
        supportedMimeTypes,
        urlExpiresIn: 15 * 60, // 15分钟
        endpoints: {
          image: '/api/upload/presigned/image - 获取图片上传预签名URL',
          avatar: '/api/upload/presigned/avatar - 获取头像上传预签名URL'
        }
      }
    });

  } catch (error) {
    logger.error('获取预签名配置信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取预签名配置信息失败'
    });
  }
};

module.exports = {
  getImagePresignedUrl,
  getAvatarPresignedUrl,
  getPresignedInfo
};