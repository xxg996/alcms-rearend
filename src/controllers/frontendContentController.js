/**
 * 前端公共内容控制器
 * 提供无鉴权的前端展示数据，例如轮播图
 */

const SystemSetting = require('../models/SystemSetting');
const Resource = require('../models/Resource');
const { logger } = require('../utils/logger');

const FrontendContentController = {
  /**
   * @swagger
   * /api/frontend/carousel:
   *   get:
   *     tags: [前端调用]
   *     summary: 获取首页轮播内容
   *     description: 返回系统配置中定义的前端展示条目（如轮播图）。
   *     responses:
   *       200:
   *         description: 获取成功
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async getHomepageBanners(req, res) {
    try {
      const banners = await SystemSetting.getFrontendBanners();
      res.json({
        success: true,
        message: '获取首页轮播内容成功',
        data: banners
      });
    } catch (error) {
      logger.error('获取轮播图失败:', error);
      res.status(500).json({
        success: false,
        message: '获取轮播图失败'
      });
    }
  },

  /**
   * @swagger
   * /api/resources/frontend:
   *   get:
   *     tags: [前端调用]
   *     summary: 获取随机视频资源
   *     description: 随机返回指定数量的公开视频资源，供前端模块展示。
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 6
   *           maximum: 50
   *         description: 返回的视频资源数量，默认6条，最大50条。
   *     responses:
   *       200:
   *         description: 获取成功
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async getRandomVideoResources(req, res) {
    try {
      const { limit = 6 } = req.query;
      const resources = await Resource.getRandomPublishedResourcesByType('video', limit);

      res.json({
        success: true,
        message: '获取前端资源成功',
        data: resources
      });
    } catch (error) {
      logger.error('获取随机视频资源失败:', error);
      res.status(500).json({
        success: false,
        message: '获取随机视频资源失败'
      });
    }
  }
};

module.exports = FrontendContentController;
