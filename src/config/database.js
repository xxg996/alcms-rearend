/**
 * 数据库配置文件
 * 使用 node-postgres 连接池管理PostgreSQL连接
 * Source: context7-mcp on node-postgres best practices
 */

const { Pool } = require('pg');
require('dotenv').config();

// 创建数据库连接池 - 遵循node-postgres最佳实践
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  
  // 连接池配置 - 基于context7-mcp推荐配置
  max: 20,                    // 最大连接数
  idleTimeoutMillis: 30000,   // 空闲连接超时时间
  connectionTimeoutMillis: 2000, // 连接超时时间
  maxLifetimeSeconds: 60      // 连接最大生存时间
});

// 监听连接池事件 - 用于调试和监控
pool.on('connect', (client) => {
  console.log('新的数据库连接已建立');
});

pool.on('error', (err, client) => {
  console.error('数据库连接池发生错误:', err);
  process.exit(-1);
});

/**
 * 执行SQL查询的便捷方法
 * @param {string} text - SQL查询语句
 * @param {Array} params - 查询参数
 * @returns {Promise} 查询结果
 */
const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('执行查询:', { text, duration, rows: res.rowCount });
  return res;
};

/**
 * 获取客户端连接（用于事务操作）
 * @returns {Promise} 数据库客户端
 */
const getClient = () => {
  return pool.connect();
};

/**
 * 优雅关闭数据库连接池
 */
const closePool = async () => {
  await pool.end();
  console.log('数据库连接池已关闭');
};

module.exports = {
  query,
  getClient,
  closePool,
  pool
};
