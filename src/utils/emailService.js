/**
 * 邮件服务工具
 * 处理SMTP邮件发送和验证码生成
 */

const nodemailer = require('nodemailer');
const { logger } = require('./logger');

// 创建SMTP传输器
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

/**
 * 生成6位数字验证码
 * @returns {string} 6位数字验证码
 */
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * 发送注册验证码邮件
 * @param {string} email - 收件人邮箱
 * @param {string} code - 验证码
 * @returns {Promise<boolean>} 发送是否成功
 */
const sendRegistrationCode = async (email, code) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: {
        name: process.env.SMTP_FROM_NAME,
        address: process.env.SMTP_FROM_EMAIL
      },
      to: email,
      subject: '【ALCMS】注册验证码',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; border-bottom: 2px solid #e0e0e0; padding-bottom: 20px; margin-bottom: 30px;">
            <h1 style="color: #2c3e50; margin: 0;">ALCMS 系统</h1>
            <p style="color: #7f8c8d; margin: 5px 0 0 0;">Advanced Learning Content Management System</p>
          </div>

          <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #2c3e50; margin-top: 0;">注册验证码</h2>
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              您正在注册 ALCMS 系统账号，请使用以下验证码完成注册：
            </p>
            <div style="text-align: center; margin: 25px 0;">
              <span style="background-color: #3498db; color: white; font-size: 28px; font-weight: bold; padding: 15px 30px; border-radius: 5px; letter-spacing: 5px;">
                ${code}
              </span>
            </div>
            <p style="color: #e74c3c; font-size: 14px; margin-bottom: 0;">
              ⚠️ 验证码有效期为 10 分钟，请及时使用。
            </p>
          </div>

          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin-bottom: 25px;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
              <strong>安全提醒：</strong> 如果您未申请注册账号，请忽略此邮件。验证码请勿泄露给他人。
            </p>
          </div>

          <div style="text-align: center; color: #7f8c8d; font-size: 12px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
            <p>此邮件由系统自动发送，请勿回复</p>
            <p>© ${new Date().getFullYear()} ALCMS 系统. All rights reserved.</p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info(`注册验证码邮件发送成功: ${email}`, { messageId: result.messageId });
    return true;
  } catch (error) {
    logger.error(`注册验证码邮件发送失败: ${email}`, error);
    return false;
  }
};

/**
 * 发送密码重置验证码邮件
 * @param {string} email - 收件人邮箱
 * @param {string} code - 验证码
 * @returns {Promise<boolean>} 发送是否成功
 */
const sendPasswordResetCode = async (email, code) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: {
        name: process.env.SMTP_FROM_NAME,
        address: process.env.SMTP_FROM_EMAIL
      },
      to: email,
      subject: '【ALCMS】密码重置验证码',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; border-bottom: 2px solid #e0e0e0; padding-bottom: 20px; margin-bottom: 30px;">
            <h1 style="color: #2c3e50; margin: 0;">ALCMS 系统</h1>
            <p style="color: #7f8c8d; margin: 5px 0 0 0;">Advanced Learning Content Management System</p>
          </div>

          <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #2c3e50; margin-top: 0;">密码重置验证码</h2>
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              您正在重置 ALCMS 系统账号密码，请使用以下验证码完成密码重置：
            </p>
            <div style="text-align: center; margin: 25px 0;">
              <span style="background-color: #e74c3c; color: white; font-size: 28px; font-weight: bold; padding: 15px 30px; border-radius: 5px; letter-spacing: 5px;">
                ${code}
              </span>
            </div>
            <p style="color: #e74c3c; font-size: 14px; margin-bottom: 0;">
              ⚠️ 验证码有效期为 10 分钟，请及时使用。
            </p>
          </div>

          <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin-bottom: 25px;">
            <p style="color: #721c24; margin: 0; font-size: 14px;">
              <strong>安全提醒：</strong> 如果您未申请重置密码，请立即检查账号安全。验证码请勿泄露给他人。
            </p>
          </div>

          <div style="text-align: center; color: #7f8c8d; font-size: 12px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
            <p>此邮件由系统自动发送，请勿回复</p>
            <p>© ${new Date().getFullYear()} ALCMS 系统. All rights reserved.</p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info(`密码重置验证码邮件发送成功: ${email}`, { messageId: result.messageId });
    return true;
  } catch (error) {
    logger.error(`密码重置验证码邮件发送失败: ${email}`, error);
    return false;
  }
};

/**
 * 测试SMTP连接
 * @returns {Promise<Object>} 连接测试结果
 */
const testEmailConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info('SMTP连接测试成功');
    return {
      success: true,
      message: 'SMTP连接测试成功'
    };
  } catch (error) {
    logger.error('SMTP连接测试失败:', error);
    return {
      success: false,
      message: 'SMTP连接测试失败',
      error: error.message,
      code: error.code,
      errno: error.errno,
      config: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE,
        user: process.env.SMTP_USER
      }
    };
  }
};

module.exports = {
  generateVerificationCode,
  sendRegistrationCode,
  sendPasswordResetCode,
  testEmailConnection
};