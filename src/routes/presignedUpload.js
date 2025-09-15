/**
 * 预签名上传路由配置
 * 处理预签名URL生成相关的HTTP路由
 */

const express = require('express');
const router = express.Router();
const presignedUploadController = require('../controllers/presignedUploadController');
const { authenticateToken } = require('../middleware/auth');

// 所有预签名上传接口都需要身份验证
router.use(authenticateToken);

// 获取预签名上传配置信息
router.get('/info', presignedUploadController.getPresignedInfo);

// 获取图片上传预签名URL
router.post('/image', presignedUploadController.getImagePresignedUrl);

// 获取头像上传预签名URL
router.post('/avatar', presignedUploadController.getAvatarPresignedUrl);

module.exports = router;