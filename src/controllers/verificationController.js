/**
 * 验证码控制器
 * 处理邮箱验证码的发送和验证
 */

const VerificationCode = require('../models/VerificationCode');
const User = require('../models/User');
const { generateVerificationCode, sendRegistrationCode, sendPasswordResetCode, sendEmailChangeCode } = require('../utils/emailService');
const { logger } = require('../utils/logger');

const getRequestMeta = (req) => ({
  ipAddress: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip,
  userAgent: req.get('user-agent') || ''
});

/**
 * @swagger
 * /api/auth/send-verification-code:
 *   post:
 *     summary: 发送邮箱验证码
 *     description: 向指定邮箱发送验证码，支持注册、密码重置与修改邮箱三种类型
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - type
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 邮箱地址
 *                 example: "user@example.com"
 *               type:
 *                 type: string
 *                 enum: [register, reset_password, change_email]
 *                 description: 验证码类型
 *                 example: "register"
 *           examples:
 *             register:
 *               summary: 注册验证码
 *               value:
 *                 email: "newuser@example.com"
 *                 type: "register"
 *             resetPassword:
 *               summary: 密码重置验证码
 *               value:
 *                 email: "user@example.com"
 *                 type: "reset_password"
 *             changeEmail:
 *               summary: 修改邮箱验证码
 *               value:
 *                 email: "new-email@example.com"
 *                 type: "change_email"
 *     responses:
 *       200:
 *         description: 验证码发送成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "验证码已发送到您的邮箱"
 *                 data:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                       example: "user@example.com"
 *                     expires_in:
 *                       type: integer
 *                       description: 过期时间（分钟）
 *                       example: 10
 *                     can_resend_after:
 *                       type: integer
 *                       description: 可重新发送时间（秒）
 *                       example: 60
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingFields:
 *                 summary: 缺少必填字段
 *                 value:
 *                   success: false
 *                   message: "邮箱和验证码类型为必填项"
 *               invalidEmail:
 *                 summary: 邮箱格式无效
 *                 value:
 *                   success: false
 *                   message: "邮箱格式不正确"
 *               tooFrequent:
 *                 summary: 发送过于频繁
 *                 value:
 *                   success: false
 *                   message: "验证码发送过于频繁，请稍后再试"
 *               dailyLimit:
 *                 summary: 超过每日限制
 *                 value:
 *                   success: false
 *                   message: "今日验证码发送次数已达上限"
 *               userExists:
 *                 summary: 用户已存在（注册时）
 *                 value:
 *                   success: false
 *                   message: "邮箱已被注册"
 *               userNotFound:
 *                 summary: 用户不存在（重置密码时）
 *                 value:
 *                   success: false
 *                   message: "邮箱未注册"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const sendVerificationCode = async (req, res) => {
  const { email, type } = req.body || {};
  const { ipAddress, userAgent } = getRequestMeta(req);

  try {
    // 验证必填字段
    if (!email || !type) {
      return res.status(400).json({
        success: false,
        message: '邮箱和验证码类型为必填项'
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

    // 验证类型
    if (!['register', 'reset_password', 'change_email'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: '验证码类型无效'
      });
    }

    // 根据类型进行特定验证
    if (type === 'register') {
      // 检查邮箱是否已被注册
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: '邮箱已被注册'
        });
      }
    } else if (type === 'reset_password') {
      // 检查邮箱是否已注册
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: '邮箱未注册'
        });
      }

      // 检查账户状态
      if (user.status === 'banned') {
        return res.status(403).json({
          success: false,
          message: '账户已被封禁，无法重置密码'
        });
      }
    } else if (type === 'change_email') {
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: '邮箱已被使用'
        });
      }
    }

    // 检查发送频率（1分钟内只能发送一次）
    const canSend = await VerificationCode.canSendCode(email, type, 1);
    if (!canSend) {
      return res.status(400).json({
        success: false,
        message: '验证码发送过于频繁，请稍后再试'
      });
    }

    // 检查每日发送次数限制（每天最多10次）
    const todayCount = await VerificationCode.getTodayCount(email, type);
    if (todayCount >= 10) {
      return res.status(400).json({
        success: false,
        message: '今日验证码发送次数已达上限'
      });
    }

    // 生成验证码
    const code = generateVerificationCode();

    // 发送邮件
    let emailSent = false;
    if (type === 'register') {
      emailSent = await sendRegistrationCode(email, code);
    } else if (type === 'reset_password') {
      emailSent = await sendPasswordResetCode(email, code);
    } else if (type === 'change_email') {
      emailSent = await sendEmailChangeCode(email, code);
    }

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: '邮件发送失败，请稍后重试'
      });
    }

    // 保存验证码到数据库
    await VerificationCode.create(email, code, type, 10, ipAddress, userAgent);

    res.json({
      success: true,
      message: '验证码已发送到您的邮箱',
      data: {
        email: email,
        expires_in: 10,
        can_resend_after: 60
      }
    });

  } catch (error) {
    logger.error('发送验证码失败:', error);
    res.status(500).json({
      success: false,
      message: '发送验证码失败，请稍后重试'
    });
  }
};

/**
 * @swagger
 * /api/auth/verify-code:
 *   post:
 *     summary: 验证邮箱验证码
 *     description: 验证邮箱验证码是否正确和有效
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *               - type
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 邮箱地址
 *                 example: "user@example.com"
 *               code:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 description: 6位数字验证码
 *                 example: "123456"
 *               type:
 *                 type: string
 *                 enum: [register, reset_password]
 *                 description: 验证码类型
 *                 example: "register"
 *           examples:
 *             register:
 *               summary: 验证注册验证码
 *               value:
 *                 email: "newuser@example.com"
 *                 code: "123456"
 *                 type: "register"
 *             resetPassword:
 *               summary: 验证密码重置验证码
 *               value:
 *                 email: "user@example.com"
 *                 code: "654321"
 *                 type: "reset_password"
 *     responses:
 *       200:
 *         description: 验证码验证成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "验证码验证成功"
 *                 data:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                       example: "user@example.com"
 *                     type:
 *                       type: string
 *                       example: "register"
 *                     verified_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-09-22T17:30:00Z"
 *       400:
 *         description: 验证失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingFields:
 *                 summary: 缺少必填字段
 *                 value:
 *                   success: false
 *                   message: "邮箱、验证码和类型为必填项"
 *               invalidCode:
 *                 summary: 验证码无效
 *                 value:
 *                   success: false
 *                   message: "验证码无效或已过期"
 *               invalidFormat:
 *                 summary: 验证码格式错误
 *                 value:
 *                   success: false
 *                   message: "验证码必须为6位数字"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const verifyCode = async (req, res) => {
  const { email, code, type } = req.body || {};

  try {
    // 验证必填字段
    if (!email || !code || !type) {
      return res.status(400).json({
        success: false,
        message: '邮箱、验证码和类型为必填项'
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

    // 验证验证码格式
    if (!/^[0-9]{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: '验证码必须为6位数字'
      });
    }

    // 验证类型
    if (!['register', 'reset_password'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: '验证码类型无效'
      });
    }

    // 验证验证码
    const verificationResult = await VerificationCode.verify(email, code, type);

    if (!verificationResult.valid) {
      return res.status(400).json({
        success: false,
        message: verificationResult.reason
      });
    }

    res.json({
      success: true,
      message: '验证码验证成功',
      data: {
        email: email,
        type: type,
        verified_at: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('验证验证码失败:', error);
    res.status(500).json({
      success: false,
      message: '验证验证码失败，请稍后重试',
      error: error.message
    });
  }
};

module.exports = {
  sendVerificationCode,
  verifyCode
};
