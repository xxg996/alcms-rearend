/**
 * 前端公共数据路由
 * 提供无需登录的展示型接口
 */

const express = require('express');
const router = express.Router();
const FrontendContentController = require('../controllers/frontendContentController');

// 获取首页轮播图
router.get('/banners', FrontendContentController.getHomepageBanners);

// 获取随机视频资源列表
router.get('/resources/random-video', FrontendContentController.getRandomVideoResources);

module.exports = router;
