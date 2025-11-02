/**
 * 搜索统计控制器
 */

const SearchRecord = require('../models/SearchRecord');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { logger } = require('../utils/logger');

class SearchController {
  /**
   * @swagger
   * /api/search/hot:
   *   get:
   *     tags: [搜索]
   *     summary: 获取热搜关键词
   *     description: 根据搜索记录统计热搜关键词，可筛选资源或社区类型。
   *     parameters:
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [resource, resources, community]
   *         description: 热搜类型过滤，resource/resources 表示资源，community 表示社区；留空表示全部
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 10
   *         description: 返回列表数量
   *     responses:
   *       200:
   *         description: 获取成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/HotSearchList'
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async getHotSearches(req, res) {
    try {
      const { type, limit } = req.query;

      let normalizedType = null;
      if (typeof type === 'string' && type.trim() !== '') {
        if (type.trim().toLowerCase() === 'all') {
          normalizedType = null;
        } else {
          normalizedType = SearchRecord.normalizeType(type);
          if (!normalizedType) {
            return errorResponse(res, '热搜类型不合法', 400);
          }
        }
      }

      const items = await SearchRecord.getHotKeywords({
        searchType: normalizedType,
        limit
      });

      return successResponse(res, '获取热搜关键词成功', { items });
    } catch (error) {
      logger.error('获取热搜关键词失败:', error);
      return errorResponse(res, '获取热搜关键词失败', 500);
    }
  }
}

module.exports = SearchController;
