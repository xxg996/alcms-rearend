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
   * 获取邀请佣金配置
   */
  static async getReferralCommissionConfig() {
    const defaultConfig = {
      enabled: true,
      first_rate: 0.10,
      renewal_rate: 0,
      card_type_rates: {
        points: 0.10
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
}

module.exports = SystemSetting;
