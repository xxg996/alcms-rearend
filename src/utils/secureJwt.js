/**
 * 安全的JWT密钥管理工具
 * 确保JWT密钥的安全使用和验证
 */

const crypto = require('crypto');
const { logger } = require('./logger');

/**
 * JWT密钥安全验证
 */
class JWTSecurityManager {
  constructor() {
    this.validateEnvironment();
  }

  /**
   * 验证环境变量中的JWT密钥
   */
  validateEnvironment() {
    const { JWT_SECRET, JWT_REFRESH_SECRET } = process.env;

    // 检查密钥是否存在
    if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
      throw new Error(
        'JWT密钥未配置：JWT_SECRET 和 JWT_REFRESH_SECRET 必须在环境变量中定义'
      );
    }

    // 检查密钥强度
    this.validateKeyStrength(JWT_SECRET, 'JWT_SECRET');
    this.validateKeyStrength(JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');

    // 确保两个密钥不相同
    if (JWT_SECRET === JWT_REFRESH_SECRET) {
      throw new Error(
        '安全警告：JWT_SECRET 和 JWT_REFRESH_SECRET 不能使用相同的值'
      );
    }

    logger.info('✅ JWT密钥安全验证通过');
  }

  /**
   * 验证单个密钥的强度
   * @param {string} key - 要验证的密钥
   * @param {string} name - 密钥名称
   */
  validateKeyStrength(key, name) {
    // 检查最小长度
    if (key.length < 32) {
      throw new Error(
        `${name} 长度不足：密钥长度应至少为32个字符，当前长度：${key.length}`
      );
    }

    // 检查是否为默认值或弱密钥
    const weakPatterns = [
      'default',
      'secret',
      'password',
      '123456',
      'alcms_super_secure',
      'your_jwt_secret',
      'test'
    ];

    const keyLower = key.toLowerCase();
    for (const pattern of weakPatterns) {
      if (keyLower.includes(pattern)) {
        throw new Error(
          `${name} 包含弱模式 "${pattern}"：请使用加密学安全的随机密钥`
        );
      }
    }

    // 检查熵值（简单的字符多样性检查）
    const uniqueChars = new Set(key).size;
    const entropyRatio = uniqueChars / key.length;
    
    if (entropyRatio < 0.3) {
      logger.warn(
        `⚠️  ${name} 熵值较低：建议使用更多样化的字符组合`
      );
    }
  }

  /**
   * 生成新的安全JWT密钥对
   * @returns {Object} 包含access和refresh密钥的对象
   */
  static generateSecureKeys() {
    return {
      access: crypto.randomBytes(64).toString('base64'),
      refresh: crypto.randomBytes(64).toString('base64')
    };
  }

  /**
   * 获取安全的密钥（确保已验证）
   * @param {string} type - 密钥类型：'access' 或 'refresh'
   * @returns {string} 安全的密钥
   */
  getSecureKey(type) {
    switch (type) {
      case 'access':
        return process.env.JWT_SECRET;
      case 'refresh':
        return process.env.JWT_REFRESH_SECRET;
      default:
        throw new Error(`不支持的密钥类型：${type}`);
    }
  }

  /**
   * 密钥轮换建议检查
   */
  checkKeyRotation() {
    // 这里可以添加密钥轮换相关的逻辑
    // 比如检查密钥创建时间、使用频率等
    logger.info('💡 安全建议：定期轮换JWT密钥以提高安全性');
  }
}

// 创建全局实例并验证
let jwtSecurityManager;

try {
  jwtSecurityManager = new JWTSecurityManager();
} catch (error) {
  logger.error('❌ JWT安全初始化失败:', error.message);
  process.exit(1);
}

module.exports = {
  JWTSecurityManager,
  jwtSecurityManager,
  validateJWTSecurity: () => jwtSecurityManager.validateEnvironment(),
  getSecureKey: (type) => jwtSecurityManager.getSecureKey(type),
  generateSecureKeys: JWTSecurityManager.generateSecureKeys
};