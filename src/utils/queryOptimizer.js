/**
 * 数据库查询优化工具类
 * 提供批量查询、预加载、缓存等优化功能
 */

const { query, getClient } = require('../config/database');

class QueryOptimizer {
  /**
   * 批量预加载关联数据，解决N+1查询问题
   * @param {Array} records - 主记录数组
   * @param {Object} options - 预加载配置
   * @returns {Promise<Array>} 包含关联数据的记录
   */
  static async batchPreload(records, options) {
    if (!records || records.length === 0) return records;

    const { associations = [] } = options;

    for (const assoc of associations) {
      const {
        foreignKey,
        targetTable,
        targetKey = 'id',
        as,
        select = '*',
        where = '',
        single = false
      } = assoc;

      // 收集所有外键值
      const foreignKeyValues = [...new Set(records.map(r => r[foreignKey]).filter(v => v != null))];
      
      if (foreignKeyValues.length === 0) continue;

      // 构建批量查询
      const placeholders = foreignKeyValues.map((_, i) => `$${i + 1}`).join(',');
      let queryText = `
        SELECT ${select}
        FROM ${targetTable}
        WHERE ${targetKey} IN (${placeholders})
      `;

      if (where) {
        queryText += ` AND ${where}`;
      }

      // 执行批量查询
      const result = await query(queryText, foreignKeyValues);
      
      // 构建查找映射
      const dataMap = {};
      result.rows.forEach(row => {
        const key = row[targetKey];
        if (single) {
          dataMap[key] = row;
        } else {
          if (!dataMap[key]) dataMap[key] = [];
          dataMap[key].push(row);
        }
      });

      // 关联数据到主记录
      records.forEach(record => {
        const key = record[foreignKey];
        record[as] = single ? (dataMap[key] || null) : (dataMap[key] || []);
      });
    }

    return records;
  }

  /**
   * 批量加载多对多关联数据
   * @param {Array} records - 主记录数组
   * @param {Object} options - 关联配置
   * @returns {Promise<Array>} 包含关联数据的记录
   */
  static async batchLoadManyToMany(records, options) {
    if (!records || records.length === 0) return records;

    const {
      sourceKey = 'id',
      junctionTable,
      junctionSourceKey,
      junctionTargetKey,
      targetTable,
      targetKey = 'id',
      as,
      select = '*'
    } = options;

    // 收集所有主键
    const sourceIds = records.map(r => r[sourceKey]).filter(v => v != null);
    
    if (sourceIds.length === 0) return records;

    // 查询关联数据
    const queryText = `
      SELECT 
        j.${junctionSourceKey} as source_id,
        t.${select}
      FROM ${junctionTable} j
      JOIN ${targetTable} t ON j.${junctionTargetKey} = t.${targetKey}
      WHERE j.${junctionSourceKey} = ANY($1)
      ORDER BY j.${junctionSourceKey}, t.${targetKey}
    `;

    const result = await query(queryText, [sourceIds]);

    // 构建关联映射
    const dataMap = {};
    result.rows.forEach(row => {
      const sourceId = row.source_id;
      delete row.source_id; // 移除临时字段
      
      if (!dataMap[sourceId]) dataMap[sourceId] = [];
      dataMap[sourceId].push(row);
    });

    // 关联到主记录
    records.forEach(record => {
      record[as] = dataMap[record[sourceKey]] || [];
    });

    return records;
  }

  /**
   * 优化的分页查询
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 分页结果
   */
  static async paginatedQuery(options) {
    const {
      table,
      select = '*',
      where = '1=1',
      params = [],
      orderBy = 'id DESC',
      page = 1,
      limit = 20,
      countDistinct = null
    } = options;

    const offset = (page - 1) * limit;
    
    // 使用CTE优化计数查询
    const countField = countDistinct ? `COUNT(DISTINCT ${countDistinct})` : 'COUNT(*)';
    const queryText = `
      WITH filtered_data AS (
        SELECT ${select}
        FROM ${table}
        WHERE ${where}
      ),
      count_data AS (
        SELECT ${countField} as total
        FROM ${table}
        WHERE ${where}
      )
      SELECT 
        (SELECT total FROM count_data) as total_count,
        json_agg(fd.* ORDER BY ${orderBy}) as data
      FROM (
        SELECT * FROM filtered_data
        ORDER BY ${orderBy}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      ) fd
    `;

    const result = await query(queryText, [...params, limit, offset]);
    
    const row = result.rows[0];
    const totalCount = parseInt(row?.total_count || 0);
    const data = row?.data || [];

    return {
      data,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    };
  }

  /**
   * 使用窗口函数的高级查询
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 查询结果
   */
  static async windowQuery(options) {
    const {
      table,
      select = '*',
      where = '1=1',
      params = [],
      windowFunctions = [],
      orderBy = 'id DESC'
    } = options;

    // 构建窗口函数部分
    const windowSelects = windowFunctions.map(w => {
      const { function: fn, partitionBy, orderBy: windowOrder, as } = w;
      let windowDef = '';
      
      if (partitionBy) {
        windowDef += `PARTITION BY ${partitionBy} `;
      }
      
      if (windowOrder) {
        windowDef += `ORDER BY ${windowOrder}`;
      }
      
      return `${fn} OVER (${windowDef}) as ${as}`;
    });

    const allSelects = [select, ...windowSelects].join(', ');

    const queryText = `
      SELECT ${allSelects}
      FROM ${table}
      WHERE ${where}
      ORDER BY ${orderBy}
    `;

    const result = await query(queryText, params);
    return result.rows;
  }

  /**
   * 批量插入优化
   * @param {string} table - 表名
   * @param {Array} records - 记录数组
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 插入的记录
   */
  static async batchInsert(table, records, options = {}) {
    if (!records || records.length === 0) return [];

    const { 
      returning = 'id',
      onConflict = '',
      chunkSize = 1000 
    } = options;

    const results = [];
    
    // 分批处理大量数据
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      
      // 获取字段名
      const fields = Object.keys(chunk[0]);
      const fieldNames = fields.join(', ');
      
      // 构建VALUES部分
      const values = [];
      const valuePlaceholders = [];
      let paramIndex = 1;
      
      chunk.forEach(record => {
        const recordPlaceholders = fields.map(() => {
          const placeholder = `$${paramIndex}`;
          paramIndex++;
          return placeholder;
        });
        
        valuePlaceholders.push(`(${recordPlaceholders.join(', ')})`);
        fields.forEach(field => values.push(record[field]));
      });
      
      // 构建完整查询
      let queryText = `
        INSERT INTO ${table} (${fieldNames})
        VALUES ${valuePlaceholders.join(', ')}
      `;
      
      if (onConflict) {
        queryText += ` ${onConflict}`;
      }
      
      if (returning) {
        queryText += ` RETURNING ${returning}`;
      }
      
      const result = await query(queryText, values);
      results.push(...result.rows);
    }
    
    return results;
  }

  /**
   * 批量更新优化
   * @param {string} table - 表名
   * @param {Array} updates - 更新数据数组
   * @param {string} keyField - 主键字段
   * @returns {Promise<number>} 更新的记录数
   */
  static async batchUpdate(table, updates, keyField = 'id') {
    if (!updates || updates.length === 0) return 0;

    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      // 创建临时表
      const tempTable = `temp_update_${Date.now()}`;
      const fields = Object.keys(updates[0]);
      const fieldDefs = fields.map(f => `${f} TEXT`).join(', ');
      
      await client.query(`
        CREATE TEMP TABLE ${tempTable} (${fieldDefs})
      `);
      
      // 批量插入到临时表
      await QueryOptimizer.batchInsert(tempTable, updates, { returning: null });
      
      // 执行批量更新
      const updateSets = fields
        .filter(f => f !== keyField)
        .map(f => `${f} = ${tempTable}.${f}::${this.getFieldType(table, f)}`)
        .join(', ');
      
      const result = await client.query(`
        UPDATE ${table}
        SET ${updateSets}
        FROM ${tempTable}
        WHERE ${table}.${keyField} = ${tempTable}.${keyField}::INTEGER
      `);
      
      await client.query('COMMIT');
      return result.rowCount;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取字段类型（简化版）
   * @private
   */
  static getFieldType(table, field) {
    // 这里应该从数据库元数据获取实际类型
    // 简化处理，根据字段名推断
    if (field.includes('_id') || field === 'id') return 'INTEGER';
    if (field.includes('_at')) return 'TIMESTAMP';
    if (field.includes('is_') || field.includes('has_')) return 'BOOLEAN';
    if (field.includes('count') || field.includes('points')) return 'INTEGER';
    return 'TEXT';
  }

  /**
   * 使用COPY命令的超快速批量导入
   * @param {string} table - 表名
   * @param {Array} records - 记录数组
   * @param {Array} columns - 列名数组
   * @returns {Promise<void>}
   */
  static async bulkCopy(table, records, columns) {
    const client = await getClient();
    const stream = client.query(
      `COPY ${table} (${columns.join(', ')}) FROM STDIN WITH (FORMAT csv)`
    );
    
    for (const record of records) {
      const row = columns.map(col => record[col] || '\\N').join(',');
      stream.write(`${row}\n`);
    }
    
    stream.end();
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
    
    client.release();
  }

  /**
   * 智能查询缓存键生成
   * @param {string} prefix - 缓存键前缀
   * @param {Object} params - 查询参数
   * @returns {string} 缓存键
   */
  static generateCacheKey(prefix, params) {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        if (params[key] !== undefined && params[key] !== null) {
          acc[key] = params[key];
        }
        return acc;
      }, {});
    
    const hash = require('crypto')
      .createHash('md5')
      .update(JSON.stringify(sortedParams))
      .digest('hex');
    
    return `${prefix}:${hash}`;
  }

  /**
   * 执行带超时的查询
   * @param {string} text - SQL查询
   * @param {Array} params - 参数
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<Object>} 查询结果
   */
  static async queryWithTimeout(text, params, timeout = 30000) {
    const client = await getClient();
    
    try {
      // 设置语句超时
      await client.query(`SET statement_timeout = ${timeout}`);
      
      const result = await client.query(text, params);
      return result;
      
    } finally {
      // 重置超时设置
      await client.query('RESET statement_timeout');
      client.release();
    }
  }
}

module.exports = QueryOptimizer;