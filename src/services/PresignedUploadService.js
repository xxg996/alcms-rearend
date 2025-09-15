/**
 * 预签名上传服务
 * 生成预签名URL让客户端直接上传到MinIO，避免走服务器带宽
 */

const { minioClient, BUCKETS, getFileUrl, generateFileName } = require('../config/minio');
const { logger } = require('../utils/logger');

class PresignedUploadService {
  /**
   * 生成图片上传的预签名URL
   * @param {string} originalFileName - 原始文件名
   * @param {string} contentType - 文件MIME类型
   * @returns {Promise<Object>} 预签名URL信息
   */
  async generateImageUploadUrl(originalFileName, contentType) {
    try {
      // 验证文件类型
      this.validateImageType(contentType);
      
      // 验证文件名安全性
      this.validateFileName(originalFileName);
      
      // 验证文件扩展名与MIME类型匹配
      this.validateFileTypeMatch(originalFileName, contentType);

      // 生成唯一文件名
      const fileName = generateFileName(originalFileName);
      const bucket = BUCKETS.IMAGES;

      // 生成预签名PUT URL，有效期15分钟
      const presignedUrl = await minioClient.presignedPutObject(
        bucket,
        fileName,
        15 * 60 // 15分钟
      );

      // 生成文件访问URL
      const fileUrl = getFileUrl(bucket, fileName);

      const result = {
        uploadUrl: presignedUrl,
        fileName,
        fileUrl,
        bucket,
        expiresIn: 15 * 60, // 15分钟
        maxSize: 10 * 1024 * 1024,
        contentType,
        method: 'PUT'
      };

      logger.info(`生成图片预签名URL成功: ${originalFileName} -> ${fileName}`);
      return result;

    } catch (error) {
      logger.error('生成图片预签名URL失败:', error);
      throw error;
    }
  }

  /**
   * 生成头像上传的预签名URL
   * @param {string} originalFileName - 原始文件名
   * @param {string} contentType - 文件MIME类型
   * @returns {Promise<Object>} 预签名URL信息
   */
  async generateAvatarUploadUrl(originalFileName, contentType) {
    try {
      // 验证文件类型
      this.validateImageType(contentType);
      
      // 验证文件名安全性
      this.validateFileName(originalFileName);
      
      // 验证文件扩展名与MIME类型匹配
      this.validateFileTypeMatch(originalFileName, contentType);

      // 生成唯一文件名
      const fileName = generateFileName(originalFileName);
      const bucket = BUCKETS.AVATARS;

      // 生成预签名PUT URL，有效期15分钟
      const presignedUrl = await minioClient.presignedPutObject(
        bucket,
        fileName,
        15 * 60 // 15分钟
      );

      // 生成文件访问URL
      const fileUrl = getFileUrl(bucket, fileName);

      const result = {
        uploadUrl: presignedUrl,
        fileName,
        fileUrl,
        bucket,
        expiresIn: 15 * 60,
        maxSize: 5 * 1024 * 1024, // 头像限制5MB
        contentType,
        method: 'PUT'
      };

      logger.info(`生成头像预签名URL成功: ${originalFileName} -> ${fileName}`);
      return result;

    } catch (error) {
      logger.error('生成头像预签名URL失败:', error);
      throw error;
    }
  }

  /**
   * 验证是否为图片类型
   * @param {string} contentType - MIME类型
   */
  validateImageType(contentType) {
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'
    ];

    if (!allowedTypes.includes(contentType)) {
      throw new Error(`不支持的图片类型: ${contentType}。支持的类型: ${allowedTypes.join(', ')}`);
    }
  }

  /**
   * 验证文件名安全性
   * @param {string} fileName - 文件名
   */
  validateFileName(fileName) {
    if (!fileName || typeof fileName !== 'string') {
      throw new Error('文件名不能为空');
    }

    if (!/^[\w\-. ]+$/.test(fileName)) {
      throw new Error('文件名包含非法字符，只允许字母、数字、下划线、连字符、点和空格');
    }

    if (fileName.length > 255) {
      throw new Error('文件名不能超过255个字符');
    }
  }

  /**
   * 验证文件扩展名与MIME类型匹配
   * @param {string} fileName - 文件名
   * @param {string} contentType - MIME类型
   */
  validateFileTypeMatch(fileName, contentType) {
    const extension = fileName.toLowerCase().split('.').pop();
    
    const mimeExtensionMap = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/jpg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/gif': ['gif'],
      'image/webp': ['webp']
    };

    const allowedExtensions = mimeExtensionMap[contentType];
    if (!allowedExtensions || !allowedExtensions.includes(extension)) {
      throw new Error(`文件扩展名 .${extension} 与声明的类型 ${contentType} 不匹配。支持的扩展名: ${allowedExtensions ? allowedExtensions.map(ext => '.' + ext).join(', ') : '无'}`);
    }
  }

  /**
   * 获取支持的图片类型
   * @returns {Array} 支持的MIME类型列表
   */
  getSupportedImageTypes() {
    return [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'
    ];
  }
}

module.exports = new PresignedUploadService();