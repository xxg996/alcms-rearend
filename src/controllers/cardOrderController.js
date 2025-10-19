/**
 * 卡密兑换订单记录控制器
 * 处理用户的卡密兑换订单记录查询，包括VIP卡密订单和积分卡密订单
 * @swagger
 * tags:
 *   name: 卡密兑换订单记录
 *   description: 用户卡密兑换订单记录管理，统一管理VIP卡密订单和积分卡密订单
 */

const { query } = require('../config/database');
const { logger } = require('../utils/logger');

class CardOrderController {
  /**
   * @swagger
   * /api/card-orders/my-orders:
   *   get:
   *     summary: 获取我的卡密兑换订单记录
   *     description: |
   *       获取当前用户的卡密兑换订单记录列表，包括VIP卡密订单和积分卡密订单。
   *
   *       **功能特性：**
   *       - 统一管理VIP卡密和积分卡密订单
   *       - 提供详细的佣金信息展示
   *       - 支持日期范围筛选
   *       - 分页查询支持
   *       - 丰富的统计信息
   *
   *       **订单类型说明：**
   *       - VIP订单: vip_level > 0 或卡密类型为 vip，包含VIP等级和天数信息
   *       - 积分订单: 卡密类型为 points 或默认积分卡密
   *       - 下载订单: 卡密类型为 download，包含下载次数信息
   *     tags: [卡密兑换订单记录]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [all, vip, points, download]
   *           default: all
   *         description: 订单类型筛选
   *         example: "all"
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: 页码，从1开始
   *         example: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: 每页记录数，最大100
   *         example: 20
   *       - in: query
   *         name: start_date
   *         schema:
   *           type: string
   *           format: date
   *         description: 开始日期，格式：YYYY-MM-DD
   *         example: "2024-01-01"
   *       - in: query
   *         name: end_date
   *         schema:
   *           type: string
   *           format: date
   *         description: 结束日期，格式：YYYY-MM-DD
   *         example: "2024-12-31"
   *     responses:
   *       200:
   *         description: 获取成功
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "获取卡密兑换订单记录成功"
   *                 data:
   *                   type: object
   *                   properties:
   *                     orders:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           id:
   *                             type: integer
   *                             example: 11
   *                           order_no:
   *                             type: string
   *                             example: "CARD_1758582465803_32"
   *                           type:
   *                             type: string
   *                             enum: [vip, points, download]
   *                             example: "vip"
   *                           price:
   *                             type: number
   *                             example: 100
   *                           status:
   *                             type: string
   *                             example: "paid"
   *                           created_at:
   *                             type: string
   *                             format: date-time
   *                             example: "2025-09-22T23:07:45.804Z"
   *                           card_key_code:
   *                             type: string
   *                             example: "EQLT-GUDP-6DKA-VTPA"
   *                           vip_info:
   *                             type: object
   *                             nullable: true
   *                             properties:
   *                               level:
   *                                 type: integer
   *                                 example: 3
   *                               days:
   *                                 type: integer
   *                                 example: 30
   *                           points_info:
   *                             type: object
   *                             nullable: true
   *                             properties:
   *                               points:
   *                                 type: integer
   *                                 example: 2000
   *                           download_info:
   *                             type: object
   *                             nullable: true
   *                             properties:
   *                               credits:
   *                                 type: integer
   *                                 example: 10
   *                               value_amount:
   *                                 type: number
   *                                 example: 10
   *                           commission_info:
   *                             type: object
   *                             nullable: true
   *                             properties:
   *                               commission_id:
   *                                 type: integer
   *                                 example: 7
   *                               commission_amount:
   *                                 type: number
   *                                 example: 10
   *                               commission_rate:
   *                                 type: number
   *                                 example: 0.1
   *                               status:
   *                                 type: string
   *                                 example: "pending"
   *                               inviter_username:
   *                                 type: string
   *                                 example: "updateduser"
   *                     statistics:
   *                       type: object
   *                       properties:
   *                         total_orders:
   *                           type: integer
   *                         vip_orders:
   *                           type: integer
   *                         download_orders:
   *                           type: integer
   *                         points_orders:
   *                           type: integer
   *                         total_amount:
   *                           type: number
   *                         vip_total_amount:
   *                           type: number
   *                         download_total_amount:
   *                           type: number
   *                         points_total_amount:
   *                           type: number
   *       401:
   *         description: 未授权
   *       403:
   *         description: 权限不足
   *       500:
   *         description: 服务器错误
   */
  async getMyOrderRecords(req, res) {
    try {
      const userId = req.user.id;
      const {
        type = 'all', // all, vip, points, download
        page = 1,
        limit = 20,
        start_date = null,
        end_date = null
      } = req.query;

      const offset = (page - 1) * limit;
      const normalizedType = typeof type === 'string' ? type.toLowerCase() : 'all';
      let whereConditions = ['vo.user_id = $1', "vo.payment_method = 'card_key'"];
      let values = [userId];
      let paramCount = 2;
      const fromClause = `FROM orders vo
        LEFT JOIN card_keys ck ON vo.card_key_code = ck.code`;

      // 类型筛选 (根据卡密类型判断)
      if (normalizedType === 'vip') {
        whereConditions.push(`(vo.vip_level > 0 OR ck.type = 'vip')`);
      } else if (normalizedType === 'points') {
        whereConditions.push(`((ck.type IS NULL AND vo.vip_level = 0) OR ck.type = 'points')`);
      } else if (normalizedType === 'download') {
        whereConditions.push(`ck.type = 'download'`);
      }

      // 日期筛选
      if (start_date) {
        whereConditions.push(`vo.created_at >= $${paramCount}`);
        values.push(start_date);
        paramCount++;
      }

      if (end_date) {
        whereConditions.push(`vo.created_at <= $${paramCount}`);
        values.push(end_date);
        paramCount++;
      }

      const whereClause = whereConditions.join(' AND ');

      // 获取总数
      const countQuery = `
        SELECT COUNT(*) as total
        ${fromClause}
        WHERE ${whereClause}
      `;
      const countResult = await query(countQuery, values);
      const total = parseInt(countResult.rows[0].total);

      // 获取分页数据
      const dataValues = [...values, limit, offset];
      const dataQuery = `
        SELECT
          vo.id,
          vo.order_no,
          vo.vip_level,
          vo.price,
          vo.duration_days,
          vo.status,
          vo.created_at,
          vo.card_key_code,
          ck.type as card_type,
          ck.points,
          ck.value_amount,
          ck.download_credits,
          rc.id as commission_id,
          rc.commission_amount,
          rc.commission_rate,
          rc.event_type as commission_event_type,
          rc.status as commission_status,
          inviter.username as inviter_username
        ${fromClause}
        LEFT JOIN referral_commissions rc ON rc.order_id = vo.id
        LEFT JOIN users inviter ON rc.inviter_id = inviter.id
        WHERE ${whereClause}
        ORDER BY vo.created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `;

      const dataResult = await query(dataQuery, dataValues);

      // 处理数据格式
      const determineOrderType = (row) => {
        if (row.card_type === 'download') {
          return 'download';
        }

        if (row.card_type === 'vip' || row.vip_level > 0) {
          return 'vip';
        }

        if (row.card_type) {
          return row.card_type;
        }

        return row.vip_level > 0 ? 'vip' : 'points';
      };

      const orders = dataResult.rows.map(row => {
        const orderType = determineOrderType(row);
        const baseOrder = {
          id: row.id,
          order_no: row.order_no,
          type: orderType,
          price: Number(row.price || 0),
          status: row.status,
          created_at: row.created_at,
          card_key_code: row.card_key_code
        };

        if (orderType === 'vip') {
          baseOrder.vip_info = {
            level: row.vip_level,
            days: row.duration_days
          };
        } else if (orderType === 'points') {
          baseOrder.points_info = {
            points: row.points || 0
          };
        } else if (orderType === 'download') {
          baseOrder.download_info = {
            credits: row.download_credits || 0,
            value_amount: Number(row.value_amount || 0)
          };
        }

        // 佣金信息
        if (row.commission_id) {
          baseOrder.commission_info = {
            commission_id: row.commission_id,
            commission_amount: Number(row.commission_amount || 0),
            commission_rate: Number(row.commission_rate || 0),
            event_type: row.commission_event_type,
            status: row.commission_status,
            inviter_username: row.inviter_username
          };
        }

        return baseOrder;
      });

      // 统计信息
      const statsQuery = `
        SELECT
          COUNT(*) as total_orders,
          COUNT(CASE WHEN (vo.vip_level > 0 OR ck.type = 'vip') THEN 1 END) as vip_orders,
          COUNT(CASE WHEN ck.type = 'download' THEN 1 END) as download_orders,
          COUNT(
            CASE WHEN ((ck.type IS NULL AND vo.vip_level = 0) OR ck.type = 'points') THEN 1 END
          ) as points_orders,
          SUM(vo.price) as total_amount,
          SUM(CASE WHEN (vo.vip_level > 0 OR ck.type = 'vip') THEN vo.price ELSE 0 END) as vip_total_amount,
          SUM(CASE WHEN ck.type = 'download' THEN vo.price ELSE 0 END) as download_total_amount,
          SUM(
            CASE WHEN ((ck.type IS NULL AND vo.vip_level = 0) OR ck.type = 'points') THEN vo.price ELSE 0 END
          ) as points_total_amount
        FROM orders vo
        LEFT JOIN card_keys ck ON vo.card_key_code = ck.code
        WHERE vo.user_id = $1 AND vo.payment_method = 'card_key'
      `;
      const statsResult = await query(statsQuery, [userId]);
      const stats = statsResult.rows[0];

      res.json({
        success: true,
        message: '获取卡密兑换订单记录成功',
        data: {
          orders,
          pagination: {
            current_page: parseInt(page),
            per_page: parseInt(limit),
            total,
            total_pages: Math.ceil(total / limit),
            has_next: offset + limit < total,
            has_prev: offset > 0
          },
          statistics: {
            total_orders: parseInt(stats.total_orders || 0),
            vip_orders: parseInt(stats.vip_orders || 0),
            download_orders: parseInt(stats.download_orders || 0),
            points_orders: parseInt(stats.points_orders || 0),
            total_amount: Number(stats.total_amount || 0),
            vip_total_amount: Number(stats.vip_total_amount || 0),
            download_total_amount: Number(stats.download_total_amount || 0),
            points_total_amount: Number(stats.points_total_amount || 0)
          }
        }
      });

    } catch (error) {
      logger.error('获取卡密兑换订单记录失败:', error);
      res.status(500).json({
        success: false,
        message: '获取卡密兑换订单记录失败'
      });
    }
  }

  /**
   * @swagger
   * /api/card-orders/orders/{orderId}:
   *   get:
   *     summary: 获取单个订单详情
   *     description: |
   *       获取指定订单的详细信息，包括完整的佣金和卡密信息。
   *     tags: [卡密兑换订单记录]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: orderId
   *         required: true
   *         schema:
   *           type: integer
   *           minimum: 1
   *         description: 订单ID
   *         example: 11
   *     responses:
   *       200:
   *         description: 获取成功
   *       404:
   *         description: 订单不存在
   *       500:
   *         description: 服务器错误
   */
  async getOrderDetail(req, res) {
    try {
      const userId = req.user.id;
      const { orderId } = req.params;

      const detailQuery = `
        SELECT
          vo.*,
          ck.type as card_type,
          ck.points,
          ck.value_amount,
          ck.download_credits,
          rc.id as commission_id,
          rc.commission_amount,
          rc.commission_rate,
          rc.event_type as commission_event_type,
          rc.status as commission_status,
          rc.created_at as commission_created_at,
          rc.settled_at as commission_settled_at,
          inviter.id as inviter_id,
          inviter.username as inviter_username,
          inviter.nickname as inviter_nickname
        FROM orders vo
        LEFT JOIN card_keys ck ON vo.card_key_code = ck.code
        LEFT JOIN referral_commissions rc ON rc.order_id = vo.id
        LEFT JOIN users inviter ON rc.inviter_id = inviter.id
        WHERE vo.id = $1 AND vo.user_id = $2 AND vo.payment_method = 'card_key'
      `;

      const result = await query(detailQuery, [orderId, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }

      const row = result.rows[0];

      const determineOrderType = (record) => {
        if (record.card_type === 'download') {
          return 'download';
        }

        if (record.card_type === 'vip' || record.vip_level > 0) {
          return 'vip';
        }

        if (record.card_type) {
          return record.card_type;
        }

        return record.vip_level > 0 ? 'vip' : 'points';
      };

      const orderType = determineOrderType(row);
      const order = {
        id: row.id,
        order_no: row.order_no,
        type: orderType,
        price: Number(row.price || 0),
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        card_key_code: row.card_key_code
      };

      if (orderType === 'vip') {
        order.vip_info = {
          level: row.vip_level,
          days: row.duration_days,
          expire_at: row.expire_at
        };
      } else if (orderType === 'points') {
        order.points_info = {
          points: row.points || 0
        };
      } else if (orderType === 'download') {
        order.download_info = {
          credits: row.download_credits || 0,
          value_amount: Number(row.value_amount || 0)
        };
      }

      // 详细佣金信息
      if (row.commission_id) {
        order.commission_info = {
          id: row.commission_id,
          amount: Number(row.commission_amount || 0),
          rate: Number(row.commission_rate || 0),
          event_type: row.commission_event_type,
          status: row.commission_status,
          created_at: row.commission_created_at,
          settled_at: row.commission_settled_at,
          inviter: {
            id: row.inviter_id,
            username: row.inviter_username,
            nickname: row.inviter_nickname
          }
        };
      }

      res.json({
        success: true,
        message: '获取订单详情成功',
        data: order
      });

    } catch (error) {
      logger.error('获取订单详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取订单详情失败'
      });
    }
  }
}

module.exports = new CardOrderController();
