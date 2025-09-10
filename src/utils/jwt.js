/**
 * JWT工具模块
 * 基于jsonwebtoken实现JWT令牌的生成和验证
 * Source: context7-mcp on jsonwebtoken best practices
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT secrets must be defined in environment variables');
}

/**
 * 生成访问令牌
 * @param {Object} payload - 用户信息载荷
 * @returns {string} JWT访问令牌
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'alcms-backend',
    audience: 'alcms-client'
  });
}

/**
 * 生成刷新令牌
 * @param {Object} payload - 用户信息载荷
 * @returns {string} JWT刷新令牌
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'alcms-backend',
    audience: 'alcms-client'
  });
}

/**
 * 验证访问令牌
 * @param {string} token - JWT访问令牌
 * @returns {Object} 解码后的用户信息
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'alcms-backend',
      audience: 'alcms-client'
    });
  } catch (error) {
    throw new Error(`Access token verification failed: ${error.message}`);
  }
}

/**
 * 验证刷新令牌
 * @param {string} token - JWT刷新令牌
 * @returns {Object} 解码后的用户信息
 */
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'alcms-backend',
      audience: 'alcms-client'
    });
  } catch (error) {
    throw new Error(`Refresh token verification failed: ${error.message}`);
  }
}

/**
 * 解码JWT令牌（不验证签名）
 * @param {string} token - JWT令牌
 * @returns {Object} 解码后的信息
 */
function decodeToken(token) {
  return jwt.decode(token, { complete: true });
}

/**
 * 生成令牌哈希值（用于存储刷新令牌）
 * @param {string} token - 原始令牌
 * @returns {string} 令牌哈希值
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * 生成完整的令牌对（访问令牌 + 刷新令牌）
 * @param {Object} user - 用户信息
 * @param {Array} roles - 用户角色列表（可选）
 * @returns {Object} 包含访问令牌和刷新令牌的对象
 */
function generateTokenPair(user, roles = []) {
  const payload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    roles: roles.map(role => ({
      id: role.role_id || role.id,
      name: role.role_name || role.name,
      level: role.level
    }))
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: JWT_EXPIRES_IN
  };
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  hashToken,
  generateTokenPair
};
