/**
 * 认证业务逻辑服务
 * 处理用户认证相关的所有业务操作
 */

const BaseService = require('./BaseService');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { checkPasswordStrength } = require('../utils/password');

class AuthService extends BaseService {
  constructor() {
    super();
  }

  /**
   * 用户注册
   */
  async register(registrationData) {
    return this.withPerformanceMonitoring('register', async () => {
      try {
        this.validateRequired(registrationData, [
          'email', 'username', 'password', 'nickname'
        ]);

        const { email, username, password, nickname } = registrationData;

        // 验证邮箱格式
        if (!this.isValidEmail(email)) {
          throw new Error('邮箱格式不正确');
        }

        // 验证用户名格式
        if (!this.isValidUsername(username)) {
          throw new Error('用户名只能包含字母、数字和下划线，长度3-20位');
        }

        // 验证密码强度
        const passwordCheck = checkPasswordStrength(password);
        if (!passwordCheck.isValid) {
          throw new Error('密码强度不足：' + passwordCheck.message);
        }

        // 检查邮箱和用户名是否已存在
        const [existingEmail, existingUsername] = await Promise.all([
          User.findByEmail(email),
          User.findByUsername(username)
        ]);

        if (existingEmail) {
          throw new Error('邮箱已被注册');
        }

        if (existingUsername) {
          throw new Error('用户名已被使用');
        }

        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 12);

        // 创建用户
        const newUser = await User.create({
          email,
          username,
          password: hashedPassword,
          nickname,
          role: 'user',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        });

        this.log('info', '新用户注册成功', { 
          userId: newUser.id, 
          email, 
          username 
        });

        // 生成访问令牌
        const tokens = this.generateTokens(newUser);

        return this.formatSuccessResponse({
          user: this.sanitizeUserData(newUser),
          ...tokens
        }, '注册成功');

      } catch (error) {
        this.handleError(error, 'register');
      }
    });
  }

  /**
   * 用户登录
   */
  async login(loginData) {
    return this.withPerformanceMonitoring('login', async () => {
      try {
        this.validateRequired(loginData, ['identifier', 'password']);

        const { identifier, password, rememberMe = false } = loginData;

        // 查找用户（支持邮箱或用户名登录）
        const user = await this.findUserByIdentifier(identifier);
        
        if (!user) {
          throw new Error('用户不存在');
        }

        // 检查用户状态
        if (user.status === 'banned') {
          throw new Error('账户已被封禁，请联系管理员');
        }

        if (user.status === 'inactive') {
          throw new Error('账户未激活，请联系管理员');
        }

        // 验证密码
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          // 记录登录失败
          await this.recordLoginAttempt(user.id, false);
          throw new Error('密码错误');
        }

        // 记录登录成功
        await this.recordLoginAttempt(user.id, true);

        // 更新最后登录时间
        await User.updateById(user.id, {
          last_login_at: new Date()
        });

        this.log('info', '用户登录成功', { 
          userId: user.id, 
          email: user.email 
        });

        // 生成访问令牌
        const tokens = this.generateTokens(user, rememberMe);

        return this.formatSuccessResponse({
          user: this.sanitizeUserData(user),
          ...tokens
        }, '登录成功');

      } catch (error) {
        this.handleError(error, 'login');
      }
    });
  }

  /**
   * 刷新令牌
   */
  async refreshToken(refreshToken) {
    return this.withPerformanceMonitoring('refreshToken', async () => {
      try {
        this.validateRequired({ refreshToken }, ['refreshToken']);

        // 验证刷新令牌
        let decoded;
        try {
          decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        } catch (error) {
          throw new Error('刷新令牌无效或已过期');
        }

        // 获取用户信息
        const user = await User.findById(decoded.id);
        if (!user) {
          throw new Error('用户不存在');
        }

        // 检查用户状态
        if (user.status !== 'active') {
          throw new Error('用户状态异常，无法刷新令牌');
        }

        // 生成新的访问令牌
        const tokens = this.generateTokens(user);

        this.log('info', '令牌刷新成功', { userId: user.id });

        return this.formatSuccessResponse(tokens, '令牌刷新成功');

      } catch (error) {
        this.handleError(error, 'refreshToken');
      }
    });
  }

  /**
   * 用户登出
   */
  async logout(userId) {
    return this.withPerformanceMonitoring('logout', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        // 这里可以实现令牌黑名单机制
        // 目前简单记录登出日志
        
        this.log('info', '用户登出', { userId });

        return this.formatSuccessResponse(null, '登出成功');

      } catch (error) {
        this.handleError(error, 'logout');
      }
    });
  }

  /**
   * 验证用户令牌
   */
  async verifyToken(token) {
    return this.withPerformanceMonitoring('verifyToken', async () => {
      try {
        this.validateRequired({ token }, ['token']);

        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
          throw new Error('令牌无效或已过期');
        }

        // 获取用户信息
        const user = await User.findById(decoded.id);
        if (!user) {
          throw new Error('用户不存在');
        }

        if (user.status !== 'active') {
          throw new Error('用户状态异常');
        }

        return this.formatSuccessResponse({
          user: this.sanitizeUserData(user)
        }, '令牌验证成功');

      } catch (error) {
        this.handleError(error, 'verifyToken');
      }
    });
  }

  /**
   * 重置密码请求
   */
  async requestPasswordReset(email) {
    return this.withPerformanceMonitoring('requestPasswordReset', async () => {
      try {
        this.validateRequired({ email }, ['email']);

        if (!this.isValidEmail(email)) {
          throw new Error('邮箱格式不正确');
        }

        const user = await User.findByEmail(email);
        if (!user) {
          // 出于安全考虑，不透露用户是否存在
          return this.formatSuccessResponse(null, '如果邮箱存在，重置链接已发送');
        }

        // 生成重置令牌
        const resetToken = jwt.sign(
          { id: user.id, type: 'password_reset' },
          process.env.JWT_SECRET,
          { expiresIn: '1h' }
        );

        // 这里应该发送重置邮件
        // await this.sendPasswordResetEmail(user.email, resetToken);

        this.log('info', '密码重置请求', { 
          userId: user.id, 
          email 
        });

        return this.formatSuccessResponse(null, '重置链接已发送到邮箱');

      } catch (error) {
        this.handleError(error, 'requestPasswordReset');
      }
    });
  }

  /**
   * 根据标识符查找用户
   */
  async findUserByIdentifier(identifier) {
    // 判断是邮箱还是用户名
    if (this.isValidEmail(identifier)) {
      return await User.findByEmail(identifier);
    } else {
      return await User.findByUsername(identifier);
    }
  }

  /**
   * 生成访问令牌和刷新令牌
   */
  generateTokens(user, rememberMe = false) {
    const payload = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    };

    const accessToken = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
    );

    const refreshTokenExpiry = rememberMe ? '30d' : '7d';
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: refreshTokenExpiry }
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60 // 秒
    };
  }

  /**
   * 记录登录尝试
   */
  async recordLoginAttempt(userId, success) {
    try {
      // 这里可以实现登录日志记录
      // 用于安全审计和异常检测
      this.log('info', '登录尝试记录', { 
        userId, 
        success, 
        timestamp: new Date() 
      });
    } catch (error) {
      this.log('warn', '记录登录尝试失败', { 
        userId, 
        error: error.message 
      });
    }
  }

  /**
   * 验证邮箱格式
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 验证用户名格式
   */
  isValidUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
  }

  /**
   * 用户数据脱敏
   */
  sanitizeUserData(user) {
    if (!user) return null;

    const sanitized = { ...user };
    delete sanitized.password;
    delete sanitized.password_updated_at;
    
    return sanitized;
  }
}

module.exports = new AuthService();