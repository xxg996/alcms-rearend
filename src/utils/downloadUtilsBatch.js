/**
 * 批量下载工具函数
 * 解决N+1查询问题，提供批量下载权限检查和安全信息生成
 */

const { batchLoader } = require('./batchLoader');
const { logger } = require('./logger');

/**
 * 批量生成安全的资源展示信息
 * 解决N+1查询问题
 * @param {Array} resources - 资源数组
 * @param {number} userId - 用户ID (可选)
 * @returns {Promise<Array>} 安全的资源信息数组
 */
async function generateSecureResourceInfoBatch(resources, userId = null) {
  if (!resources || resources.length === 0) {
    return [];
  }

  try {
    const resourceIds = resources.map(r => r.id);
    
    // 批量预加载关联数据
    const [
      tagsMap,
      downloadPermissions
    ] = await Promise.all([
      batchLoadResourceTags(resourceIds),
      batchLoadDownloadPermissions(resources, userId)
    ]);

    // 生成安全的资源信息
    const secureResources = resources.map((resource, index) => {
      const secureResource = { ...resource };
      
      // 添加标签信息
      secureResource.tags = tagsMap[resource.id] || [];
      
      // 注意：下载信息已迁移到 resource_files 表，通过专门的接口获取
      // 不再在资源列表中包含下载信息
      
      return secureResource;
    });

    return secureResources;

  } catch (error) {
    logger.error('批量生成安全资源信息失败:', error);
    
    // 降级处理：逐个生成（保持兼容性）
    const { generateSecureResourceInfo } = require('./downloadUtils');
    return Promise.all(
      resources.map(resource => generateSecureResourceInfo(resource, userId))
    );
  }
}

/**
 * 批量加载资源标签
 * @param {Array} resourceIds - 资源ID数组
 * @returns {Promise<Object>} 资源标签映射
 */
async function batchLoadResourceTags(resourceIds) {
  try {
    const tagArrays = await batchLoader.loadMany('resource_tags', resourceIds);
    
    const tagsMap = {};
    resourceIds.forEach((id, index) => {
      tagsMap[id] = tagArrays[index] || [];
    });
    
    return tagsMap;
  } catch (error) {
    logger.error('批量加载资源标签失败:', error);
    return {};
  }
}

/**
 * 批量加载下载权限信息
 * @param {Array} resources - 资源数组
 * @param {number} userId - 用户ID
 * @returns {Promise<Array>} 权限检查结果数组
 */
async function batchLoadDownloadPermissions(resources, userId) {
  if (!userId) {
    // 未登录用户，所有资源都返回相同的权限检查结果
    return resources.map(() => ({
      allowed: false,
      reason: '未登录用户无法下载'
    }));
  }

  try {
    // 筛选有下载文件的资源
    const permissionKeys = resources.map(resource => ({
      userId,
      resource
    }));

    const permissions = await batchLoader.loadMany('download_permissions', permissionKeys);
    return permissions;

  } catch (error) {
    logger.error('批量加载下载权限失败:', error);
    
    // 降级处理：返回默认权限
    return resources.map(() => ({
      allowed: false,
      reason: '权限检查失败'
    }));
  }
}

/**
 * 为单个资源生成下载信息
 * @param {Object} resource - 资源对象
 * @param {Object} permissionCheck - 权限检查结果
 * @param {number} userId - 用户ID
 * @returns {Array} 下载信息数组
 */
function generateDownloadInfoForResource(resource, permissionCheck, userId) {
  const downloadInfo = [];
  
  // 检查是否有可下载文件
  const hasDownloadableFiles = !!(resource.file_url || resource.download_url || resource.external_url);
  
  if (!hasDownloadableFiles) {
    return [{
      type: 'none',
      url: null,
      available: false,
      reason: '该资源暂无可下载文件'
    }];
  }

  // 根据权限检查结果生成下载信息
  if (!userId) {
    // 未登录用户
    downloadInfo.push({
      type: 'auth_required',
      url: null,
      available: false,
      reason: '请先登录以下载资源',
      requiresAuth: true
    });
  } else if (!permissionCheck.allowed) {
    // 无权限下载
    downloadInfo.push({
      type: 'permission_denied',
      url: null,
      available: false,
      reason: permissionCheck.reason,
      requiresPermission: true
    });
  } else {
    // 有权限下载 - 生成混淆URL
    const urls = [
      resource.file_url,
      resource.download_url,
      resource.external_url
    ].filter(Boolean);

    urls.forEach(url => {
      const isExternal = url === resource.external_url;
      const obfuscatedUrl = generateObfuscatedUrl(resource.id, url);
      
      downloadInfo.push({
        type: isExternal ? 'external' : 'internal',
        url: obfuscatedUrl,
        available: true,
        reason: '允许下载',
        isExternal,
        fileSize: resource.file_size,
        mimeType: resource.file_mime_type,
        pointsCost: permissionCheck.pointsToDeduct || 0
      });
    });
  }

  return downloadInfo;
}

/**
 * 生成混淆URL
 * @param {number} resourceId - 资源ID
 * @param {string} url - 原始URL
 * @returns {string} 混淆后的URL
 */
function generateObfuscatedUrl(resourceId, url) {
  try {
    const crypto = require('crypto');
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET must be defined in environment variables');
    }
    
    const data = {
      resourceId: resourceId,
      url: url,
      timestamp: Date.now(),
      expires: Date.now() + (3600 * 1000) // 1小时过期
    };

    const algorithm = 'aes-256-cbc';
    const key = crypto.createHash('sha256').update(secret).digest();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // 返回格式: prefix_ivhex_encryptedhex_suffix
    const prefix = crypto.randomBytes(4).toString('hex');
    const suffix = crypto.randomBytes(4).toString('hex');
    
    return `${prefix}_${iv.toString('hex')}_${encrypted}_${suffix}`;

  } catch (error) {
    logger.error('生成混淆URL失败:', error);
    return null;
  }
}

/**
 * 批量加载用户信息（用于社区模块）
 * @param {Array} userIds - 用户ID数组
 * @returns {Promise<Object>} 用户信息映射
 */
async function batchLoadUsers(userIds) {
  try {
    const uniqueIds = [...new Set(userIds)];
    const users = await batchLoader.loadMany('users', uniqueIds);
    
    const userMap = {};
    uniqueIds.forEach((id, index) => {
      userMap[id] = users[index];
    });
    
    return userMap;
  } catch (error) {
    logger.error('批量加载用户信息失败:', error);
    return {};
  }
}

/**
 * 批量加载分类信息
 * @param {Array} categoryIds - 分类ID数组
 * @returns {Promise<Object>} 分类信息映射
 */
async function batchLoadCategories(categoryIds) {
  try {
    const uniqueIds = [...new Set(categoryIds.filter(Boolean))];
    const categories = await batchLoader.loadMany('categories', uniqueIds);
    
    const categoryMap = {};
    uniqueIds.forEach((id, index) => {
      categoryMap[id] = categories[index];
    });
    
    return categoryMap;
  } catch (error) {
    logger.error('批量加载分类信息失败:', error);
    return {};
  }
}

/**
 * 批量生成社区帖子安全信息
 * @param {Array} posts - 帖子数组
 * @param {number} userId - 用户ID
 * @returns {Promise<Array>} 安全的帖子信息数组
 */
async function generateSecurePostInfoBatch(posts, userId = null) {
  if (!posts || posts.length === 0) {
    return [];
  }

  try {
    const postIds = posts.map(p => p.id);
    const authorIds = posts.map(p => p.author_id);
    const boardIds = posts.map(p => p.board_id);

    // 批量预加载关联数据
    const [
      commentCounts,
      authorMap,
      boardMap,
      interactions
    ] = await Promise.all([
      batchLoadCommentCounts(postIds),
      batchLoadUsers(authorIds),
      batchLoadBoards(boardIds),
      userId ? batchLoadUserInteractions(postIds, userId, 'post') : []
    ]);

    // 生成安全的帖子信息
    const securePosts = posts.map((post, index) => {
      const securePost = { ...post };
      
      // 添加关联信息
      securePost.author = authorMap[post.author_id] || null;
      securePost.board = boardMap[post.board_id] || null;
      securePost.comment_count = commentCounts[index] || 0;
      
      // 添加用户交互状态
      if (userId && interactions[index]) {
        securePost.user_interaction = interactions[index];
      }
      
      return securePost;
    });

    return securePosts;

  } catch (error) {
    logger.error('批量生成安全帖子信息失败:', error);
    return posts; // 降级处理
  }
}

/**
 * 批量加载评论数量
 * @param {Array} postIds - 帖子ID数组
 * @returns {Promise<Array>} 评论数量数组
 */
async function batchLoadCommentCounts(postIds) {
  try {
    return await batchLoader.loadMany('post_comment_counts', postIds);
  } catch (error) {
    logger.error('批量加载评论数量失败:', error);
    return postIds.map(() => 0);
  }
}

/**
 * 批量加载版块信息
 * @param {Array} boardIds - 版块ID数组
 * @returns {Promise<Object>} 版块信息映射
 */
async function batchLoadBoards(boardIds) {
  // 这里可以添加版块加载器，类似于分类加载器
  // 目前返回空映射，避免错误
  return {};
}

/**
 * 批量加载用户交互状态
 * @param {Array} targetIds - 目标ID数组
 * @param {number} userId - 用户ID
 * @param {string} targetType - 目标类型
 * @returns {Promise<Array>} 交互状态数组
 */
async function batchLoadUserInteractions(targetIds, userId, targetType) {
  if (!userId) return [];

  try {
    const interactionKeys = targetIds.map(id => ({
      userId,
      targetId: id,
      targetType
    }));

    return await batchLoader.loadMany('user_interactions', interactionKeys);
  } catch (error) {
    logger.error('批量加载用户交互失败:', error);
    return targetIds.map(() => null);
  }
}

/**
 * 清除相关缓存
 * @param {string} type - 缓存类型
 * @param {*} key - 缓存键
 */
function clearRelatedCache(type, key = null) {
  switch (type) {
    case 'resource':
      batchLoader.clearCache('resource_tags', key);
      batchLoader.clearCache('download_permissions');
      break;
    case 'user':
      batchLoader.clearCache('users', key);
      batchLoader.clearCache('user_interactions');
      break;
    case 'category':
      batchLoader.clearCache('categories', key);
      break;
    case 'post':
      batchLoader.clearCache('post_comment_counts', key);
      batchLoader.clearCache('user_interactions');
      break;
  }
}

module.exports = {
  generateSecureResourceInfoBatch,
  generateSecurePostInfoBatch,
  batchLoadUsers,
  batchLoadCategories,
  batchLoadResourceTags,
  clearRelatedCache
};