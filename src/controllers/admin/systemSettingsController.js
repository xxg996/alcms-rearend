/**
 * 系统设置管理控制器
 * 提供系统设置的增删改查功能
 */

const SystemSetting = require('../../models/SystemSetting');
const { logger } = require('../../utils/logger');

/**
 * 获取所有系统设置
 */
const getAllSettings = async (req, res) => {
  try {
    const { query } = require('../../config/database');
    const result = await query('SELECT * FROM system_settings ORDER BY key');

    res.json({
      success: true,
      message: '获取系统设置成功',
      data: result.rows
    });
  } catch (error) {
    logger.error('获取系统设置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统设置失败',
      error: error.message
    });
  }
};

/**
 * 获取单个系统设置
 */
const getSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const value = await SystemSetting.getSetting(key);

    if (value === null) {
      return res.status(404).json({
        success: false,
        message: '系统设置不存在'
      });
    }

    res.json({
      success: true,
      message: '获取系统设置成功',
      data: {
        key,
        value
      }
    });
  } catch (error) {
    logger.error('获取系统设置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统设置失败',
      error: error.message
    });
  }
};

/**
 * 更新或创建系统设置
 */
const upsertSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;
    const updatedBy = req.user?.id;

    if (!value) {
      return res.status(400).json({
        success: false,
        message: '设置值不能为空'
      });
    }

    const result = await SystemSetting.upsertSetting(key, value, description, updatedBy);

    res.json({
      success: true,
      message: '更新系统设置成功',
      data: result
    });
  } catch (error) {
    logger.error('更新系统设置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新系统设置失败',
      error: error.message
    });
  }
};

/**
 * 删除系统设置
 */
const deleteSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { query } = require('../../config/database');

    const result = await query('DELETE FROM system_settings WHERE key = $1 RETURNING *', [key]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: '系统设置不存在'
      });
    }

    res.json({
      success: true,
      message: '删除系统设置成功',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('删除系统设置失败:', error);
    res.status(500).json({
      success: false,
      message: '删除系统设置失败',
      error: error.message
    });
  }
};

/**
 * 批量更新系统设置
 */
const batchUpdateSettings = async (req, res) => {
  try {
    const { settings } = req.body; // 期望是一个包含多个设置的数组
    const updatedBy = req.user?.id;

    if (!Array.isArray(settings) || settings.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的设置数组'
      });
    }

    const results = [];

    for (const setting of settings) {
      const { key, value, description } = setting;
      if (key && value !== undefined) {
        const result = await SystemSetting.upsertSetting(key, value, description, updatedBy);
        results.push(result);
      }
    }

    res.json({
      success: true,
      message: `批量更新 ${results.length} 个系统设置成功`,
      data: results
    });
  } catch (error) {
    logger.error('批量更新系统设置失败:', error);
    res.status(500).json({
      success: false,
      message: '批量更新系统设置失败',
      error: error.message
    });
  }
};

/**
 * 重置系统设置为默认值
 */
const resetToDefault = async (req, res) => {
  try {
    const { key } = req.params;
    const updatedBy = req.user?.id;

    // 默认配置
    const defaultSettings = {
      referral_commission: {
        enabled: true,
        first_rate: 0.10,
        renewal_rate: 0
      },
      resource_sale_fee: {
        fee_rate: 0.10
      },
      system_maintenance: {
        enabled: false,
        message: "系统维护中，请稍后访问"
      },
      security_cors: {
        allowed_origins: []
      },
      account_settings: {
        registration_enabled: true,
        email_verification_required: false
      },
      smtp_config: {
        from: "",
        host: "",
        port: 465,
        secure: true,
        password: "",
        username: ""
      },
      user_limit_settings: {
        post_daily_limit: 0,
        comment_daily_limit: 0,
        resource_daily_limit: 0
      }
    };

    if (!defaultSettings[key]) {
      return res.status(400).json({
        success: false,
        message: '未知的系统设置项'
      });
    }

    const result = await SystemSetting.upsertSetting(
      key,
      defaultSettings[key],
      `${key} 默认配置`,
      updatedBy
    );

    res.json({
      success: true,
      message: '重置系统设置成功',
      data: result
    });
  } catch (error) {
    logger.error('重置系统设置失败:', error);
    res.status(500).json({
      success: false,
      message: '重置系统设置失败',
      error: error.message
    });
  }
};

/**
 * 获取系统设置模板/模式
 */
const getSettingsSchema = async (req, res) => {
  try {
    const schema = {
      referral_commission: {
        description: "邀请分佣配置",
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "是否启用邀请分佣" },
          first_rate: { type: "number", description: "首次购买分佣比例", minimum: 0, maximum: 1 },
          renewal_rate: { type: "number", description: "续费分佣比例", minimum: 0, maximum: 1 }
        }
      },
      resource_sale_fee: {
        description: "资源售卖平台分成配置",
        type: "object",
        properties: {
          fee_rate: { type: "number", description: "平台分成比例", minimum: 0, maximum: 1 }
        }
      },
      system_maintenance: {
        description: "系统维护配置",
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "是否启用维护模式" },
          message: { type: "string", description: "维护提示信息" }
        }
      },
      security_cors: {
        description: "CORS白名单配置",
        type: "object",
        properties: {
          allowed_origins: {
            type: "array",
            items: { type: "string" },
            description: "允许的来源域名列表"
          }
        }
      },
      account_settings: {
        description: "账号注册相关配置",
        type: "object",
        properties: {
          registration_enabled: { type: "boolean", description: "是否允许注册" },
          email_verification_required: { type: "boolean", description: "是否需要邮箱验证" }
        }
      },
      smtp_config: {
        description: "SMTP邮件服务配置",
        type: "object",
        properties: {
          from: { type: "string", description: "发件人邮箱" },
          host: { type: "string", description: "SMTP服务器地址" },
          port: { type: "number", description: "SMTP端口" },
          secure: { type: "boolean", description: "是否使用安全连接" },
          username: { type: "string", description: "SMTP用户名" },
          password: { type: "string", description: "SMTP密码" }
        }
      },
      user_limit_settings: {
        description: "用户每日操作限制配置",
        type: "object",
        properties: {
          post_daily_limit: { type: "number", description: "每日发帖限制，0表示无限制", minimum: 0 },
          comment_daily_limit: { type: "number", description: "每日评论限制，0表示无限制", minimum: 0 },
          resource_daily_limit: { type: "number", description: "每日资源上传限制，0表示无限制", minimum: 0 }
        }
      }
    };

    res.json({
      success: true,
      message: '获取系统设置模式成功',
      data: schema
    });
  } catch (error) {
    logger.error('获取系统设置模式失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统设置模式失败',
      error: error.message
    });
  }
};

module.exports = {
  getAllSettings,
  getSetting,
  upsertSetting,
  deleteSetting,
  batchUpdateSettings,
  resetToDefault,
  getSettingsSchema
};