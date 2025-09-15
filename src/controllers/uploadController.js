/**
 * @fileoverview 文件上传控制器 (已弃用直接上传，请使用预签名上传)
 * @description 处理文件删除等操作，上传功能已迁移到预签名上传
 * @module uploadController
 */

const UploadService = require('../services/UploadService');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/upload/delete:
 *   post:
 *     tags: [文件上传]
 *     summary: 删除文件
 *     description: 从MinIO存储中删除指定文件 (适用于通过预签名上传的文件)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bucket
 *               - fileName
 *             properties:
 *               bucket:
 *                 type: string
 *                 description: 存储桶名称
 *                 example: "alcms-images"
 *               fileName:
 *                 type: string
 *                 description: 文件名称
 *                 example: "1709876543210_abc123def456.jpg"
 *     responses:
 *       200:
 *         description: 文件删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: 文件不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const deleteFile = async (req, res) => {
  try {
    const { bucket, fileName } = req.body;

    if (!bucket || !fileName) {
      return res.status(400).json({
        success: false,
        message: '存储桶名称和文件名称不能为空'
      });
    }

    await UploadService.deleteFile(bucket, fileName);

    res.json({
      success: true,
      message: '文件删除成功'
    });

  } catch (error) {
    logger.error('文件删除失败:', error);
    
    if (error.code === 'NoSuchKey') {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    res.status(400).json({
      success: false,
      message: error.message || '文件删除失败'
    });
  }
};

/**
 * @swagger
 * /api/upload/info:
 *   get:
 *     tags: [文件上传]
 *     summary: 获取上传配置信息
 *     description: 获取文件上传的配置信息和使用指南
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
 *                         maxFileSize:
 *                           type: integer
 *                           description: 最大文件大小(字节)
 *                           example: 10485760
 *                         maxFiles:
 *                           type: integer
 *                           description: 最大文件数量
 *                           example: 10
 *                         supportedMimeTypes:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: 支持的MIME类型列表
 *                         buckets:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: 可用的存储桶列表
 */
const getUploadInfo = async (req, res) => {
  try {
    res.json({
      success: true,
      message: '获取上传配置信息成功',
      data: {
        uploadMethod: '预签名上传 - 客户端直接上传到MinIO，不消耗服务器带宽',
        maxFileSizes: {
          image: 10 * 1024 * 1024, // 10MB
          avatar: 5 * 1024 * 1024  // 5MB
        },
        supportedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        description: '只支持图片文件上传 (JPG, PNG, GIF, WebP)',
        endpoints: {
          presignedUpload: {
            info: '/api/upload/presigned/info - 预签名配置信息',
            image: '/api/upload/presigned/image - 获取图片预签名URL',
            avatar: '/api/upload/presigned/avatar - 获取头像预签名URL'
          },
          fileManagement: {
            delete: '/api/upload/delete - 删除文件'
          }
        }
      }
    });

  } catch (error) {
    logger.error('获取上传配置信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取上传配置信息失败'
    });
  }
};

module.exports = {
  deleteFile,
  getUploadInfo
};