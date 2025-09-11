/**
 * 下载工具函数
 * 处理资源下载权限检查和签名链接生成
 */

const crypto = require('crypto');
const { query } = require('../config/database');

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

    // 检查免费状态
    if (!resource.is_free) {
      if (!userId) {
        return {
          allowed: false,
          reason: '请先登录后下载付费资源'
        };
      }

      // 检查VIP权限
      if (resource.required_vip_level) {
        const userVipLevel = await getUserVipLevel(userId);
        if (!userVipLevel || !isVipLevelSufficient(userVipLevel, resource.required_vip_level)) {
          return {
            allowed: false,
            reason: `需要 ${resource.required_vip_level} 及以上会员权限`
          };
        }
      }

      // 检查积分要求
      if (resource.required_points > 0) {
        const userPoints = await getUserPoints(userId);
        if (userPoints < resource.required_points) {
          return {
            allowed: false,
            reason: `需要 ${resource.required_points} 积分，当前积分不足`
          };
        }
      }
    }

    // 检查下载次数限制
    if (resource.download_limit && resource.download_limit > 0) {
      const downloadCount = await getUserResourceDownloadCount(userId, resource.id);
      if (downloadCount >= resource.download_limit) {
        return {
          allowed: false,
          reason: `下载次数已达到限制（${resource.download_limit}次）`
        };
      }
    }

    // 检查是否需要消耗积分
    let pointsToDeduct = 0;
    if (!resource.is_free && resource.required_points > 0) {
      pointsToDeduct = resource.required_points;
    }

    return {
      allowed: true,
      pointsToDeduct,
      reason: '允许下载'
    };

  } catch (error) {
    console.error('权限检查失败:', error);
    return {
      allowed: false,
      reason: '权限检查失败，请稍后重试'
    };
  }
}

/**
 * 生成签名下载链接
 * @param {Object} resource - 资源对象
 * @param {number} userId - 用户ID
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 下载信息
 */
async function generateSignedUrl(resource, userId, options = {}) {
  const {
    ipAddress,
    userAgent,
    expiresIn = 3600 // 默认1小时过期
  } = options;

  try {
    // 确定实际下载URL
    let actualDownloadUrl = resource.file_url || resource.download_url || resource.external_url;
    
    if (!actualDownloadUrl) {
      throw new Error('无有效下载地址');
    }

    // 如果是外部链接，直接返回
    if (resource.external_url && !resource.file_url) {
      return {
        downloadUrl: resource.external_url,
        isExternal: true,
        expiresAt: null
      };
    }

    // 生成过期时间
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // 生成签名
    const signature = generateDownloadSignature({
      resourceId: resource.id,
      userId,
      expiresAt: expiresAt.getTime(),
      ipAddress
    });

    // 构建签名链接
    const signedUrl = buildSignedUrl(actualDownloadUrl, {
      resourceId: resource.id,
      userId,
      expires: Math.floor(expiresAt.getTime() / 1000),
      signature
    });

    // 如果需要扣除积分，记录积分变更
    const permissionCheck = await validateDownloadPermission(userId, resource);
    if (permissionCheck.pointsToDeduct > 0) {
      await deductUserPoints(userId, permissionCheck.pointsToDeduct, resource.id);
    }

    return {
      signedUrl,
      downloadUrl: actualDownloadUrl,
      expiresAt,
      isExternal: false,
      fileSize: resource.file_size,
      fileName: extractFileName(actualDownloadUrl, resource.title),
      mimeType: resource.file_mime_type
    };

  } catch (error) {
    console.error('生成签名链接失败:', error);
    throw error;
  }
}

/**
 * 验证下载签名
 * @param {Object} params - 参数对象
 * @returns {boolean} 签名是否有效
 */
function validateDownloadSignature(params) {
  const { resourceId, userId, expires, signature, ipAddress } = params;

  try {
    // 检查过期时间
    if (Date.now() > expires * 1000) {
      return false;
    }

    // 生成期望的签名
    const expectedSignature = generateDownloadSignature({
      resourceId,
      userId,
      expiresAt: expires * 1000,
      ipAddress
    });

    // 比较签名
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

  } catch (error) {
    console.error('签名验证失败:', error);
    return false;
  }
}

/**
 * 生成下载签名
 * @param {Object} data - 签名数据
 * @returns {string} 签名
 */
function generateDownloadSignature(data) {
  const { resourceId, userId, expiresAt, ipAddress } = data;
  
  const secret = process.env.JWT_SECRET || 'default-secret';
  const payload = `${resourceId}:${userId}:${expiresAt}:${ipAddress}`;
  
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * 构建签名URL
 * @param {string} baseUrl - 基础URL
 * @param {Object} params - 参数
 * @returns {string} 签名URL
 */
function buildSignedUrl(baseUrl, params) {
  const url = new URL(baseUrl, 'http://localhost'); // 使用临时base URL进行解析
  
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return baseUrl.includes('://') ? url.toString() : url.pathname + url.search;
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
 * 加密混淆URL
 * @param {string} url - 原始URL
 * @param {number} resourceId - 资源ID
 * @returns {string} 混淆后的字符串
 */
function obfuscateUrl(url, resourceId) {
  if (!url) return null;
  
  const secret = process.env.JWT_SECRET || 'default-secret';
  const data = JSON.stringify({ url, resourceId, timestamp: Date.now() });
  
  // 使用现代加密方法
  const algorithm = 'aes-256-cbc';
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // 组合IV和加密数据
  const combined = iv.toString('hex') + ':' + encrypted;
  
  // 添加随机前缀和后缀混淆
  const prefix = crypto.randomBytes(8).toString('hex');
  const suffix = crypto.randomBytes(8).toString('hex');
  
  return `${prefix}_${Buffer.from(combined).toString('base64')}_${suffix}`;
}

/**
 * 解密混淆URL
 * @param {string} obfuscatedUrl - 混淆的字符串
 * @returns {Object|null} 解密后的数据
 */
function deobfuscateUrl(obfuscatedUrl) {
  try {
    const secret = process.env.JWT_SECRET || 'default-secret';
    
    // 移除前缀和后缀
    const parts = obfuscatedUrl.split('_');
    if (parts.length !== 3) return null;
    
    const combined = Buffer.from(parts[1], 'base64').toString('utf8');
    const [ivHex, encrypted] = combined.split(':');
    
    if (!ivHex || !encrypted) return null;
    
    const algorithm = 'aes-256-cbc';
    const key = crypto.createHash('sha256').update(secret).digest();
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('URL解密失败:', error);
    return null;
  }
}

/**
 * 生成安全的资源展示信息
 * @param {Object} resource - 资源对象
 * @param {number} userId - 用户ID (可选)
 * @returns {Promise<Object>} 安全的资源信息
 */
async function generateSecureResourceInfo(resource, userId = null) {
  const secureResource = { ...resource };
  
  // 生成下载信息数组
  secureResource.downloadInfo = await generateDownloadInfoArray(resource, userId);
  
  // 移除原始的下载URL字段，确保安全
  delete secureResource.file_url;
  delete secureResource.download_url;
  delete secureResource.external_url;
  
  // 添加下载端点信息
  secureResource.download_endpoint = `/api/resources/${resource.id}/download`;
  
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
        console.error('权限检查失败:', error);
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
        encrypted_url: permissionCheck.allowed ? obfuscateUrl(resource.download_url, resource.id) : null,
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
        encrypted_url: permissionCheck.allowed ? obfuscateUrl(resource.file_url, resource.id) : null,
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
        encrypted_url: permissionCheck.allowed ? obfuscateUrl(resource.file_url, resource.id) : null,
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
  generateSignedUrl,
  validateDownloadSignature,
  generateDownloadSignature,
  buildSignedUrl,
  obfuscateUrl,
  deobfuscateUrl,
  generateSecureResourceInfo,
  generateDownloadInfoArray
};
