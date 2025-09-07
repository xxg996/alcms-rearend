/**
 * 密码安全工具模块
 * 基于bcrypt实现密码哈希和验证
 * Source: context7-mcp on bcrypt security best practices
 */

const bcrypt = require('bcrypt');
require('dotenv').config();

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

/**
 * 对密码进行哈希加密
 * @param {string} password - 明文密码
 * @returns {Promise<string>} 哈希后的密码
 */
async function hashPassword(password) {
  try {
    if (!password || typeof password !== 'string') {
      throw new Error('密码必须是非空字符串');
    }
    
    if (password.length < 6) {
      throw new Error('密码长度不能少于6个字符');
    }
    
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    return hashedPassword;
  } catch (error) {
    throw new Error(`密码哈希失败: ${error.message}`);
  }
}

/**
 * 验证密码是否正确
 * @param {string} password - 明文密码
 * @param {string} hashedPassword - 数据库中存储的哈希密码
 * @returns {Promise<boolean>} 密码是否匹配
 */
async function verifyPassword(password, hashedPassword) {
  try {
    if (!password || !hashedPassword) {
      return false;
    }
    
    const isValid = await bcrypt.compare(password, hashedPassword);
    return isValid;
  } catch (error) {
    console.error('密码验证失败:', error);
    return false;
  }
}

/**
 * 检查密码强度
 * @param {string} password - 待检查的密码
 * @returns {Object} 密码强度检查结果
 */
function checkPasswordStrength(password) {
  const result = {
    isValid: true,
    score: 0,
    errors: [],
    suggestions: []
  };

  if (!password) {
    result.isValid = false;
    result.errors.push('密码不能为空');
    return result;
  }

  // 长度检查
  if (password.length < 6) {
    result.isValid = false;
    result.errors.push('密码长度至少6个字符');
  } else if (password.length >= 8) {
    result.score += 1;
  }

  // 包含数字
  if (/\d/.test(password)) {
    result.score += 1;
  } else {
    result.suggestions.push('建议包含数字');
  }

  // 包含小写字母
  if (/[a-z]/.test(password)) {
    result.score += 1;
  } else {
    result.suggestions.push('建议包含小写字母');
  }

  // 包含大写字母
  if (/[A-Z]/.test(password)) {
    result.score += 1;
  } else {
    result.suggestions.push('建议包含大写字母');
  }

  // 包含特殊字符
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    result.score += 1;
  } else {
    result.suggestions.push('建议包含特殊字符');
  }

  // 避免常见弱密码
  const commonPasswords = ['123456', 'password', '123456789', 'qwerty', 'abc123'];
  if (commonPasswords.includes(password.toLowerCase())) {
    result.isValid = false;
    result.errors.push('密码过于简单，请使用更复杂的密码');
  }

  return result;
}

/**
 * 生成随机密码
 * @param {number} length - 密码长度（默认12位）
 * @returns {string} 随机生成的密码
 */
function generateRandomPassword(length = 12) {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const allChars = lowercase + uppercase + numbers + symbols;
  let password = '';
  
  // 确保至少包含每种类型的字符
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // 填充剩余长度
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // 打乱密码字符顺序
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

module.exports = {
  hashPassword,
  verifyPassword,
  checkPasswordStrength,
  generateRandomPassword
};
