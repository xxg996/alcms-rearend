/**
 * 下载工具函数
 * 处理资源下载权限检查和签名链接生成
 */

const crypto = require('crypto');
const { query } = require('../config/database');
const { logger } = require('./logger');
const {
  checkAndResetDailyDownloads,
  consumeDownload,
  recordDownload
} = require('./downloadLimitUtils');

/**
 * 验证用户下载权限
 * @param {number} userId - 用户ID
 * @param {Object} resource - 资源对象
 * @returns {Promise<Object>} 权限检查结果
 */
async function validateDownloadPermission(userId, resource) {
  try {
    // 检查资源是否存在下载地址
    if (!resource.file_url && !resource.download_url && !resource.external_url) {
      return {
        allowed: false,
        reason: '该资源暂无可下载文件'
      };
    }

    // 检查资源状态
    if (resource.status !== 'published') {
      return {
        allowed: false,
        reason: '资源未发布，无法下载'
      };
    }

    // 检查每日下载次数限制（只对登录用户）
    if (userId) {
      const downloadStatus = await checkAndResetDailyDownloads(userId);
      if (!downloadStatus.canDownload) {
        return {
          allowed: false,
          reason: `今日下载次数已用完 (${downloadStatus.dailyUsed}/${downloadStatus.dailyLimit})`
        };
      }
    }

    // 检查公开状态
    if (!resource.is_public) {
      if (!userId) {
        return {
          allowed: false,
          reason: '请先登录后下载'
        };
      }

      // 检查是否为资源作者或有管理权限
      if (resource.author_id !== userId) {
        const hasPermission = await checkUserPermission(userId, 'resource:download');
        if (!hasPermission) {
          return {
            allowed: false,
            reason: '无权下载此私有资源'
          };
        }
      }
    }

    // 新的下载逻辑：权限控制已移到文件级别
    // 这个函数主要用于检查基本权限，具体的积分和VIP控制在downloadAuthUtils中处理

    return {
      allowed: true,
      pointsToDeduct: 0, // 积分控制已移到文件级别
      reason: '允许下载'
    };

  } catch (error) {
    logger.error('权限检查失败:', error);
    return {
      allowed: false,
      reason: '权限检查失败，请稍后重试'
    };
  }
}





/**
 * 提取文件名
 * @param {string} url - 文件URL
 * @param {string} fallbackTitle - 备用标题
 * @returns {string} 文件名
 */
function extractFileName(url, fallbackTitle) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const fileName = pathname.split('/').pop();
    
    if (fileName && fileName.includes('.')) {
      return fileName;
    }
  } catch (error) {
    // URL解析失败，使用备用方案
  }

  // 使用标题作为文件名
  const cleanTitle = fallbackTitle
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s.-]/g, '')
    .trim();
  
  return cleanTitle || 'download';
}


/**
 * 生成安全的资源展示信息
 * @param {Object} resource - 资源对象
 * @param {number} userId - 用户ID (可选)
 * @returns {Promise<Object>} 安全的资源信息
 */
async function generateSecureResourceInfo(resource, userId = null) {
  const secureResource = { ...resource };

  // 注意：下载信息已迁移到 resource_files 表，通过专门的接口获取
  // 不再在资源详情中包含下载信息

  return secureResource;
}

/**
 * 生成下载信息数组
 * @param {Object} resource - 资源对象
 * @param {number} userId - 用户ID (可选)
 * @returns {Promise<Array>} 下载信息数组
 */
async function generateDownloadInfoArray(resource, userId = null) {
  const downloadInfo = [];
  
  // 检查用户下载权限
  let permissionCheck = { allowed: false, reason: '未登录用户无法下载' };
  
  // 获取资源类型名称
  const resourceTypeName = resource.resource_type_name;
  
  // 根据资源类型检查是否有可下载的文件
  let hasDownloadableFiles = false;
  if (resourceTypeName === 'article') {
    hasDownloadableFiles = !!resource.download_url;
  } else if (resourceTypeName === 'video' || resourceTypeName === 'audio') {
    hasDownloadableFiles = !!resource.file_url;
  }
  
  if (userId) {
    if (hasDownloadableFiles) {
      try {
        permissionCheck = await validateDownloadPermission(userId, resource);
      } catch (error) {
        logger.error('权限检查失败:', error);
        permissionCheck = { allowed: false, reason: '权限检查失败' };
      }
    } else {
      // 登录用户查看无下载文件的资源
      permissionCheck = { allowed: false, reason: '该资源暂无可下载文件' };
    }
  } else {
    // 未登录用户
    if (hasDownloadableFiles && resource.is_public && resource.is_free) {
      permissionCheck = { allowed: false, reason: '需要登录后下载' };
    } else {
      permissionCheck = { allowed: false, reason: '未登录用户无法下载' };
    }
  }
  
  // 根据资源类型显示不同的URL
  if (resourceTypeName === 'article') {
    // 文章类型：只显示 downloadUrl
    if (resource.download_url) {
      downloadInfo.push({
        type: 'downloadUrl',
        name: '下载文件',
        encrypted_url: null, // URL混淆功能已移除
        has_permission: permissionCheck.allowed,
        permission_reason: permissionCheck.allowed ? '允许下载' : permissionCheck.reason,
        file_size: resource.file_size,
        mime_type: resource.file_mime_type,
        is_external: false
      });
    }
  } else if (resourceTypeName === 'video') {
    // 视频类型：只显示 mp4Url
    if (resource.file_url) {
      downloadInfo.push({
        type: 'mp4Url',
        name: 'MP4视频',
        encrypted_url: null, // URL混淆功能已移除
        has_permission: permissionCheck.allowed,
        permission_reason: permissionCheck.allowed ? '允许播放' : permissionCheck.reason,
        file_size: resource.file_size,
        mime_type: resource.file_mime_type || 'video/mp4',
        is_external: false
      });
    }
  } else if (resourceTypeName === 'audio') {
    // 音频类型：只显示 mp3Url
    if (resource.file_url) {
      downloadInfo.push({
        type: 'mp3Url',
        name: 'MP3音频',
        encrypted_url: null, // URL混淆功能已移除
        has_permission: permissionCheck.allowed,
        permission_reason: permissionCheck.allowed ? '允许播放' : permissionCheck.reason,
        file_size: resource.file_size,
        mime_type: resource.file_mime_type || 'audio/mp3',
        is_external: false
      });
    }
  }
  
  // 如果没有任何下载链接，返回空数组
  if (downloadInfo.length === 0) {
    return [{
      type: 'none',
      name: '暂无可用文件',
      encrypted_url: null,
      has_permission: false,
      permission_reason: '该资源暂无可下载文件',
      file_size: null,
      mime_type: null,
      is_external: false
    }];
  }
  
  return downloadInfo;
}

// 辅助函数

/**
 * 检查用户权限
 */
async function checkUserPermission(userId, permissionName) {
  const result = await query(`
    SELECT 1 FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    JOIN user_roles ur ON rp.role_id = ur.role_id
    WHERE ur.user_id = $1 AND p.name = $2
    LIMIT 1
  `, [userId, permissionName]);
  
  return result.rows.length > 0;
}

/**
 * 获取用户VIP等级
 */
async function getUserVipLevel(userId) {
  const result = await query(`
    SELECT r.name as role_name
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE u.id = $1 AND r.name IN ('vip', 'admin', 'moderator')
    ORDER BY 
      CASE r.name 
        WHEN 'admin' THEN 1
        WHEN 'moderator' THEN 2
        WHEN 'vip' THEN 3
        ELSE 4
      END
    LIMIT 1
  `, [userId]);

  return result.rows[0]?.role_name || null;
}

/**
 * 检查VIP等级是否满足要求
 */
function isVipLevelSufficient(userLevel, requiredLevel) {
  const levelHierarchy = {
    'admin': 4,
    'moderator': 3,
    'vip': 2,
    'user': 1
  };

  return (levelHierarchy[userLevel] || 0) >= (levelHierarchy[requiredLevel] || 0);
}

/**
 * 获取用户积分
 */
async function getUserPoints(userId) {
  const result = await query(`
    SELECT COALESCE(SUM(points), 0) as total_points
    FROM user_points
    WHERE user_id = $1
  `, [userId]);

  return parseInt(result.rows[0].total_points) || 0;
}

/**
 * 扣除用户积分
 */
async function deductUserPoints(userId, points, resourceId) {
  await query(`
    INSERT INTO user_points (user_id, points, reason, resource_id)
    VALUES ($1, $2, $3, $4)
  `, [userId, -points, '下载资源消耗', resourceId]);
}

/**
 * 获取用户对特定资源的下载次数
 */
async function getUserResourceDownloadCount(userId, resourceId) {
  const result = await query(`
    SELECT COUNT(*) as download_count
    FROM download_records
    WHERE user_id = $1 AND resource_id = $2 AND is_successful = true
  `, [userId, resourceId]);

  return parseInt(result.rows[0].download_count) || 0;
}

module.exports = {
  validateDownloadPermission,
  generateSecureResourceInfo,
  generateDownloadInfoArray
};
