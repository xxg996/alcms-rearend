/**
 * 积分商城商品控制器
 * 提供虚拟商品的管理端与用户端接口
 */

const PointsProduct = require('../models/PointsProduct');
const Points = require('../models/Points');
const AuditLog = require('../models/AuditLog');
const { logger } = require('../utils/logger');

const getRequestMeta = (req) => ({
  ipAddress: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip,
  userAgent: req.get('user-agent') || ''
});

const recordSystemLog = async (req, payload) => {
  const operatorId = req.user?.id || null;
  const { ipAddress, userAgent } = getRequestMeta(req);
  await AuditLog.createSystemLog({
    operatorId,
    ipAddress,
    userAgent,
    ...payload
  });
};

const pointsProductController = {
  /**
   * 管理端：获取虚拟商品列表
   */
  /**
   * @swagger
   * /api/admin/points/products:
   *   get:
   *     tags: [积分商城管理]
   *     summary: 获取积分虚拟商品列表（管理端）
   *     description: 管理员按状态、标签、关键字分页查询虚拟商品，并返回库存统计。
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: keyword
   *         schema:
   *           type: string
   *         description: 按名称或描述模糊搜索
   *       - in: query
   *         name: tags
   *         schema:
   *           type: string
   *         description: 标签过滤（逗号分隔）
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [active, inactive]
   *         description: 启用状态过滤
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *           maximum: 100
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *     responses:
   *       200:
   *         description: 获取商品列表成功
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async adminGetProducts(req, res) {
    try {
      const { keyword, tags, status, limit = 20, offset = 0 } = req.query;
      const result = await PointsProduct.getProductsForAdmin({
        keyword,
        tags,
        status,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      });

      res.json({
        success: true,
        message: '获取积分商品列表成功',
        data: result.items,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('获取积分商品列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取积分商品列表失败'
      });
    }
  },

  /**
   * 管理端：创建虚拟商品
   */
  /**
   * @swagger
   * /api/admin/points/products:
   *   post:
   *     tags: [积分商城管理]
   *     summary: 创建虚拟商品
   *     description: 管理员创建新的积分虚拟商品，可设置标签、库存、详情等属性。
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, points_cost]
   *             properties:
   *               name:
   *                 type: string
   *                 description: 商品名称
   *               description:
   *                 type: string
   *               points_cost:
   *                 type: integer
   *                 description: 兑换所需积分
   *               tags:
   *                 type: array
   *                 items:
   *                   type: string
   *               stock:
   *                 type: integer
   *                 description: 初始库存（-1 表示不限）
   *               is_active:
   *                 type: boolean
   *               details:
   *                 type: object
   *     responses:
   *       201:
   *         description: 创建成功
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async createProduct(req, res) {
    try {
      const operatorId = req.user?.id || null;
      const product = await PointsProduct.createProduct(req.body, operatorId);

      await recordSystemLog(req, {
        targetType: 'points_product',
        targetId: product.id,
        action: 'points_product_create',
        summary: `创建虚拟商品 ${product.name}`,
        detail: {
          pointsCost: product.points_cost,
          tags: product.tags
        }
      });

      res.status(201).json({
        success: true,
        message: '虚拟商品创建成功',
        data: product
      });
    } catch (error) {
      logger.error('创建虚拟商品失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '创建虚拟商品失败'
      });
    }
  },

  /**
   * 管理端：更新虚拟商品
   */
  /**
   * @swagger
   * /api/admin/points/products/{productId}:
   *   put:
   *     tags: [积分商城管理]
   *     summary: 更新虚拟商品
   *     description: 管理员更新指定虚拟商品的信息，例如上下架、改价、调整标签等。
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               points_cost:
   *                 type: integer
   *               stock:
   *                 type: integer
   *               is_active:
   *                 type: boolean
   *               tags:
   *                 type: array
   *                 items:
   *                   type: string
   *               details:
   *                 type: object
   *     responses:
   *       200:
   *         description: 更新成功
   *       404:
   *         description: 商品不存在
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async updateProduct(req, res) {
    try {
      const { productId } = req.params;
      const product = await PointsProduct.updateProduct(parseInt(productId, 10), req.body || {});

      if (!product) {
        return res.status(404).json({
          success: false,
          message: '虚拟商品不存在'
        });
      }

      await recordSystemLog(req, {
        targetType: 'points_product',
        targetId: product.id,
        action: 'points_product_update',
        summary: `更新虚拟商品 ${product.name}`,
        detail: {
          tags: product.tags,
          stock: product.stock
        }
      });

      res.json({
        success: true,
        message: '虚拟商品更新成功',
        data: product
      });
    } catch (error) {
      logger.error('更新虚拟商品失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '更新虚拟商品失败'
      });
    }
  },

  /**
   * 管理端：批量新增虚拟商品库存
   */
  /**
   * @swagger
   * /api/admin/points/products/{productId}/inventory:
   *   post:
   *     tags: [积分商城管理]
   *     summary: 批量新增虚拟商品库存
   *     description: 管理员为虚拟商品导入兑换码（以文本数组形式）。
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [codes]
   *             properties:
   *               codes:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: 导入成功
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async addInventory(req, res) {
    try {
      const { productId } = req.params;
      const { codes } = req.body || {};

      const result = await PointsProduct.addInventoryItems(parseInt(productId, 10), codes, req.user?.id || null);

      await recordSystemLog(req, {
        targetType: 'points_product',
        targetId: parseInt(productId, 10),
        action: 'points_product_inventory_add',
        summary: `新增虚拟商品库存 ${result.inserted} 条`
      });

      res.json({
        success: true,
        message: '虚拟商品库存新增成功',
        data: result
      });
    } catch (error) {
      logger.error('新增虚拟商品库存失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '新增虚拟商品库存失败'
      });
    }
  },

  /**
   * 管理端：获取虚拟商品库存列表
   */
  /**
   * @swagger
   * /api/admin/points/products/{productId}/inventory:
   *   get:
   *     tags: [积分商城管理]
   *     summary: 获取虚拟商品库存列表
   *     description: 管理员查看虚拟商品的兑换码库存状态。
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: integer
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [available, reserved, used, disabled]
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *     responses:
   *       200:
   *         description: 获取成功
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async getInventory(req, res) {
    try {
      const { productId } = req.params;
      const { status, limit = 50, offset = 0 } = req.query;

      const inventory = await PointsProduct.getInventoryItems(parseInt(productId, 10), {
        status,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      });

      res.json({
        success: true,
        message: '获取虚拟商品库存成功',
        data: inventory
      });
    } catch (error) {
      logger.error('获取虚拟商品库存失败:', error);
      res.status(500).json({
        success: false,
        message: '获取虚拟商品库存失败'
      });
    }
  },

  /**
   * 用户端：获取可兑换虚拟商品列表
   */
  /**
   * @swagger
   * /api/points/products:
   *   get:
   *     tags: [积分商城]
   *     summary: 获取可兑换虚拟商品
   *     description: 用户查看当前可兑换的虚拟商品列表，可按标签和关键字筛选。
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: keyword
   *         schema:
   *           type: string
   *       - in: query
   *         name: tags
   *         schema:
   *           type: string
   *         description: 标签（逗号分隔）
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *     responses:
   *       200:
   *         description: 获取成功
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async getProducts(req, res) {
    try {
      const { keyword, tags, limit = 20, offset = 0 } = req.query;

      const userId = req.user.id;
      const result = await PointsProduct.getActiveProducts({
        keyword,
        tags,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      });

      const availableBalance = await Points.getUserPoints(userId);
      const userPoints = availableBalance?.points || 0;

      const items = result.items.map(item => {
        const availableInventory = Number(item.available_inventory || 0);
        const stock = item.stock === null || item.stock === undefined ? -1 : item.stock;
        return {
          ...item,
          available_inventory: availableInventory,
          can_redeem: item.points_cost <= userPoints && (stock === -1 || stock > 0) && availableInventory > 0
        };
      });

      res.json({
        success: true,
        message: '获取虚拟商品列表成功',
        data: items,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('获取虚拟商品列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取虚拟商品列表失败'
      });
    }
  },

  /**
   * 用户端：兑换虚拟商品
   */
  /**
   * @swagger
   * /api/points/products/{productId}/redeem:
   *   post:
   *     tags: [积分商城]
   *     summary: 兑换虚拟商品
   *     description: 用户使用积分兑换虚拟商品，成功后返回兑换码及订单信息。
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: 兑换成功
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async redeemProduct(req, res) {
    try {
      const { productId } = req.params;
      const userId = req.user.id;

      const result = await PointsProduct.redeemVirtualProduct(parseInt(productId, 10), userId);

      await recordSystemLog(req, {
        targetType: 'points_product',
        targetId: parseInt(productId, 10),
        action: 'points_product_redeem',
        summary: `用户${userId} 兑换虚拟商品 ${result.product.name}`,
        detail: {
          pointsCost: result.product.points_cost,
          code: result.inventoryItem.code
        }
      });

      res.json({
        success: true,
        message: '兑换成功',
        data: {
          code: result.inventoryItem.code,
          order: result.exchange,
          product: result.product
        }
      });
    } catch (error) {
      logger.error('兑换虚拟商品失败:', error);
      res.status(400).json({
        success: false,
        message: error.message || '兑换虚拟商品失败'
      });
    }
  },

  /**
   * @swagger
   * /api/points/products/exchanges:
   *   get:
   *     tags: [积分商城]
   *     summary: 获取当前用户的兑换记录
   *     description: 按状态分页获取用户积分商城虚拟商品的兑换记录。
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending, completed, cancelled, failed]
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *     responses:
   *       200:
   *         description: 获取成功
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async getMyExchanges(req, res) {
    try {
      const userId = req.user.id;
      const { status, limit = 20, offset = 0 } = req.query;

      const result = await PointsProduct.getUserExchanges(userId, {
        status,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      });

      res.json({
        success: true,
        message: '获取兑换记录成功',
        data: result.items,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('获取兑换记录失败:', error);
      res.status(500).json({
        success: false,
        message: '获取兑换记录失败'
      });
    }
  },

  /**
   * @swagger
   * /api/admin/points/products/exchanges:
   *   get:
   *     tags: [积分商城管理]
   *     summary: 获取积分商城兑换记录
   *     description: 管理员可按用户、商品、状态、时间范围查询兑换记录。
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: user_id
   *         schema:
   *           type: integer
   *       - in: query
   *         name: product_id
   *         schema:
   *           type: integer
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending, completed, cancelled, failed]
   *       - in: query
   *         name: start_at
   *         schema:
   *           type: string
   *           format: date-time
   *       - in: query
   *         name: end_at
   *         schema:
   *           type: string
   *           format: date-time
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *     responses:
   *       200:
   *         description: 获取成功
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  async adminGetExchanges(req, res) {
    try {
      const {
        user_id,
        product_id,
        status,
        start_at,
        end_at,
        limit = 20,
        offset = 0
      } = req.query;

      const result = await PointsProduct.getAdminExchanges({
        user_id: user_id ? parseInt(user_id, 10) : null,
        product_id: product_id ? parseInt(product_id, 10) : null,
        status,
        start_at,
        end_at,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      });

      res.json({
        success: true,
        message: '获取兑换记录成功',
        data: result.items,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('获取兑换记录失败:', error);
      res.status(500).json({
        success: false,
        message: '获取兑换记录失败'
      });
    }
  }
};

module.exports = pointsProductController;
