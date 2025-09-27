/**
 * 系统设置管理控制器
 * 提供系统设置的增删改查功能
 */

const SystemSetting = require('../../models/SystemSetting');
const AuditLog = require('../../models/AuditLog');
const { logger } = require('../../utils/logger');
const { testEmailConnection, sendRegistrationCode } = require('../../utils/emailService');

const getRequestMeta = (req) => ({
  ipAddress: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip,
  userAgent: req.get('user-agent') || ''
});

const recordSystemLog = async (req, payload) => {
  const operatorId = req.user?.id || null;
  const { ipAddress, userAgent } = getRequestMeta(req);
  await AuditLog.createSystemLog({
    operatorId,
    ipAddress,
    userAgent,
    ...payload
  });
};

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

    await recordSystemLog(req, {
      targetType: 'system_setting',
      targetId: key,
      action: 'setting_upsert',
      summary: `更新系统设置 ${key}`,
      detail: {
        value,
        description: description || null
      }
    });

    res.json({
      success: true,
      message: '更新系统设置成功',
      data: result
    });
  } catch (error) {
    logger.error('更新系统设置失败:', error);
    await recordSystemLog(req, {
      targetType: 'system_setting',
      targetId: req.params?.key || null,
      action: 'setting_upsert_failed',
      summary: '更新系统设置失败',
      detail: { error: error.message }
    });
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

    await recordSystemLog(req, {
      targetType: 'system_setting',
      targetId: key,
      action: 'setting_delete',
      summary: `删除系统设置 ${key}`,
      detail: result.rows[0]
    });

    res.json({
      success: true,
      message: '删除系统设置成功',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('删除系统设置失败:', error);
    await recordSystemLog(req, {
      targetType: 'system_setting',
      targetId: req.params?.key || null,
      action: 'setting_delete_failed',
      summary: '删除系统设置失败',
      detail: { error: error.message }
    });
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

    await recordSystemLog(req, {
      targetType: 'system_setting',
      targetId: null,
      action: 'setting_batch_update',
      summary: `批量更新系统设置 ${results.length} 项`,
      detail: settings.map(item => ({
        key: item.key,
        hasDescription: !!item.description
      }))
    });

    res.json({
      success: true,
      message: `批量更新 ${results.length} 个系统设置成功`,
      data: results
    });
  } catch (error) {
    logger.error('批量更新系统设置失败:', error);
    await recordSystemLog(req, {
      targetType: 'system_setting',
      targetId: null,
      action: 'setting_batch_update_failed',
      summary: '批量更新系统设置失败',
      detail: { error: error.message }
    });
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
        renewal_rate: 0,
        card_type_rates: {
          points: 0.10,
          download: 0.10
        }
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

    await recordSystemLog(req, {
      targetType: 'system_setting',
      targetId: key,
      action: 'setting_reset_default',
      summary: `重置系统设置 ${key} 为默认值`,
      detail: defaultSettings[key]
    });

    res.json({
      success: true,
      message: '重置系统设置成功',
      data: result
    });
  } catch (error) {
    logger.error('重置系统设置失败:', error);
    await recordSystemLog(req, {
      targetType: 'system_setting',
      targetId: req.params?.key || null,
      action: 'setting_reset_default_failed',
      summary: '重置系统设置失败',
      detail: { error: error.message }
    });
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
          renewal_rate: { type: "number", description: "续费分佣比例", minimum: 0, maximum: 1 },
          card_type_rates: {
            type: "object",
            description: "按卡密类型配置的固定返佣比例",
            additionalProperties: {
              type: "number",
              minimum: 0,
              maximum: 1
            }
          }
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

/**
 * 测试SMTP邮件发送服务
 * 管理员测试系统邮件发送功能，包括SMTP连接测试和发送测试邮件
 */
const testEmailService = async (req, res) => {
  try {
    const { email, test_type, email_type } = req.body || {};

    // 验证必填字段
    if (!email || !test_type) {
      return res.status(400).json({
        success: false,
        message: '邮箱和测试类型为必填项'
      });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: '邮箱格式不正确'
      });
    }

    // 验证测试类型
    if (!['connection', 'send_email'].includes(test_type)) {
      return res.status(400).json({
        success: false,
        message: '测试类型无效'
      });
    }

    // 如果是发送邮件测试，验证邮件类型
    if (test_type === 'send_email') {
      if (!email_type || !['register', 'reset_password'].includes(email_type)) {
        return res.status(400).json({
          success: false,
          message: '发送邮件测试时必须指定有效的邮件类型'
        });
      }
    }

    let result = {
      test_type,
      email,
      smtp_config: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER
      }
    };

    if (test_type === 'connection') {
      // 测试SMTP连接
      const connectionResult = await testEmailConnection();
      if (!connectionResult.success) {
        await recordSystemLog(req, {
          targetType: 'system_setting',
          targetId: 'smtp_config',
          action: 'smtp_test_connection_failed',
          summary: 'SMTP连接测试失败',
          detail: {
            message: connectionResult.message,
            error: connectionResult.error,
            code: connectionResult.code,
            errno: connectionResult.errno
          }
        });

        return res.status(500).json({
          success: false,
          message: connectionResult.message,
          error: connectionResult.error,
          code: connectionResult.code,
          errno: connectionResult.errno,
          config: connectionResult.config
        });
      }

      await recordSystemLog(req, {
        targetType: 'system_setting',
        targetId: 'smtp_config',
        action: 'smtp_test_connection',
        summary: 'SMTP连接测试成功',
        detail: {
          email,
          host: result.smtp_config.host,
          port: result.smtp_config.port
        }
      });

      return res.json({
        success: true,
        message: connectionResult.message,
        data: result
      });

    } else if (test_type === 'send_email') {
      // 测试发送邮件
      const { generateVerificationCode } = require('../../utils/emailService');
      const verificationCode = generateVerificationCode();

      let emailSent = false;
      if (email_type === 'register') {
        emailSent = await sendRegistrationCode(email, verificationCode);
      } else if (email_type === 'reset_password') {
        const { sendPasswordResetCode } = require('../../utils/emailService');
        emailSent = await sendPasswordResetCode(email, verificationCode);
      }

      if (!emailSent) {
        await recordSystemLog(req, {
          targetType: 'system_setting',
          targetId: 'smtp_config',
          action: 'smtp_test_send_failed',
          summary: 'SMTP测试邮件发送失败',
          detail: {
            email,
            emailType: email_type
          }
        });

        return res.status(500).json({
          success: false,
          message: '邮件发送失败，请检查SMTP配置'
        });
      }

      result.verification_code = verificationCode;
      result.email_type = email_type;

      await recordSystemLog(req, {
        targetType: 'system_setting',
        targetId: 'smtp_config',
        action: 'smtp_test_send',
        summary: `${email_type === 'register' ? '注册' : '密码重置'}验证码邮件发送成功`,
        detail: {
          email,
          emailType: email_type
        }
      });

      return res.json({
        success: true,
        message: `${email_type === 'register' ? '注册' : '密码重置'}验证码邮件发送成功`,
        data: result
      });
    }

    // 记录测试日志
    logger.info(`管理员邮件测试: ${test_type}`, {
      userId: req.user.id,
      email,
      test_type,
      email_type
    });

  } catch (error) {
    logger.error('邮件服务测试失败:', error);
    await recordSystemLog(req, {
      targetType: 'system_setting',
      targetId: 'smtp_config',
      action: 'smtp_test_failed',
      summary: '邮件服务测试失败',
      detail: {
        email: req.body?.email,
        testType: req.body?.test_type,
        error: error.message
      }
    });
    res.status(500).json({
      success: false,
      message: '邮件服务测试失败',
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
  getSettingsSchema,
  testEmailService
};
