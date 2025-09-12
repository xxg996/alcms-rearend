/**
 * 认证中间件
 * 处理JWT令牌验证和用户权限检查
 */

const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const { logger } = require('../utils/logger');

/**
 * JWT认证中间件
 * 验证请求头中的访问令牌
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '缺少访问令牌'
      });
    }

    // 验证令牌
    const decoded = verifyAccessToken(token);
    
    // 查询用户信息
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查用户状态
    if (user.status !== 'normal') {
      return res.status(403).json({
        success: false,
        message: `账号已被${user.status === 'banned' ? '封禁' : '冻结'}`
      });
    }

    // 获取用户角色信息
    const userRoles = await User.getUserRoles(decoded.userId);
    
    // 将用户信息和角色添加到请求对象
    req.user = {
      ...user,
      roles: userRoles
    };
    next();
  } catch (error) {
    logger.error('Token验证失败:', error);
    return res.status(401).json({
      success: false,
      message: '无效的访问令牌'
    });
  }
};

/**
 * 权限检查中间件工厂
 * @param {string} permission - 需要的权限名称
 * @returns {Function} 中间件函数
 */
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: '请先登录'
        });
      }

      // 获取用户权限
      const userPermissions = await User.getUserPermissions(req.user.id);
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
 * 角色检查中间件工厂
 * @param {string|Array} roles - 需要的角色名称（字符串或数组）
 * @returns {Function} 中间件函数
 */
const requireRole = (roles) => {
  const requiredRoles = Array.isArray(roles) ? roles : [roles];
  
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: '请先登录'
        });
      }

      // 从JWT payload中获取角色信息（避免数据库查询）
      const userRoles = req.user.roles || [];
      const hasRole = userRoles.some(role => requiredRoles.includes(role.name));

      if (!hasRole) {
        return res.status(403).json({
          success: false,
          message: '角色权限不足'
        });
      }

      next();
    } catch (error) {
      logger.error('角色检查失败:', error);
      return res.status(500).json({
        success: false,
        message: '角色检查失败'
      });
    }
  };
};

/**
 * 可选认证中间件
 * 如果有令牌则验证，没有令牌也可以继续
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.userId);
      
      if (user && user.status === 'normal') {
        // 为可选认证也加载角色信息
        const userRoles = await User.getUserRoles(decoded.userId);
        req.user = {
          ...user,
          roles: userRoles
        };
      }
    }

    next();
  } catch (error) {
    // 可选认证失败不影响后续流程
    next();
  }
};

/**
 * 用户自己或管理员权限检查
 * 允许用户访问自己的资源，或管理员访问任何用户资源
 */
const requireOwnershipOrAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '请先登录'
      });
    }

    // 获取目标用户ID（从路径参数或请求体）
    const targetUserId = parseInt(req.params.userId || req.params.id);
    
    // 检查是否是用户自己
    if (req.user.id === targetUserId) {
      return next();
    }

    // 检查是否是管理员
    const userRoles = await User.getUserRoles(req.user.id);
    const isAdmin = userRoles.some(role => role.name === 'admin');

    if (isAdmin) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: '只能访问自己的资源'
    });
  } catch (error) {
    logger.error('所有权检查失败:', error);
    return res.status(500).json({
      success: false,
      message: '权限检查失败'
    });
  }
};

/**
 * 检查用户是否为管理员（基于JWT角色信息）
 * @returns {Function} 中间件函数
 */
const requireAdmin = () => {
  return requireRole(['admin', 'super_admin']);
};

module.exports = {
  authenticateToken,
  requirePermission,
  requireRole,
  requireAdmin,
  optionalAuth,
  requireOwnershipOrAdmin
};
