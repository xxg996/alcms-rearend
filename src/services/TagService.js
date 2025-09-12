/**
 * 标签业务逻辑服务
 * 处理标签管理相关的所有业务操作
 */

const BaseService = require('./BaseService');
const Tag = require('../models/Tag');

class TagService extends BaseService {
  constructor() {
    super();
  }

  /**
   * 获取标签列表
   */
  async getTagList(filters = {}, pagination = {}) {
    return this.withPerformanceMonitoring('getTagList', async () => {
      try {
        const { page, limit, offset } = this.normalizePaginationParams(
          pagination.page,
          pagination.limit
        );

        const normalizedFilters = this.normalizeTagFilters(filters);

        const [tags, totalCount] = await Promise.all([
          Tag.findByFilters({ ...normalizedFilters, limit, offset }),
          Tag.countByFilters(normalizedFilters)
        ]);

        return this.formatPaginatedResponse(
          tags,
          { page, limit },
          totalCount
        );

      } catch (error) {
        this.handleError(error, 'getTagList');
      }
    });
  }

  /**
   * 获取热门标签
   */
  async getHotTags(limit = 50) {
    return this.withPerformanceMonitoring('getHotTags', async () => {
      try {
        const cacheKey = `tags:hot:${limit}`;

        return await this.getCached(cacheKey, async () => {
          const tags = await Tag.findHotTags(limit);
          
          return this.formatSuccessResponse(tags, '获取热门标签成功');
        }, 600); // 缓存10分钟

      } catch (error) {
        this.handleError(error, 'getHotTags');
      }
    });
  }

  /**
   * 根据ID获取标签详情
   */
  async getTagById(tagId) {
    return this.withPerformanceMonitoring('getTagById', async () => {
      try {
        this.validateRequired({ tagId }, ['tagId']);

        const cacheKey = `tag:${tagId}`;

        return await this.getCached(cacheKey, async () => {
          const tag = await Tag.findById(tagId);
          
          if (!tag) {
            throw new Error('标签不存在');
          }

          // 获取标签统计信息
          const stats = await Tag.getTagStats(tagId);

          const enrichedTag = {
            ...tag,
            stats
          };

          return this.formatSuccessResponse(enrichedTag, '获取标签详情成功');
        }, 300);

      } catch (error) {
        this.handleError(error, 'getTagById');
      }
    });
  }

  /**
   * 创建标签
   */
  async createTag(tagData, userId) {
    return this.withPerformanceMonitoring('createTag', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);
        this.validateRequired(tagData, ['name']);

        const { name, display_name, description, color, category } = tagData;

        // 标准化标签名称
        const normalizedName = this.normalizeTagName(name);
        
        // 验证标签名称唯一性
        const existingTag = await Tag.findByName(normalizedName);
        if (existingTag) {
          throw new Error('标签已存在');
        }

        const newTag = await Tag.create({
          name: normalizedName,
          display_name: display_name || name,
          description,
          color: color || this.generateRandomColor(),
          category,
          status: 'active',
          created_by: userId,
          created_at: new Date(),
          updated_at: new Date()
        });

        // 清除相关缓存
        await this.clearTagCache();

        this.log('info', '标签创建成功', { 
          tagId: newTag.id, 
          name: normalizedName, 
          userId 
        });

        return this.formatSuccessResponse(newTag, '标签创建成功');

      } catch (error) {
        this.handleError(error, 'createTag');
      }
    });
  }

  /**
   * 更新标签
   */
  async updateTag(tagId, updateData, userId) {
    return this.withPerformanceMonitoring('updateTag', async () => {
      try {
        this.validateRequired({ tagId, userId }, ['tagId', 'userId']);

        const existingTag = await Tag.findById(tagId);
        if (!existingTag) {
          throw new Error('标签不存在');
        }

        const { name, display_name, description, color, category, status } = updateData;

        // 验证标签名称唯一性（如果更改了名称）
        if (name && name !== existingTag.name) {
          const normalizedName = this.normalizeTagName(name);
          const duplicateTag = await Tag.findByName(normalizedName);
          if (duplicateTag && duplicateTag.id !== tagId) {
            throw new Error('标签名称已存在');
          }
        }

        const updatedTag = await Tag.updateById(tagId, {
          ...(name !== undefined && { name: this.normalizeTagName(name) }),
          ...(display_name !== undefined && { display_name }),
          ...(description !== undefined && { description }),
          ...(color !== undefined && { color }),
          ...(category !== undefined && { category }),
          ...(status !== undefined && { status }),
          updated_at: new Date()
        });

        // 清除相关缓存
        await this.clearTagCache();

        this.log('info', '标签更新成功', { tagId, userId });

        return this.formatSuccessResponse(updatedTag, '标签更新成功');

      } catch (error) {
        this.handleError(error, 'updateTag');
      }
    });
  }

  /**
   * 删除标签
   */
  async deleteTag(tagId, userId) {
    return this.withPerformanceMonitoring('deleteTag', async () => {
      try {
        this.validateRequired({ tagId, userId }, ['tagId']);

        const tag = await Tag.findById(tagId);
        if (!tag) {
          throw new Error('标签不存在');
        }

        // 检查标签是否被使用
        const usageCount = await Tag.getUsageCount(tagId);
        if (usageCount > 0) {
          throw new Error(`标签正在被 ${usageCount} 个资源使用，无法删除`);
        }

        await Tag.deleteById(tagId);

        // 清除相关缓存
        await this.clearTagCache();

        this.log('info', '标签删除成功', { tagId, userId });

        return this.formatSuccessResponse(null, '标签删除成功');

      } catch (error) {
        this.handleError(error, 'deleteTag');
      }
    });
  }

  /**
   * 批量创建标签
   */
  async createTagsBatch(tagNames, userId) {
    return this.withPerformanceMonitoring('createTagsBatch', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        if (!Array.isArray(tagNames) || tagNames.length === 0) {
          throw new Error('标签名称列表不能为空');
        }

        if (tagNames.length > 50) {
          throw new Error('一次最多创建50个标签');
        }

        const results = [];
        const errors = [];

        for (const tagName of tagNames) {
          try {
            const normalizedName = this.normalizeTagName(tagName);
            
            // 检查标签是否已存在
            let existingTag = await Tag.findByName(normalizedName);
            
            if (existingTag) {
              results.push({
                name: normalizedName,
                action: 'existed',
                tag: existingTag
              });
            } else {
              // 创建新标签
              const newTag = await Tag.create({
                name: normalizedName,
                display_name: tagName,
                color: this.generateRandomColor(),
                status: 'active',
                created_by: userId,
                created_at: new Date(),
                updated_at: new Date()
              });

              results.push({
                name: normalizedName,
                action: 'created',
                tag: newTag
              });
            }
          } catch (error) {
            errors.push({
              name: tagName,
              error: error.message
            });
          }
        }

        // 清除相关缓存
        await this.clearTagCache();

        this.log('info', '批量创建标签完成', { 
          total: tagNames.length,
          created: results.filter(r => r.action === 'created').length,
          existed: results.filter(r => r.action === 'existed').length,
          errors: errors.length,
          userId 
        });

        return this.formatSuccessResponse({
          results,
          errors,
          summary: {
            total: tagNames.length,
            created: results.filter(r => r.action === 'created').length,
            existed: results.filter(r => r.action === 'existed').length,
            failed: errors.length
          }
        }, '批量创建标签完成');

      } catch (error) {
        this.handleError(error, 'createTagsBatch');
      }
    });
  }

  /**
   * 搜索标签
   */
  async searchTags(query, limit = 20) {
    return this.withPerformanceMonitoring('searchTags', async () => {
      try {
        this.validateRequired({ query }, ['query']);

        if (query.length < 1) {
          throw new Error('搜索关键词至少1个字符');
        }

        const cacheKey = `tags:search:${query}:${limit}`;

        return await this.getCached(cacheKey, async () => {
          const tags = await Tag.searchTags(query, limit);
          
          return this.formatSuccessResponse(tags, '搜索标签成功');
        }, 180); // 缓存3分钟

      } catch (error) {
        this.handleError(error, 'searchTags');
      }
    });
  }

  /**
   * 获取标签建议
   */
  async getTagSuggestions(text, limit = 10) {
    return this.withPerformanceMonitoring('getTagSuggestions', async () => {
      try {
        this.validateRequired({ text }, ['text']);

        const cacheKey = `tags:suggestions:${text}:${limit}`;

        return await this.getCached(cacheKey, async () => {
          // 基于文本内容分析推荐相关标签
          const suggestions = await this.analyzeTextForTags(text, limit);
          
          return this.formatSuccessResponse(suggestions, '获取标签建议成功');
        }, 300);

      } catch (error) {
        this.handleError(error, 'getTagSuggestions');
      }
    });
  }

  /**
   * 获取标签统计
   */
  async getTagStats(dateRange = {}) {
    return this.withPerformanceMonitoring('getTagStats', async () => {
      try {
        const cacheKey = `tags:stats:${JSON.stringify(dateRange)}`;

        return await this.getCached(cacheKey, async () => {
          const stats = await Tag.getOverallStats(dateRange);
          
          return this.formatSuccessResponse(stats, '获取标签统计成功');
        }, 300);

      } catch (error) {
        this.handleError(error, 'getTagStats');
      }
    });
  }

  /**
   * 合并标签
   */
  async mergeTags(sourceTagId, targetTagId, userId) {
    return this.withPerformanceMonitoring('mergeTags', async () => {
      try {
        this.validateRequired({ sourceTagId, targetTagId, userId }, 
          ['sourceTagId', 'targetTagId', 'userId']);

        if (sourceTagId === targetTagId) {
          throw new Error('源标签和目标标签不能相同');
        }

        const [sourceTag, targetTag] = await Promise.all([
          Tag.findById(sourceTagId),
          Tag.findById(targetTagId)
        ]);

        if (!sourceTag) {
          throw new Error('源标签不存在');
        }

        if (!targetTag) {
          throw new Error('目标标签不存在');
        }

        const result = await this.executeInTransaction(async (client) => {
          // 将源标签的所有关联转移到目标标签
          await Tag.transferAssociations(sourceTagId, targetTagId, client);
          
          // 删除源标签
          await Tag.deleteById(sourceTagId, client);

          return {
            merged_tag: sourceTag,
            target_tag: targetTag
          };
        });

        // 清除相关缓存
        await this.clearTagCache();

        this.log('info', '标签合并成功', { 
          sourceTagId, 
          targetTagId, 
          userId 
        });

        return this.formatSuccessResponse(result, '标签合并成功');

      } catch (error) {
        this.handleError(error, 'mergeTags');
      }
    });
  }

  /**
   * 标准化标签名称
   */
  normalizeTagName(name) {
    return name.toLowerCase()
      .trim()
      .replace(/\s+/g, '-') // 空格替换为连字符
      .replace(/[^\w\u4e00-\u9fff-]/g, '') // 只保留字母数字中文和连字符
      .substring(0, 50); // 限制长度
  }

  /**
   * 生成随机颜色
   */
  generateRandomColor() {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
      '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
      '#74B9FF', '#FD79A8', '#6C5CE7', '#A29BFE', '#F8B500'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * 分析文本推荐标签
   */
  async analyzeTextForTags(text, limit) {
    // 这里可以实现更复杂的NLP分析
    // 目前简化为关键词匹配
    const keywords = text.toLowerCase()
      .split(/\W+/)
      .filter(word => word.length >= 2)
      .slice(0, 20);

    const suggestions = [];

    for (const keyword of keywords) {
      const matchingTags = await Tag.searchTags(keyword, 3);
      suggestions.push(...matchingTags);
    }

    // 去重并按使用频率排序
    const uniqueTags = suggestions
      .filter((tag, index, self) => 
        self.findIndex(t => t.id === tag.id) === index
      )
      .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
      .slice(0, limit);

    return uniqueTags;
  }

  /**
   * 标准化标签过滤参数
   */
  normalizeTagFilters(filters) {
    const {
      category,
      status,
      search,
      created_by
    } = filters;

    return {
      category,
      status,
      search,
      created_by: created_by ? parseInt(created_by) : undefined
    };
  }

  /**
   * 清除标签相关缓存
   */
  async clearTagCache() {
    await Promise.all([
      this.clearCache('tags:hot:*'),
      this.clearCache('tags:search:*'),
      this.clearCache('tags:suggestions:*'),
      this.clearCache('tags:stats:*'),
      this.clearCache('tag:*')
    ]);
  }
}

module.exports = new TagService();