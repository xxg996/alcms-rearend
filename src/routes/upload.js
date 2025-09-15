/**
 * 文件管理路由配置
 * 处理文件删除等管理操作，上传功能已迁移到预签名上传
 */

const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { authenticateToken } = require('../middleware/auth');

// 所有接口都需要身份验证
router.use(authenticateToken);

// 获取上传配置信息 (重定向到预签名上传说明)
router.get('/info', uploadController.getUploadInfo);

// 删除文件 (POST方法)
router.post('/delete', uploadController.deleteFile);

module.exports = router;