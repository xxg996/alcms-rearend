/**
 * 前端公共数据路由
 */

const express = require('express');
const router = express.Router();
const FrontendContentController = require('../controllers/frontendContentController');

// 获取首页轮播内容
router.get('/carousel', FrontendContentController.getHomepageBanners);

module.exports = router;
