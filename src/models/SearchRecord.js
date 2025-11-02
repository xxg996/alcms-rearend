/**
 * 搜索记录数据模型
 * 负责记录搜索行为并提供热搜统计能力
 */

const { query } = require('../config/database');
const { logger } = require('../utils/logger');

class SearchRecord {
  static TYPES = new Set(['resource', 'community']);

  /**
   * 规范化搜索关键词
   * @param {string} keyword
   * @returns {{ keyword: string, normalized: string } | null}
   */
  static normalizeKeyword(keyword) {
    if (typeof keyword !== 'string') {
      return null;
    }

    const trimmed = keyword.trim();
    if (!trimmed) {
      return null;
    }

    return {
      keyword: trimmed,
      normalized: trimmed.toLowerCase()
    };
  }

  /**
   * 规范化搜索类型
   * @param {string} type
   * @returns {string|null}
   */
  static normalizeType(type) {
    if (!type) {
      return null;
    }

    const normalized = String(type).trim().toLowerCase();
    const mapping = {
      resources: 'resource',
      resource: 'resource',
      community: 'community',
      communities: 'community'
    };

    const candidate = mapping[normalized] || normalized;
    return this.TYPES.has(candidate) ? candidate : null;
  }

  /**
   * 记录一次搜索行为
   * @param {Object} payload
   * @param {string} payload.keyword 搜索关键词
   * @param {string} payload.searchType 搜索类型（resource/community）
   * @param {number} [payload.userId]
   * @param {string} [payload.ipAddress]
   */
  static async logSearch({ keyword, searchType, userId = null, ipAddress = null }) {
    try {
      const keywordInfo = this.normalizeKeyword(keyword);
      const normalizedType = this.normalizeType(searchType);

      if (!keywordInfo || !normalizedType) {
        return;
      }

      await query(
        `INSERT INTO search_records (
          keyword,
          normalized_keyword,
          search_type,
          user_id,
          ip_address
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          keywordInfo.keyword,
          keywordInfo.normalized,
          normalizedType,
          userId || null,
          ipAddress || null
        ]
      );
    } catch (error) {
      logger.warn('记录搜索关键词失败', {
        error: error.message,
        keyword,
        searchType
      });
    }
  }

  /**
   * 获取热搜关键词
   * @param {Object} options
   * @param {string} [options.searchType] 搜索类型（resource/community）
   * @param {number} [options.limit] 返回数量
   * @returns {Promise<Array>}
   */
  static async getHotKeywords({ searchType = null, limit = 10 } = {}) {
    const normalizedType = this.normalizeType(searchType);
    const numericLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (normalizedType) {
      conditions.push(`search_type = $${paramIndex}`);
      values.push(normalizedType);
      paramIndex += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const queryText = `
      SELECT
        search_type,
        normalized_keyword,
        MAX(keyword) AS keyword,
        COUNT(*) AS search_count,
        MAX(created_at) AS last_searched_at
      FROM search_records
      ${whereClause}
      GROUP BY search_type, normalized_keyword
      ORDER BY search_count DESC, last_searched_at DESC
      LIMIT $${paramIndex}
    `;

    values.push(numericLimit);

    const result = await query(queryText, values);

    return result.rows.map(row => ({
      keyword: row.keyword,
      normalized_keyword: row.normalized_keyword,
      search_type: row.search_type,
      search_count: Number(row.search_count) || 0,
      last_searched_at: row.last_searched_at
    }));
  }
}

module.exports = SearchRecord;
