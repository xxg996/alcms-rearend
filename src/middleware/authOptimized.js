/**
 * 优化的认证中间件
 * 使用缓存减少数据库查询，提升性能
 */

const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const cacheManager = require('../utils/cache');
const { logger } = require('../utils/logger');

/**
 * 优化的JWT认证中间件
 * 使用缓存减少数据库查询
 */
const authenticateTokenOptimized = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '缺少访问令牌'
      });
    }

    // 验证令牌
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: '无效的访问令牌'
      });
    }

    // 使用缓存获取用户信息
    const cacheKey = `user:${decoded.userId}:auth`;
    let userData = await cacheManager.get(cacheKey);

    if (!userData) {
      // 缓存未命中，查询数据库
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: '用户不存在'
        });
      }

      // 获取用户角色信息
      const userRoles = await User.getUserRoles(decoded.userId);
      
      userData = {
        ...user,
        roles: userRoles
      };

      // 缓存用户数据，TTL 5分钟
      await cacheManager.set(cacheKey, userData, 300);
    }

    // 检查用户状态
    if (userData.status !== 'normal') {
      // 清除缓存
      await cacheManager.delete(cacheKey);
      return res.status(403).json({
        success: false,
        message: `账号已被${userData.status === 'banned' ? '封禁' : '冻结'}`
      });
    }

    req.user = userData;
    next();
  } catch (error) {
    logger.error('Token验证失败:', error);
    return res.status(500).json({
      success: false,
      message: '认证失败'
    });
  }
};

/**
 * 优化的权限检查中间件
 * 使用缓存存储权限信息
 */
const requirePermissionOptimized = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: '请先登录'
        });
      }

      // 使用缓存获取权限
      const cacheKey = `user:${req.user.id}:permissions`;
      let userPermissions = await cacheManager.get(cacheKey);

      if (!userPermissions) {
        // 缓存未命中，查询数据库
        userPermissions = await User.getUserPermissions(req.user.id);
        // 缓存权限，TTL 10分钟
        await cacheManager.set(cacheKey, userPermissions, 600);
      }

      const hasPermission = userPermissions.some(p => p.name === permission);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: '权限不足'
        });
      }

      next();
    } catch (error) {
      logger.error('权限检查失败:', error);
      return res.status(500).json({
        success: false,
        message: '权限检查失败'
      });
    }
  };
};

/**
 * 批量预加载用户数据
 * 用于批量操作时提前加载多个用户的数据
 */
const preloadUsers = async (userIds) => {
  try {
    // 检查缓存中已存在的用户
    const cacheKeys = userIds.map(id => `user:${id}:auth`);
    const cached = await cacheManager.mget(cacheKeys);
    
    // 找出需要从数据库加载的用户
    const missingIds = userIds.filter((id, index) => !cached[cacheKeys[index]]);
    
    if (missingIds.length > 0) {
      // 批量查询数据库
      const users = await User.findByIds(missingIds);
      
      // 批量设置缓存
      for (const user of users) {
        const roles = await User.getUserRoles(user.id);
        const userData = { ...user, roles };
        await cacheManager.set(`user:${user.id}:auth`, userData, 300);
      }
    }
  } catch (error) {
    logger.error('预加载用户数据失败:', error);
  }
};

/**
 * 清除用户认证缓存
 * 在用户信息更新时调用
 */
const clearUserAuthCache = async (userId) => {
  try {
    const keys = [
      `user:${userId}:auth`,
      `user:${userId}:permissions`,
      `user:${userId}:roles`
    ];
    await cacheManager.delete(keys);
  } catch (error) {
    logger.error('清除用户缓存失败:', error);
  }
};

module.exports = {
  authenticateTokenOptimized,
  requirePermissionOptimized,
  preloadUsers,
  clearUserAuthCache,
  // 保留原有接口名称以便兼容
  authenticateToken: authenticateTokenOptimized,
  requirePermission: requirePermissionOptimized
};