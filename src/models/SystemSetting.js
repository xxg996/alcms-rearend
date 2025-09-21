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
      renewal_rate: 0
    };

    const stored = await this.getSetting('referral_commission', defaultConfig);

    if (!stored) {
      return defaultConfig;
    }

    return {
      ...defaultConfig,
      ...stored
    };
  }
}

module.exports = SystemSetting;
