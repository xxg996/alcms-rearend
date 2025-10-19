/**
 * 系统设置数据模型
 * 负责读取与维护 system_settings 表中的配置项
 */

const { query } = require('../config/database');

class SystemSetting {
  /**
   * 获取指定键的系统设置，返回JSON对象
   */
  static async getSetting(key, defaultValue = null) {
    const result = await query(
      'SELECT value FROM system_settings WHERE key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      return defaultValue;
    }

    return result.rows[0].value || defaultValue;
  }

  /**
   * 写入或更新系统设置
   */
  static async upsertSetting(key, value, description = null, updatedBy = null) {
    const result = await query(
      `INSERT INTO system_settings (key, value, description, updated_by)
       VALUES ($1, $2::jsonb, $3, $4)
       ON CONFLICT (key)
       DO UPDATE SET
         value = EXCLUDED.value,
         description = COALESCE(EXCLUDED.description, system_settings.description),
         updated_at = CURRENT_TIMESTAMP,
         updated_by = EXCLUDED.updated_by
       RETURNING *`,
      [key, JSON.stringify(value), description, updatedBy]
    );

    return result.rows[0];
  }

  /**
   * 获取CORS白名单配置
   */
  static async getCorsConfig() {
    const defaultConfig = {
      allowed_origins: process.env.NODE_ENV === 'production'
        ? []
        : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001']
    };

    const stored = await this.getSetting('security_cors', defaultConfig);

    if (!stored || !Array.isArray(stored.allowed_origins)) {
      return defaultConfig;
    }

    const sanitizeOrigin = (origin) => {
      if (typeof origin !== 'string') {
        return null;
      }

      const trimmed = origin.trim();
      if (!trimmed) {
        return null;
      }

      try {
        const { protocol, host, port } = new URL(trimmed);
        if (protocol !== 'http:' && protocol !== 'https:') {
          return null;
        }

        const normalizedPort = port ? `:${port}` : '';
        return `${protocol}//${host}${normalizedPort}`;
      } catch {
        // 允许直接配置域名/IP/本地域名，不限制端口和协议
        if (/^([a-zA-Z0-9.-]+)$/.test(trimmed)) {
          return trimmed.toLowerCase();
        }

        return null;
      }
    };

    const sanitizedOrigins = stored.allowed_origins
      .map(sanitizeOrigin)
      .filter(Boolean);

    const uniqueOrigins = Array.from(new Set(sanitizedOrigins));

    if (uniqueOrigins.length === 0) {
      return defaultConfig;
    }

    return {
      allowed_origins: uniqueOrigins
    };
  }

  /**
   * 获取邀请佣金配置
   */
  static async getReferralCommissionConfig() {
    const defaultConfig = {
      enabled: true,
      first_rate: 0.10,
      renewal_rate: 0,
      card_type_rates: {
        points: 0.10,
        download: 0.10
      }
    };

    const stored = await this.getSetting('referral_commission', defaultConfig);

    if (!stored) {
      return defaultConfig;
    }

    const merged = {
      ...defaultConfig,
      ...stored,
      card_type_rates: {
        ...defaultConfig.card_type_rates,
        ...(stored.card_type_rates || {})
      }
    };

    // 确保返佣比例均为数字，避免字符串导致计算异常
    const sanitizedCardTypeRates = {};
    if (merged.card_type_rates) {
      for (const [cardType, rateValue] of Object.entries(merged.card_type_rates)) {
        const numericRate = Number(rateValue);
        if (!Number.isNaN(numericRate)) {
          sanitizedCardTypeRates[cardType] = Number(numericRate.toFixed(4));
        }
      }
    }

    return {
      ...merged,
      card_type_rates: sanitizedCardTypeRates
    };
  }

  /**
   * 获取资源售卖分成配置
   * 默认平台分成10%，返回值已做数值校验并带内存缓存
   */
  static async getResourceSaleFeeConfig(forceRefresh = false) {
    const cacheTTL = 5 * 60 * 1000; // 5分钟缓存
    const now = Date.now();

    if (!forceRefresh && this._resourceSaleFeeCache && (now - this._resourceSaleFeeCache.timestamp) < cacheTTL) {
      return this._resourceSaleFeeCache.value;
    }

    const defaultConfig = { fee_rate: 0.10 };
    const stored = await this.getSetting('resource_sale_fee', defaultConfig);

    const rawRate = stored && Object.prototype.hasOwnProperty.call(stored, 'fee_rate')
      ? Number(stored.fee_rate)
      : defaultConfig.fee_rate;

    const sanitizedRate = Number.isFinite(rawRate) && rawRate >= 0 && rawRate <= 1
      ? rawRate
      : defaultConfig.fee_rate;

    const value = { fee_rate: sanitizedRate };
    this._resourceSaleFeeCache = {
      value,
      timestamp: now
    };

    return value;
  }

  /**
   * 获取前端轮播图配置
   * 采用 system_settings.frontend_banners 中存储的JSON数组
   */
  static async getFrontendBanners() {
    const stored = await this.getSetting('frontend_banners', []);

    if (!Array.isArray(stored)) {
      return [];
    }

    return stored
      .map(item => {
        const imageUrl = typeof item?.image_url === 'string' ? item.image_url.trim() : '';
        const linkUrl = typeof item?.link_url === 'string' ? item.link_url.trim() : '';
        const title = typeof item?.title === 'string' ? item.title.trim() : null;
        const titleColor = typeof item?.title_color === 'string' ? item.title_color.trim() : null;

        return {
          image_url: imageUrl,
          link_url: linkUrl,
          title: title || null,
          title_color: titleColor || null
        };
      })
      .filter(item => item.image_url);
  }
}

module.exports = SystemSetting;
