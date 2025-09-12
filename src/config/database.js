/**
 * 优化的数据库配置
 * 提升连接池性能和查询效率
 */

const { Pool } = require('pg');
const { performanceCollector } = require('../middleware/performance');
require('dotenv').config();
const { logger } = require('../utils/logger');

// 创建优化的数据库连接池
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  
  // 优化的连接池配置
  max: parseInt(process.env.DB_POOL_MAX) || 50,              // 增加最大连接数
  min: parseInt(process.env.DB_POOL_MIN) || 5,               // 设置最小连接数
  idleTimeoutMillis: 60000,                                  // 空闲连接超时时间 1分钟
  connectionTimeoutMillis: 5000,                             // 连接超时时间 5秒
  maxLifetimeSeconds: 1800,                                  // 连接最大生存时间 30分钟
  
  // 性能优化配置
  statement_timeout: 30000,                                  // 语句超时 30秒
  query_timeout: 30000,                                      // 查询超时 30秒
  application_name: 'alcms-backend',                         // 应用名称
  
  // 连接池行为配置
  allowExitOnIdle: false,                                    // 保持进程运行
  enableSslRenegotiation: false,                             // 禁用 SSL 重协商
  keepAlive: true,                                           // 启用 TCP keepalive
  keepAliveInitialDelayMillis: 10000,                        // keepalive 初始延迟
});

// 连接池事件监听
pool.on('connect', (client) => {
  // 为每个新连接设置默认配置
  client.query('SET statement_timeout = 30000');
  client.query('SET lock_timeout = 10000');
  client.query('SET idle_in_transaction_session_timeout = 60000');
  
  if (process.env.NODE_ENV === 'development') {
    logger.info('新的数据库连接已建立');
  }
});

pool.on('acquire', (client) => {
  if (process.env.NODE_ENV === 'development') {
    logger.info(`连接被获取，当前池大小: ${pool.totalCount}，空闲连接: ${pool.idleCount}`);
  }
});

pool.on('remove', (client) => {
  if (process.env.NODE_ENV === 'development') {
    logger.info(`连接被移除，当前池大小: ${pool.totalCount}，空闲连接: ${pool.idleCount}`);
  }
});

pool.on('error', (err, client) => {
  logger.error('数据库连接池发生错误:', err);
  // 记录错误但不终止进程
});

/**
 * 优化的查询方法
 * 包含性能监控和查询优化
 */
const query = async (text, params, options = {}) => {
  const {
    timeout = 30000,
    logSlowQuery = true,
    cache = false,
    cacheKey = null,
    cacheTTL = 300
  } = options;

  const start = Date.now();
  let client;
  
  try {
    // 如果启用缓存，先尝试从缓存获取
    if (cache && cacheKey) {
      const cacheManager = require('../utils/cache');
      const cached = await cacheManager.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    client = await pool.connect();
    
    // 设置查询超时
    if (timeout) {
      await client.query(`SET statement_timeout = ${timeout}`);
    }
    
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    
    // 记录慢查询
    if (logSlowQuery && duration > 100) {
      logger.warn('慢查询检测:', {
        query: text.substring(0, 200),
        duration: `${duration}ms`,
        rows: res.rowCount
      });
      
      // 记录到性能收集器
      if (performanceCollector) {
        performanceCollector.recordSlowQuery(text, duration);
      }
    }
    
    // 开发环境下的详细日志
    if (process.env.NODE_ENV === 'development' && duration > 50) {
      logger.info('查询执行:', {
        query: text.substring(0, 100),
        duration: `${duration}ms`,
        rows: res.rowCount
      });
    }
    
    // 如果启用缓存，存储结果
    if (cache && cacheKey) {
      const cacheManager = require('../utils/cache');
      await cacheManager.set(cacheKey, res, cacheTTL);
    }
    
    return res;
  } catch (error) {
    logger.error('查询执行失败:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
};

/**
 * 批量查询优化
 * 使用单个连接执行多个查询
 */
const batchQuery = async (queries) => {
  const client = await pool.connect();
  const results = [];
  
  try {
    await client.query('BEGIN');
    
    for (const { text, params } of queries) {
      const res = await client.query(text, params);
      results.push(res);
    }
    
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * 事务处理优化
 * 提供更好的事务管理
 */
const transaction = async (callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * 获取连接池状态
 */
const getPoolStats = () => {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  };
};

/**
 * 预热连接池
 * 在应用启动时建立最小连接数
 */
const warmupPool = async () => {
  logger.info('开始预热数据库连接池...');
  const minConnections = parseInt(process.env.DB_POOL_MIN) || 5;
  const promises = [];
  
  for (let i = 0; i < minConnections; i++) {
    promises.push(query('SELECT 1'));
  }
  
  await Promise.all(promises);
  logger.info(`连接池预热完成，建立了 ${minConnections} 个连接`);
};

/**
 * 优雅关闭连接池
 */
const closePool = async () => {
  try {
    await pool.end();
    logger.info('数据库连接池已关闭');
  } catch (error) {
    logger.error('关闭连接池失败:', error);
  }
};

/**
 * 创建索引的辅助方法
 */
const createIndexIfNotExists = async (tableName, indexName, columns, unique = false) => {
  try {
    const indexType = unique ? 'UNIQUE INDEX' : 'INDEX';
    const columnsStr = Array.isArray(columns) ? columns.join(', ') : columns;
    
    await query(`
      CREATE ${indexType} IF NOT EXISTS ${indexName}
      ON ${tableName} (${columnsStr})
    `);
    
    logger.info(`索引创建成功: ${indexName} on ${tableName}`);
  } catch (error) {
    logger.error(`索引创建失败: ${indexName}`, error);
  }
};

/**
 * 分析查询计划
 */
const explainQuery = async (text, params) => {
  const explainText = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${text}`;
  const result = await query(explainText, params);
  return result.rows[0]['QUERY PLAN'];
};

/**
 * 获取表统计信息
 */
const getTableStats = async (tableName) => {
  const result = await query(`
    SELECT 
      schemaname,
      tablename,
      n_live_tup as live_rows,
      n_dead_tup as dead_rows,
      last_vacuum,
      last_autovacuum,
      last_analyze,
      last_autoanalyze
    FROM pg_stat_user_tables
    WHERE tablename = $1
  `, [tableName]);
  
  return result.rows[0];
};

/**
 * 执行 VACUUM 和 ANALYZE
 */
const optimizeTable = async (tableName) => {
  try {
    await query(`VACUUM ANALYZE ${tableName}`);
    logger.info(`表优化完成: ${tableName}`);
  } catch (error) {
    logger.error(`表优化失败: ${tableName}`, error);
  }
};

module.exports = {
  pool,
  query,
  batchQuery,
  transaction,
  getPoolStats,
  warmupPool,
  closePool,
  createIndexIfNotExists,
  explainQuery,
  getTableStats,
  optimizeTable,
  // 保留兼容性
  getClient: () => pool.connect()
};