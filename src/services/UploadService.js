/**
 * 文件管理服务
 * 处理文件删除和信息查询等管理操作
 * 注意：直接上传功能已弃用，请使用预签名上传
 */

const { minioClient } = require('../config/minio');
const { logger } = require('../utils/logger');

class UploadService {
  /**
   * 删除文件
   * @param {string} bucket - 存储桶名称
   * @param {string} fileName - 文件名
   * @returns {Promise<Object>} 删除结果
   */
  async deleteFile(bucket, fileName) {
    try {
      if (!bucket || !fileName) {
        throw new Error('存储桶名称和文件名不能为空');
      }

      // 检查文件是否存在
      try {
        await minioClient.statObject(bucket, fileName);
      } catch (error) {
        if (error.code === 'NoSuchKey' || error.code === 'NotFound') {
          throw new Error('文件不存在');
        }
        throw error;
      }

      // 删除文件
      await minioClient.removeObject(bucket, fileName);

      logger.info('文件删除成功:', { bucket, fileName });

      return {
        success: true,
        message: '文件删除成功'
      };

    } catch (error) {
      logger.error('文件删除失败:', error);
      throw error;
    }
  }

  /**
   * 获取文件信息
   * @param {string} bucket - 存储桶名称
   * @param {string} fileName - 文件名
   * @returns {Promise<Object>} 文件信息
   */
  async getFileInfo(bucket, fileName) {
    try {
      const stat = await minioClient.statObject(bucket, fileName);
      
      const result = {
        fileName,
        size: stat.size,
        lastModified: stat.lastModified,
        contentType: stat.metaData['content-type'],
        originalName: stat.metaData['original-name'] 
          ? Buffer.from(stat.metaData['original-name'], 'base64').toString('utf8')
          : fileName
      };

      return {
        success: true,
        message: '获取文件信息成功',
        data: result
      };

    } catch (error) {
      logger.error(`获取文件信息失败: ${bucket}/${fileName}`, error);
      throw error;
    }
  }
}

module.exports = new UploadService();