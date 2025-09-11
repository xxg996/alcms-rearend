/**
 * 资源管理控制器
 * 处理资源相关的HTTP请求
 */

const Resource = require('../models/Resource');
const Category = require('../models/Category');
const Tag = require('../models/Tag');
const { generateSignedUrl, validateDownloadPermission, generateSecureResourceInfo, deobfuscateUrl } = require('../utils/downloadUtils');

class ResourceController {
  /**
   * 获取资源列表
   */
  static async getResources(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        type,
        author,
        status,
        isPublic,
        isFree,
        search,
        tags,
        sortBy,
        sortOrder
      } = req.query;

      // 解析标签参数
      const tagArray = tags ? (Array.isArray(tags) ? tags : tags.split(',')) : undefined;

      const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100), // 限制最大每页数量
        categoryId: category ? parseInt(category) : undefined,
        resourceTypeId: type ? parseInt(type) : undefined,
        authorId: author ? parseInt(author) : undefined,
        status,
        isPublic: isPublic !== undefined ? isPublic === 'true' : undefined,
        isFree: isFree !== undefined ? isFree === 'true' : undefined,
        search,
        tags: tagArray,
        sortBy,
        sortOrder
      };

      const result = await Resource.findAll(options);

      // 为列表中的每个资源生成安全信息
      if (result.resources) {
        result.resources = await Promise.all(
          result.resources.map(resource => 
            generateSecureResourceInfo(resource, req.user?.id)
          )
        );
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('获取资源列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取资源列表失败',
        error: error.message
      });
    }
  }

  /**
   * 获取单个资源详情
   */
  static async getResource(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const resource = await Resource.findById(parseInt(id), userId);

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: '资源不存在'
        });
      }

      // 检查访问权限
      if (!resource.is_public && (!userId || resource.author_id !== userId)) {
        // 检查用户是否有权限访问私有资源
        const hasPermission = await ResourceController.checkResourceAccessPermission(userId, resource);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: '无权访问此资源'
          });
        }
      }

      // 增加浏览次数（异步执行，不等待结果）
      Resource.incrementViewCount(parseInt(id)).catch(console.error);

      // 生成安全的资源信息（隐藏真实下载链接）
      const secureResource = await generateSecureResourceInfo(resource, userId);

      res.json({
        success: true,
        data: secureResource
      });
    } catch (error) {
      console.error('获取资源详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取资源详情失败',
        error: error.message
      });
    }
  }

  /**
   * 创建新资源
   */
  static async createResource(req, res) {
    try {
      const userId = req.user.id;
      const {
        title,
        slug,
        description,
        content,
        summary,
        categoryId,
        resourceTypeId,
        coverImageUrl,
        fileUrl,
        fileSize,
        fileMimeType,
        duration,
        externalUrl,
        downloadUrl,
        isPublic = true,
        isFree = true,
        requiredVipLevel,
        requiredPoints = 0,
        downloadLimit,
        tags = []
      } = req.body;

      // 验证必填字段
      if (!title || !resourceTypeId) {
        return res.status(400).json({
          success: false,
          message: '标题和资源类型为必填字段'
        });
      }

      // 处理标签
      let tagIds = [];
      if (tags.length > 0) {
        if (typeof tags[0] === 'string') {
          // 如果传入的是标签名称，创建或获取标签ID
          tagIds = await Tag.createOrGetTags(tags);
        } else {
          // 如果传入的是标签ID
          tagIds = tags;
        }
      }

      const resourceData = {
        title,
        slug,
        description,
        content,
        summary,
        categoryId: categoryId ? parseInt(categoryId) : null,
        resourceTypeId: parseInt(resourceTypeId),
        coverImageUrl,
        fileUrl,
        fileSize: fileSize ? parseInt(fileSize) : null,
        fileMimeType,
        duration: duration ? parseInt(duration) : null,
        externalUrl,
        downloadUrl,
        isPublic,
        isFree,
        requiredVipLevel,
        requiredPoints: parseInt(requiredPoints),
        downloadLimit: downloadLimit ? parseInt(downloadLimit) : null,
        authorId: userId,
        tags: tagIds
      };

      const resource = await Resource.create(resourceData);

      res.status(201).json({
        success: true,
        message: '资源创建成功',
        data: resource
      });
    } catch (error) {
      console.error('创建资源失败:', error);
      res.status(500).json({
        success: false,
        message: '创建资源失败',
        error: error.message
      });
    }
  }

  /**
   * 更新资源
   */
  static async updateResource(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updateData = req.body;

      const resource = await Resource.findById(parseInt(id));

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: '资源不存在'
        });
      }

      // 权限检查：只有作者或管理员可以编辑
      const canEdit = await ResourceController.checkResourceEditPermission(userId, resource);
      if (!canEdit) {
        return res.status(403).json({
          success: false,
          message: '无权编辑此资源'
        });
      }

      // 处理标签更新
      if (updateData.tags) {
        let tagIds = [];
        if (typeof updateData.tags[0] === 'string') {
          tagIds = await Tag.createOrGetTags(updateData.tags);
        } else {
          tagIds = updateData.tags;
        }
        
        // 同步标签
        await Tag.syncResourceTags(parseInt(id), tagIds);
        delete updateData.tags; // 从更新数据中移除，因为已经单独处理
      }

      const updatedResource = await Resource.update(parseInt(id), updateData);

      res.json({
        success: true,
        message: '资源更新成功',
        data: updatedResource
      });
    } catch (error) {
      console.error('更新资源失败:', error);
      res.status(500).json({
        success: false,
        message: '更新资源失败',
        error: error.message
      });
    }
  }

  /**
   * 删除资源
   */
  static async deleteResource(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const resource = await Resource.findById(parseInt(id));

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: '资源不存在'
        });
      }

      // 权限检查：只有作者或管理员可以删除
      const canDelete = await ResourceController.checkResourceDeletePermission(userId, resource);
      if (!canDelete) {
        return res.status(403).json({
          success: false,
          message: '无权删除此资源'
        });
      }

      await Resource.delete(parseInt(id));

      res.json({
        success: true,
        message: '资源删除成功'
      });
    } catch (error) {
      console.error('删除资源失败:', error);
      res.status(500).json({
        success: false,
        message: '删除资源失败',
        error: error.message
      });
    }
  }

  /**
   * 下载资源 - 解析加密URL并返回真实下载链接
   */
  static async downloadResource(req, res) {
    try {
      const { id } = req.params;
      const { encrypted_url } = req.body || req.query;
      const userId = req.user?.id;
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.ip || req.connection.remoteAddress;

      // 验证必需参数
      if (!encrypted_url) {
        return res.status(400).json({
          success: false,
          message: '缺少encrypted_url参数'
        });
      }

      // 解密URL
      const decryptedData = deobfuscateUrl(encrypted_url);
      if (!decryptedData) {
        return res.status(400).json({
          success: false,
          message: '无效的加密URL'
        });
      }

      // 验证资源ID是否匹配
      if (decryptedData.resourceId !== parseInt(id)) {
        return res.status(400).json({
          success: false,
          message: '资源ID不匹配'
        });
      }

      const resource = await Resource.findById(parseInt(id));

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: '资源不存在'
        });
      }

      // 检查下载权限
      const permissionCheck = await validateDownloadPermission(userId, resource);
      if (!permissionCheck.allowed) {
        return res.status(403).json({
          success: false,
          message: permissionCheck.reason
        });
      }

      // 验证URL是否属于该资源
      const realUrl = decryptedData.url;
      const isValidUrl = realUrl === resource.file_url || 
                        realUrl === resource.download_url || 
                        realUrl === resource.external_url;

      if (!isValidUrl) {
        return res.status(400).json({
          success: false,
          message: 'URL不属于该资源'
        });
      }

      // 记录下载
      await Resource.recordDownload({
        userId,
        resourceId: parseInt(id),
        ipAddress,
        userAgent,
        downloadUrl: realUrl,
        expiresAt: null // 真实链接不需要过期时间
      });

      // 扣除积分（如果需要）
      if (permissionCheck.pointsToDeduct > 0) {
        const { query } = require('../config/database');
        await query(`
          INSERT INTO user_points (user_id, points, reason, resource_id)
          VALUES ($1, $2, $3, $4)
        `, [userId, -permissionCheck.pointsToDeduct, '下载资源消耗', parseInt(id)]);
      }

      // 返回真实下载链接
      res.json({
        success: true,
        message: '获取下载链接成功',
        data: {
          download_url: realUrl,
          file_name: resource.title,
          file_size: resource.file_size,
          mime_type: resource.file_mime_type,
          is_external: realUrl === resource.external_url
        }
      });
    } catch (error) {
      console.error('获取下载链接失败:', error);
      res.status(500).json({
        success: false,
        message: '获取下载链接失败',
        error: error.message
      });
    }
  }

  /**
   * 搜索资源
   */
  static async searchResources(req, res) {
    try {
      const { q: query, page = 1, limit = 20, type } = req.query;

      if (!query || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: '搜索关键词不能为空'
        });
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const searchResults = await Resource.fullTextSearch(query.trim(), {
        limit: parseInt(limit),
        offset
      });

      res.json({
        success: true,
        data: {
          resources: searchResults,
          query: query.trim(),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: searchResults.length
          }
        }
      });
    } catch (error) {
      console.error('搜索资源失败:', error);
      res.status(500).json({
        success: false,
        message: '搜索失败',
        error: error.message
      });
    }
  }

  /**
   * 获取资源统计信息
   */
  static async getResourceStats(req, res) {
    try {
      const { query } = require('../config/database');

      const stats = await query(`
        SELECT 
          COUNT(*) as total_resources,
          COUNT(CASE WHEN status = 'published' THEN 1 END) as published_resources,
          COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_resources,
          COUNT(CASE WHEN is_public = true THEN 1 END) as public_resources,
          COUNT(CASE WHEN is_free = true THEN 1 END) as free_resources,
          SUM(view_count) as total_views,
          SUM(download_count) as total_downloads,
          AVG(file_size) as avg_file_size
        FROM resources
      `);

      const typeStats = await query(`
        SELECT 
          rt.display_name as type_name,
          COUNT(r.id) as count
        FROM resource_types rt
        LEFT JOIN resources r ON rt.id = r.resource_type_id
        GROUP BY rt.id, rt.display_name
        ORDER BY count DESC
      `);

      const categoryStats = await query(`
        SELECT 
          c.display_name as category_name,
          COUNT(r.id) as count
        FROM categories c
        LEFT JOIN resources r ON c.id = r.category_id
        GROUP BY c.id, c.display_name
        ORDER BY count DESC
        LIMIT 10
      `);

      res.json({
        success: true,
        data: {
          overview: stats.rows[0],
          byType: typeStats.rows,
          byCategory: categoryStats.rows
        }
      });
    } catch (error) {
      console.error('获取资源统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取统计信息失败',
        error: error.message
      });
    }
  }

  // 权限检查辅助方法
  static async checkResourceAccessPermission(userId, resource) {
    if (!userId) return false;
    
    // 作者可以访问自己的资源
    if (resource.author_id === userId) return true;
    
    // 检查管理员权限
    return await this.hasPermission(userId, 'resource:read');
  }

  static async checkResourceEditPermission(userId, resource) {
    // 作者可以编辑自己的资源
    if (resource.author_id === userId) return true;
    
    // 检查管理员权限
    return await this.hasPermission(userId, 'resource:update');
  }

  static async checkResourceDeletePermission(userId, resource) {
    // 作者可以删除自己的资源
    if (resource.author_id === userId) return true;
    
    // 检查管理员权限
    return await this.hasPermission(userId, 'resource:delete');
  }

  static async hasPermission(userId, permissionName) {
    const { query } = require('../config/database');
    
    const result = await query(`
      SELECT 1 FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1 AND p.name = $2
      LIMIT 1
    `, [userId, permissionName]);
    
    return result.rows.length > 0;
  }
}

module.exports = ResourceController;
