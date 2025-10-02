/**
 * 积分商城商品模型
 * 负责虚拟商品（卡密形式）及库存的增删改查、兑换流程
 */

const { query, getClient } = require('../config/database');
const { logger } = require('../utils/logger');
const Points = require('./Points');

class PointsProduct {
  static #normalizeTags(tags) {
    if (!tags) return [];
    if (Array.isArray(tags)) {
      return tags
        .map(tag => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(tag => tag && tag.length <= 50);
    }
    if (typeof tags === 'string') {
      return tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag && tag.length <= 50);
    }
    return [];
  }

  /**
   * 管理端 - 获取商品列表
   */
  static async getProductsForAdmin(options = {}) {
    const {
      keyword = null,
      tags = null,
      status = null,
      limit = 20,
      offset = 0
    } = options;

    const tagArray = this.#normalizeTags(tags);

    const conditions = ["p.type = 'virtual'"];
    const values = [];
    let idx = 1;

    if (status === 'active') {
      conditions.push('p.is_active = TRUE');
    } else if (status === 'inactive') {
      conditions.push('p.is_active = FALSE');
    }

    if (keyword) {
      conditions.push(`(p.name ILIKE $${idx} OR p.description ILIKE $${idx})`);
      values.push(`%${keyword}%`);
      idx += 1;
    }

    if (tagArray.length > 0) {
      conditions.push(`p.tags && $${idx}`);
      values.push(tagArray);
      idx += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const listQuery = `
      SELECT
        p.*,
        COALESCE(inv.total_items, 0)                AS total_inventory,
        COALESCE(inv.available_items, 0)            AS available_inventory,
        COALESCE(inv.used_items, 0)                 AS used_inventory
      FROM points_products p
      LEFT JOIN (
        SELECT
          product_id,
          COUNT(*)                               AS total_items,
          COUNT(*) FILTER (WHERE status = 'available') AS available_items,
          COUNT(*) FILTER (WHERE status = 'used')      AS used_items
        FROM virtual_product_items
        GROUP BY product_id
      ) inv ON inv.product_id = p.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM points_products p
      ${whereClause}
    `;

    const listValues = [...values, limit, offset];

    const [listResult, countResult] = await Promise.all([
      query(listQuery, listValues),
      query(countQuery, values)
    ]);

    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    return {
      items: listResult.rows,
      pagination: {
        total,
        limit,
        offset,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: offset > 0
      }
    };
  }

  /**
   * 用户端 - 获取可兑换虚拟商品
   */
  static async getActiveProducts(options = {}) {
    const {
      keyword = null,
      tags = null,
      limit = 20,
      offset = 0
    } = options;

    const tagArray = this.#normalizeTags(tags);

    const conditions = [
      "p.type = 'virtual'",
      'p.is_active = TRUE'
    ];
    const values = [];
    let idx = 1;

    if (keyword) {
      conditions.push(`(p.name ILIKE $${idx} OR p.description ILIKE $${idx})`);
      values.push(`%${keyword}%`);
      idx += 1;
    }

    if (tagArray.length > 0) {
      conditions.push(`p.tags && $${idx}`);
      values.push(tagArray);
      idx += 1;
    }

    conditions.push(`(p.stock = -1 OR p.stock > 0)`);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const listQuery = `
      SELECT
        p.*,
        COALESCE(inv.available_items, 0) AS available_inventory
      FROM points_products p
      LEFT JOIN (
        SELECT
          product_id,
          COUNT(*) FILTER (WHERE status = 'available') AS available_items
        FROM virtual_product_items
        GROUP BY product_id
      ) inv ON inv.product_id = p.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM points_products p
      ${whereClause}
    `;

    const listValues = [...values, limit, offset];

    const [listResult, countResult] = await Promise.all([
      query(listQuery, listValues),
      query(countQuery, values)
    ]);

    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    return {
      items: listResult.rows,
      pagination: {
        total,
        limit,
        offset,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: offset > 0
      }
    };
  }

  /**
   * 创建虚拟商品
   */
  static async createProduct(data, operatorId = null) {
    const {
      name,
      description = '',
      points_cost,
      tags = [],
      stock = -1,
      is_active = true,
      details = {}
    } = data;

    if (!name || !points_cost) {
      throw new Error('商品名称与积分价格为必填项');
    }

    const tagArray = this.#normalizeTags(tags);

    const insertQuery = `
      INSERT INTO points_products
        (name, description, type, points_cost, stock, is_active, tags, details, created_by)
      VALUES ($1, $2, 'virtual', $3, $4, $5, $6::text[], $7::jsonb, $8)
      RETURNING *
    `;

    const result = await query(insertQuery, [
      name,
      description,
      parseInt(points_cost, 10),
      stock === null || stock === undefined ? -1 : stock,
      is_active,
      tagArray,
      JSON.stringify(details || {}),
      operatorId
    ]);

    return result.rows[0];
  }

  /**
   * 更新虚拟商品
   */
  static async updateProduct(productId, data) {
    const fields = [];
    const values = [];
    let idx = 1;

    const allowedFields = {
      name: 'name',
      description: 'description',
      points_cost: 'points_cost',
      stock: 'stock',
      is_active: 'is_active',
      details: 'details'
    };

    for (const [key, column] of Object.entries(allowedFields)) {
      if (data[key] !== undefined) {
        if (key === 'details') {
          fields.push(`${column} = $${idx}::jsonb`);
          values.push(JSON.stringify(data[key] || {}));
        } else {
          fields.push(`${column} = $${idx}`);
          values.push(data[key]);
        }
        idx += 1;
      }
    }

    if (data.tags !== undefined) {
      fields.push(`tags = $${idx}::text[]`);
      values.push(this.#normalizeTags(data.tags));
      idx += 1;
    }

    if (fields.length === 0) {
      throw new Error('没有可更新的字段');
    }

    values.push(productId);

    const updateQuery = `
      UPDATE points_products
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${idx}
      RETURNING *
    `;

    const result = await query(updateQuery, values);
    return result.rows[0] || null;
  }

  /**
   * 新增虚拟商品库存（批量添加）
   */
  static async addInventoryItems(productId, codes = [], operatorId = null) {
    if (!Array.isArray(codes) || codes.length === 0) {
      throw new Error('请提供至少一个兑换码');
    }

    const normalizedCodes = codes
      .map(code => (typeof code === 'string' ? code.trim() : ''))
      .filter(code => code);

    if (normalizedCodes.length === 0) {
      throw new Error('兑换码格式无效');
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO virtual_product_items (product_id, code)
         VALUES ${normalizedCodes.map((_, idx) => `($1, $${idx + 2})`).join(', ')}
         ON CONFLICT (product_id, code) DO NOTHING`,
        [productId, ...normalizedCodes]
      );

      if (operatorId) {
        await client.query(
          `UPDATE points_products
           SET updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`, [productId]
        );
      }

      await client.query('COMMIT');

      const stats = await query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'available') AS available_items,
           COUNT(*) FILTER (WHERE status = 'used') AS used_items,
           COUNT(*) AS total_items
         FROM virtual_product_items
         WHERE product_id = $1`,
        [productId]
      );

      return {
        inserted: normalizedCodes.length,
        inventory: stats.rows[0]
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取虚拟商品库存明细
   */
  static async getInventoryItems(productId, options = {}) {
    const {
      status = null,
      limit = 50,
      offset = 0
    } = options;

    const conditions = ['product_id = $1'];
    const values = [productId];

    if (status) {
      conditions.push('status = $2');
      values.push(status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const listQuery = `
      SELECT id, code, status, redeemed_by, redeemed_at, created_at, updated_at
      FROM virtual_product_items
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${status ? 3 : 2} OFFSET $${status ? 4 : 3}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM virtual_product_items
      ${whereClause}
    `;

    const listValues = status ? [...values, limit, offset] : [...values, limit, offset];

    const [itemsResult, countResult] = await Promise.all([
      query(listQuery, listValues),
      query(countQuery, values)
    ]);

    return {
      items: itemsResult.rows,
      total: parseInt(countResult.rows[0]?.total || 0, 10)
    };
  }

  /**
   * 用户兑换虚拟商品
   */
  static async redeemVirtualProduct(productId, userId) {
    const client = await getClient();
    const releaseClient = true;

    try {
      await client.query('BEGIN');

      const productResult = await client.query(
        `SELECT * FROM points_products
         WHERE id = $1 AND type = 'virtual' AND is_active = TRUE
         FOR UPDATE`,
        [productId]
      );

      if (productResult.rows.length === 0) {
        throw new Error('虚拟商品不存在或已下架');
      }

      const product = productResult.rows[0];

      const inventoryResult = await client.query(
        `SELECT id, code
         FROM virtual_product_items
         WHERE product_id = $1 AND status = 'available'
         ORDER BY id
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        [productId]
      );

      if (inventoryResult.rows.length === 0) {
        throw new Error('虚拟商品库存不足');
      }

      const inventoryItem = inventoryResult.rows[0];

      const deductionResult = await Points.deductPoints(userId, {
        points: product.points_cost,
        source: 'points_mall',
        description: `兑换虚拟商品「${product.name}」`,
        reference_id: productId,
        reference_type: 'points_product',
        operator_id: userId,
        client
      });

      const exchangeResult = await client.query(
        `INSERT INTO points_exchanges
          (user_id, product_id, points_cost, quantity, total_points, status, exchange_data)
         VALUES ($1, $2, $3, 1, $3, 'completed', $4::jsonb)
         RETURNING *`,
        [
          userId,
          productId,
          product.points_cost,
          JSON.stringify({ code: inventoryItem.code })
        ]
      );

      await client.query(
        `UPDATE virtual_product_items
         SET status = 'used', redeemed_by = $2, redeemed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [inventoryItem.id, userId]
      );

      if (product.stock !== null && product.stock !== undefined && product.stock >= 0) {
        await client.query(
          `UPDATE points_products
           SET stock = GREATEST(stock - 1, 0)
           WHERE id = $1`,
          [productId]
        );
      }

      await client.query('COMMIT');

      return {
        product,
        inventoryItem,
        exchange: exchangeResult.rows[0],
        points: deductionResult
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      if (releaseClient) {
        client.release();
      }
    }
  }

  /**
   * 用户端：查询兑换记录
   */
  static async getUserExchanges(userId, options = {}) {
    const {
      status = null,
      limit = 20,
      offset = 0
    } = options;

    const conditions = [
      'pe.user_id = $1',
      "pp.type = 'virtual'"
    ];
    const values = [userId];
    let idx = 2;

    if (status) {
      conditions.push(`pe.status = $${idx}`);
      values.push(status);
      idx += 1;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const listQuery = `
      SELECT
        pe.*,
        pp.name AS product_name,
        pp.points_cost AS product_points_cost,
        pp.image_url,
        pp.tags,
        COALESCE(pe.exchange_data->>'code', vpi.code) AS redeem_code
      FROM points_exchanges pe
      JOIN points_products pp ON pe.product_id = pp.id
      LEFT JOIN virtual_product_items vpi ON vpi.product_id = pe.product_id
        AND vpi.code = pe.exchange_data->>'code'
      ${whereClause}
      ORDER BY pe.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM points_exchanges pe
      JOIN points_products pp ON pe.product_id = pp.id
      ${whereClause}
    `;

    const listValues = [...values, limit, offset];

    const [listResult, countResult] = await Promise.all([
      query(listQuery, listValues),
      query(countQuery, values)
    ]);

    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    return {
      items: listResult.rows,
      pagination: {
        total,
        limit,
        offset,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: offset > 0
      }
    };
  }

  /**
   * 管理端：查询兑换记录
   */
  static async getAdminExchanges(options = {}) {
    const {
      user_id = null,
      product_id = null,
      status = null,
      start_at = null,
      end_at = null,
      limit = 20,
      offset = 0
    } = options;

    const conditions = ["pp.type = 'virtual'"];
    const values = [];
    let idx = 1;

    if (user_id) {
      conditions.push(`pe.user_id = $${idx}`);
      values.push(user_id);
      idx += 1;
    }

    if (product_id) {
      conditions.push(`pe.product_id = $${idx}`);
      values.push(product_id);
      idx += 1;
    }

    if (status) {
      conditions.push(`pe.status = $${idx}`);
      values.push(status);
      idx += 1;
    }

    if (start_at) {
      conditions.push(`pe.created_at >= $${idx}`);
      values.push(start_at);
      idx += 1;
    }

    if (end_at) {
      conditions.push(`pe.created_at <= $${idx}`);
      values.push(end_at);
      idx += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const listQuery = `
      SELECT
        pe.*,
        pp.name AS product_name,
        pp.points_cost AS product_points_cost,
        pp.tags,
        u.username,
        u.email,
        COALESCE(pe.exchange_data->>'code', vpi.code) AS redeem_code
      FROM points_exchanges pe
      JOIN points_products pp ON pe.product_id = pp.id
      JOIN users u ON pe.user_id = u.id
      LEFT JOIN virtual_product_items vpi ON vpi.product_id = pe.product_id
        AND vpi.code = pe.exchange_data->>'code'
      ${whereClause}
      ORDER BY pe.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM points_exchanges pe
      JOIN points_products pp ON pe.product_id = pp.id
      ${whereClause}
    `;

    const listValues = [...values, limit, offset];

    const [listResult, countResult] = await Promise.all([
      query(listQuery, listValues),
      query(countQuery, values)
    ]);

    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    return {
      items: listResult.rows,
      pagination: {
        total,
        limit,
        offset,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: offset > 0
      }
    };
  }
}

module.exports = PointsProduct;
