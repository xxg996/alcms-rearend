/**
 * 标签管理控制器
 * 处理标签相关的HTTP请求
 */

const Tag = require('../models/Tag');

class TagController {
  /**
   * 获取标签列表
   */
  static async getTags(req, res) {
    try {
      const {
        search,
        sortBy = 'usage_count',
        sortOrder = 'DESC',
        limit,
        page = 1
      } = req.query;

      const options = {
        search,
        sortBy,
        sortOrder,
        limit: limit ? parseInt(limit) : undefined,
        offset: limit ? (parseInt(page) - 1) * parseInt(limit) : 0
      };

      const tags = await Tag.findAll(options);

      res.json({
        success: true,
        data: {
          tags,
          pagination: limit ? {
            page: parseInt(page),
            limit: parseInt(limit),
            total: tags.length
          } : null
        }
      });
    } catch (error) {
      console.error('获取标签列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取标签列表失败',
        error: error.message
      });
    }
  }

  /**
   * 获取单个标签详情
   */
  static async getTag(req, res) {
    try {
      const { id } = req.params;

      const tag = await Tag.findById(parseInt(id));

      if (!tag) {
        return res.status(404).json({
          success: false,
          message: '标签不存在'
        });
      }

      res.json({
        success: true,
        data: tag
      });
    } catch (error) {
      console.error('获取标签详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取标签详情失败',
        error: error.message
      });
    }
  }

  /**
   * 创建新标签
   */
  static async createTag(req, res) {
    try {
      const { name, displayName, description, color } = req.body;

      // 验证必填字段
      if (!name || !displayName) {
        return res.status(400).json({
          success: false,
          message: '标签名称和显示名称为必填字段'
        });
      }

      // 检查权限
      const hasPermission = await TagController.hasPermission(req.user.id, 'tag:create');
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: '无权创建标签'
        });
      }

      const tagData = {
        name: name.toLowerCase().trim(),
        displayName: displayName.trim(),
        description,
        color: color || '#007bff'
      };

      const tag = await Tag.create(tagData);

      res.status(201).json({
        success: true,
        message: '标签创建成功',
        data: tag
      });
    } catch (error) {
      console.error('创建标签失败:', error);
      
      if (error.message === '标签名称已存在') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: '创建标签失败',
        error: error.message
      });
    }
  }

  /**
   * 更新标签
   */
  static async updateTag(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // 检查权限
      const hasPermission = await TagController.hasPermission(req.user.id, 'tag:update');
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: '无权更新标签'
        });
      }

      const tag = await Tag.findById(parseInt(id));

      if (!tag) {
        return res.status(404).json({
          success: false,
          message: '标签不存在'
        });
      }

      // 数据预处理
      if (updateData.name) {
        updateData.name = updateData.name.toLowerCase().trim();
      }
      if (updateData.displayName) {
        updateData.displayName = updateData.displayName.trim();
      }

      const updatedTag = await Tag.update(parseInt(id), updateData);

      res.json({
        success: true,
        message: '标签更新成功',
        data: updatedTag
      });
    } catch (error) {
      console.error('更新标签失败:', error);
      res.status(500).json({
        success: false,
        message: '更新标签失败',
        error: error.message
      });
    }
  }

  /**
   * 删除标签
   */
  static async deleteTag(req, res) {
    try {
      const { id } = req.params;

      // 检查权限
      const hasPermission = await TagController.hasPermission(req.user.id, 'tag:delete');
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: '无权删除标签'
        });
      }

      const tag = await Tag.findById(parseInt(id));

      if (!tag) {
        return res.status(404).json({
          success: false,
          message: '标签不存在'
        });
      }

      await Tag.delete(parseInt(id));

      res.json({
        success: true,
        message: '标签删除成功'
      });
    } catch (error) {
      console.error('删除标签失败:', error);
      
      if (error.message.includes('关联资源')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: '删除标签失败',
        error: error.message
      });
    }
  }

  /**
   * 搜索标签
   */
  static async searchTags(req, res) {
    try {
      const { q: query, limit = 10 } = req.query;

      if (!query || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: '搜索关键词不能为空'
        });
      }

      const tags = await Tag.searchTags(query.trim(), parseInt(limit));

      res.json({
        success: true,
        data: {
          tags,
          query: query.trim()
        }
      });
    } catch (error) {
      console.error('搜索标签失败:', error);
      res.status(500).json({
        success: false,
        message: '搜索标签失败',
        error: error.message
      });
    }
  }

  /**
   * 获取热门标签
   */
  static async getPopularTags(req, res) {
    try {
      const { limit = 20 } = req.query;

      const tags = await Tag.getPopularTags(parseInt(limit));

      res.json({
        success: true,
        data: tags
      });
    } catch (error) {
      console.error('获取热门标签失败:', error);
      res.status(500).json({
        success: false,
        message: '获取热门标签失败',
        error: error.message
      });
    }
  }

  /**
   * 批量创建标签
   */
  static async createTags(req, res) {
    try {
      const { tags } = req.body;

      if (!Array.isArray(tags) || tags.length === 0) {
        return res.status(400).json({
          success: false,
          message: '标签数据格式错误'
        });
      }

      // 检查权限
      const hasPermission = await TagController.hasPermission(req.user.id, 'tag:create');
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: '无权创建标签'
        });
      }

      const results = [];
      const errors = [];

      for (const tagData of tags) {
        try {
          const { name, displayName, description, color } = tagData;
          
          if (!name || !displayName) {
            errors.push({
              tag: tagData,
              error: '标签名称和显示名称为必填字段'
            });
            continue;
          }

          const processedTagData = {
            name: name.toLowerCase().trim(),
            displayName: displayName.trim(),
            description,
            color: color || '#007bff'
          };

          const tag = await Tag.create(processedTagData);
          results.push(tag);
        } catch (error) {
          errors.push({
            tag: tagData,
            error: error.message
          });
        }
      }

      res.status(201).json({
        success: true,
        message: `成功创建 ${results.length} 个标签`,
        data: {
          created: results,
          errors: errors.length > 0 ? errors : undefined
        }
      });
    } catch (error) {
      console.error('批量创建标签失败:', error);
      res.status(500).json({
        success: false,
        message: '批量创建标签失败',
        error: error.message
      });
    }
  }

  /**
   * 检查用户权限
   */
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

module.exports = TagController;
