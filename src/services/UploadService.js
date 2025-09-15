/**
 * 文件上传服务
 * 处理文件上传到MinIO存储的业务逻辑
 */

const { minioClient, BUCKETS, getFileUrl, generateFileName, getBucketByMimeType } = require('../config/minio');
const { logger } = require('../utils/logger');
const path = require('path');

class UploadService {
  /**
   * 上传单个文件到MinIO
   * @param {Object} file - multer处理后的文件对象
   * @param {string} bucketType - 存储桶类型 (可选)
   * @param {string} fileType - 文件类型限制 ('image', 'document', 'all')
   * @returns {Promise<Object>} 上传结果
   */
  async uploadFile(file, bucketType = null, fileType = 'all') {
    try {
      if (!file) {
        throw new Error('文件不能为空');
      }

      // 文件类型验证
      this.validateFile(file, fileType);

      // 确定存储桶
      const bucket = bucketType ? BUCKETS[bucketType.toUpperCase()] : getBucketByMimeType(file.mimetype);
      if (!bucket) {
        throw new Error('无效的存储桶类型');
      }

      // 生成唯一文件名
      const fileName = generateFileName(file.originalname);
      
      // 设置文件元数据
      const metaData = {
        'Content-Type': file.mimetype,
        'Original-Name': Buffer.from(file.originalname, 'utf8').toString('base64'),
        'Upload-Date': new Date().toISOString()
      };

      // 上传到MinIO
      const uploadResult = await minioClient.putObject(
        bucket,
        fileName,
        file.buffer,
        file.size,
        metaData
      );

      // 生成文件访问URL
      const fileUrl = getFileUrl(bucket, fileName);

      const result = {
        success: true,
        data: {
          fileName,
          originalName: file.originalname,
          url: fileUrl,
          bucket,
          size: file.size,
          mimeType: file.mimetype,
          etag: uploadResult.etag
        }
      };

      logger.info(`文件上传成功: ${file.originalname} -> ${fileName}`);
      return result;

    } catch (error) {
      logger.error('文件上传失败:', error);
      throw error;
    }
  }

  /**
   * 上传多个文件
   * @param {Array} files - 文件数组
   * @param {string} bucketType - 存储桶类型 (可选)
   * @param {string} fileType - 文件类型限制 ('image', 'document', 'all')
   * @returns {Promise<Object>} 上传结果
   */
  async uploadMultipleFiles(files, bucketType = null, fileType = 'all') {
    try {
      if (!files || files.length === 0) {
        throw new Error('文件列表不能为空');
      }

      const uploadPromises = files.map(file => this.uploadFile(file, bucketType, fileType));
      const results = await Promise.allSettled(uploadPromises);

      const successful = [];
      const failed = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value.data);
        } else {
          failed.push({
            fileName: files[index].originalname,
            error: result.reason.message
          });
        }
      });

      return {
        success: true,
        data: {
          successful,
          failed,
          total: files.length,
          successCount: successful.length,
          failureCount: failed.length
        }
      };

    } catch (error) {
      logger.error('批量文件上传失败:', error);
      throw error;
    }
  }

  /**
   * 删除文件
   * @param {string} bucket - 存储桶名称
   * @param {string} fileName - 文件名称
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteFile(bucket, fileName) {
    try {
      await minioClient.removeObject(bucket, fileName);
      logger.info(`文件删除成功: ${bucket}/${fileName}`);
      return true;
    } catch (error) {
      logger.error(`文件删除失败: ${bucket}/${fileName}`, error);
      throw error;
    }
  }

  /**
   * 获取文件信息
   * @param {string} bucket - 存储桶名称
   * @param {string} fileName - 文件名称
   * @returns {Promise<Object>} 文件信息
   */
  async getFileInfo(bucket, fileName) {
    try {
      const stat = await minioClient.statObject(bucket, fileName);
      return {
        size: stat.size,
        etag: stat.etag,
        lastModified: stat.lastModified,
        metaData: stat.metaData
      };
    } catch (error) {
      logger.error(`获取文件信息失败: ${bucket}/${fileName}`, error);
      throw error;
    }
  }

  /**
   * 文件类型验证
   * @param {Object} file - 文件对象
   * @param {string} fileType - 文件类型限制 ('image', 'document', 'all')
   */
  validateFile(file, fileType = 'all') {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    
    const FILE_TYPE_RULES = {
      image: {
        mimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        errorMessage: '只支持图片文件 (JPG, PNG, GIF, WebP)'
      },
      document: {
        mimeTypes: [
          'application/pdf', 'text/plain', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ],
        errorMessage: '只支持文档文件 (PDF, TXT, DOC, DOCX, XLS, XLSX)'
      },
      all: {
        mimeTypes: [
          'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
          'application/pdf', 'text/plain', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ],
        errorMessage: '不支持的文件类型'
      }
    };

    // 文件大小检查
    if (file.size > MAX_SIZE) {
      throw new Error(`文件大小不能超过 ${MAX_SIZE / 1024 / 1024}MB`);
    }

    // MIME类型检查
    const rule = FILE_TYPE_RULES[fileType];
    if (!rule.mimeTypes.includes(file.mimetype)) {
      throw new Error(`${rule.errorMessage}: ${file.mimetype}`);
    }

    // 文件名安全检查
    if (!/^[\w\-. ]+$/.test(file.originalname)) {
      throw new Error('文件名包含非法字符');
    }
  }

  /**
   * 获取支持的文件类型列表
   * @param {string} fileType - 文件类型 ('image', 'document', 'all')
   * @returns {Object} 支持的MIME类型
   */
  getSupportedMimeTypes(fileType = 'all') {
    const FILE_TYPE_RULES = {
      image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      document: [
        'application/pdf', 'text/plain', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ],
      all: [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]
    };

    return {
      image: FILE_TYPE_RULES.image,
      document: FILE_TYPE_RULES.document,
      all: FILE_TYPE_RULES.all
    };
  }
}

module.exports = new UploadService();