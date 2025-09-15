/**
 * 文件上传中间件配置
 * 使用multer处理文件上传
 */

const multer = require('multer');
const { logger } = require('../utils/logger');

// 内存存储配置 (文件直接存储在内存中，然后传递给MinIO)
const storage = multer.memoryStorage();

// 文件过滤器
const fileFilter = (req, file, cb) => {
  // 允许的MIME类型
  const allowedMimes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    logger.warn(`拒绝上传文件类型: ${file.mimetype}`);
    cb(new Error(`不支持的文件类型: ${file.mimetype}`), false);
  }
};

// 基础multer配置
const uploadConfig = {
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10 // 最多10个文件
  }
};

// 创建不同类型的上传中间件
const upload = multer(uploadConfig);

// 单文件上传
const uploadSingle = (fieldName = 'file') => {
  return (req, res, next) => {
    const singleUpload = upload.single(fieldName);
    
    singleUpload(req, res, (error) => {
      if (error) {
        logger.error('文件上传中间件错误:', error);
        
        if (error instanceof multer.MulterError) {
          switch (error.code) {
            case 'LIMIT_FILE_SIZE':
              return res.status(400).json({
                success: false,
                message: '文件大小超过限制 (最大10MB)'
              });
            case 'LIMIT_FILE_COUNT':
              return res.status(400).json({
                success: false,
                message: '文件数量超过限制'
              });
            case 'LIMIT_UNEXPECTED_FILE':
              return res.status(400).json({
                success: false,
                message: '意外的文件字段'
              });
            default:
              return res.status(400).json({
                success: false,
                message: `文件上传错误: ${error.message}`
              });
          }
        }
        
        return res.status(400).json({
          success: false,
          message: error.message || '文件上传失败'
        });
      }
      
      // 检查是否有文件上传
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请选择要上传的文件'
        });
      }
      
      next();
    });
  };
};

// 多文件上传
const uploadMultiple = (fieldName = 'files', maxCount = 10) => {
  return (req, res, next) => {
    const multipleUpload = upload.array(fieldName, maxCount);
    
    multipleUpload(req, res, (error) => {
      if (error) {
        logger.error('批量文件上传中间件错误:', error);
        
        if (error instanceof multer.MulterError) {
          switch (error.code) {
            case 'LIMIT_FILE_SIZE':
              return res.status(400).json({
                success: false,
                message: '文件大小超过限制 (最大10MB)'
              });
            case 'LIMIT_FILE_COUNT':
              return res.status(400).json({
                success: false,
                message: `文件数量超过限制 (最多${maxCount}个)`
              });
            case 'LIMIT_UNEXPECTED_FILE':
              return res.status(400).json({
                success: false,
                message: '意外的文件字段'
              });
            default:
              return res.status(400).json({
                success: false,
                message: `文件上传错误: ${error.message}`
              });
          }
        }
        
        return res.status(400).json({
          success: false,
          message: error.message || '文件上传失败'
        });
      }
      
      // 检查是否有文件上传
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请选择要上传的文件'
        });
      }
      
      next();
    });
  };
};

// 混合字段上传 (支持多个不同字段的文件上传)
const uploadFields = (fields) => {
  return (req, res, next) => {
    const fieldsUpload = upload.fields(fields);
    
    fieldsUpload(req, res, (error) => {
      if (error) {
        logger.error('字段文件上传中间件错误:', error);
        
        if (error instanceof multer.MulterError) {
          return res.status(400).json({
            success: false,
            message: `文件上传错误: ${error.message}`
          });
        }
        
        return res.status(400).json({
          success: false,
          message: error.message || '文件上传失败'
        });
      }
      
      next();
    });
  };
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadFields
};