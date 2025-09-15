/**
 * MinIO 配置文件
 * 用于连接外部MinIO存储服务器
 */

const Minio = require('minio');
const { logger } = require('../utils/logger');

// MinIO 客户端配置
const minioConfig = {
  endPoint: process.env.MINIO_ENDPOINT || '38.135.25.203',
  port: parseInt(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || '5553621',
  secretKey: process.env.MINIO_SECRET_KEY || '791112deng'
};

// 创建MinIO客户端实例
const minioClient = new Minio.Client(minioConfig);

// 默认存储桶配置
const BUCKETS = {
  IMAGES: process.env.MINIO_BUCKET_IMAGES || 'alcms-images',
  DOCUMENTS: process.env.MINIO_BUCKET_DOCUMENTS || 'alcms-documents',
  AVATARS: process.env.MINIO_BUCKET_AVATARS || 'alcms-avatars'
};

// 初始化存储桶
const initializeBuckets = async () => {
  try {
    for (const [key, bucketName] of Object.entries(BUCKETS)) {
      const exists = await minioClient.bucketExists(bucketName);
      if (!exists) {
        await minioClient.makeBucket(bucketName);
        logger.info(`已创建存储桶: ${bucketName}`);
        
        // 设置存储桶策略为公共读取
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${bucketName}/*`]
            }
          ]
        };
        
        await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
        logger.info(`已设置存储桶 ${bucketName} 为公共读取`);
      }
    }
  } catch (error) {
    logger.error('初始化MinIO存储桶失败:', error);
  }
};

// 生成文件访问URL
const getFileUrl = (bucketName, objectName) => {
  const protocol = minioConfig.useSSL ? 'https' : 'http';
  const port = minioConfig.port === 80 || minioConfig.port === 443 ? '' : `:${minioConfig.port}`;
  return `${protocol}://${minioConfig.endPoint}${port}/${bucketName}/${objectName}`;
};

// 生成唯一文件名
const generateFileName = (originalName) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop();
  return `${timestamp}_${random}.${extension}`;
};

// 获取文件MIME类型对应的存储桶
const getBucketByMimeType = (mimeType) => {
  if (mimeType.startsWith('image/')) {
    return BUCKETS.IMAGES;
  } else if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) {
    return BUCKETS.DOCUMENTS;
  } else {
    return BUCKETS.IMAGES; // 默认使用图片存储桶
  }
};

module.exports = {
  minioClient,
  BUCKETS,
  initializeBuckets,
  getFileUrl,
  generateFileName,
  getBucketByMimeType
};