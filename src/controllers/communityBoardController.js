/**
 * 社区板块控制器
 * 处理板块的CRUD操作和管理功能
 * @swagger
 * tags:
 *   name: Community-Boards
 *   description: 社区板块管理相关API
 */

const CommunityBoard = require('../models/CommunityBoard');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { logger } = require('../utils/logger');

class CommunityBoardController {
  /**
   * @swagger
   * /api/community/boards:
   *   get:
   *     summary: 获取板块列表
   *     description: 获取社区所有板块列表，支持筛选选项
   *     tags: [Community-Boards]
   *     parameters:
   *       - in: query
   *         name: includeStats
   *         schema:
   *           type: boolean
   *           default: false
   *         description: 是否包含板块统计信息
   *       - in: query
   *         name: activeOnly
   *         schema:
   *           type: boolean
   *           default: true
   *         description: 是否只显示激活的板块
   *     responses:
   *       200:
   *         description: 获取板块列表成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/CommunityBoard'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async getBoards(req, res) {
    try {
      const { includeStats = false, activeOnly = true } = req.query;
      
      const boards = await CommunityBoard.findAll({
        includeStats: includeStats === 'true',
        activeOnly: activeOnly === 'true'
      });

      return successResponse(res, '获取板块列表成功', boards);
    } catch (error) {
      logger.error('获取板块列表失败:', error);
      return errorResponse(res, '获取板块列表失败', 500);
    }
  }

  /**
   * @swagger
   * /api/community/boards/{id}:
   *   get:
   *     summary: 获取板块详情
   *     description: 根据ID获取指定板块的详细信息
   *     tags: [Community-Boards]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 板块ID
   *         example: 1
   *     responses:
   *       200:
   *         description: 获取板块详情成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/CommunityBoard'
   *       404:
   *         description: 板块不存在
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async getBoardById(req, res) {
    try {
      const { id } = req.params;
      
      const board = await CommunityBoard.findById(parseInt(id));
      
      if (!board) {
        return errorResponse(res, '板块不存在', 404);
      }

      return successResponse(res, '获取板块详情成功', board);
    } catch (error) {
      logger.error('获取板块详情失败:', error);
      return errorResponse(res, '获取板块详情失败', 500);
    }
  }

  /**
   * @swagger
   * /api/community/boards:
   *   post:
   *     summary: 创建板块
   *     description: 创建新的社区板块（管理员功能）
   *     tags: [Community-Boards]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateBoardRequest'
   *           example:
   *             name: "tech-discussion"
   *             display_name: "技术讨论"
   *             description: "技术相关话题讨论区"
   *             icon_url: "https://example.com/tech-icon.png"
   *             cover_image_url: "https://example.com/tech-cover.png"
   *             sort_order: 1
   *             is_active: true
   *             moderator_ids: [2, 3]
   *     responses:
   *       201:
   *         description: 创建板块成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/CommunityBoard'
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       409:
   *         description: 板块名称已存在
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async createBoard(req, res) {
    try {
      const body = req.body || {};

      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const displayNameRaw = body.display_name ?? body.displayName;
      const displayName = typeof displayNameRaw === 'string' ? displayNameRaw.trim() : '';
      const description = body.description ?? null;
      const iconUrl = body.icon_url ?? body.iconUrl ?? null;
      const coverImageUrl = body.cover_image_url ?? body.coverImageUrl ?? null;
      const sortOrder = body.sort_order ?? body.sortOrder ?? 0;
      const isActive = body.is_active ?? body.isActive ?? true;
      const rawModerators = Array.isArray(body.moderatorIds)
        ? body.moderatorIds
        : Array.isArray(body.moderator_ids)
          ? body.moderator_ids
          : [];
      const moderatorIds = rawModerators
        .map(id => parseInt(id, 10))
        .filter(id => Number.isInteger(id) && id > 0);

      // 验证必填字段
      if (!name || !displayName) {
        return errorResponse(res, '板块名称和显示名称不能为空', 400);
      }

      // 检查板块名称是否已存在
      const existingBoard = await CommunityBoard.findByName(name);
      if (existingBoard) {
        return errorResponse(res, '板块名称已存在', 400);
      }

      const boardData = {
        name,
        displayName,
        description,
        iconUrl,
        coverImageUrl,
        sortOrder: Number(sortOrder) || 0,
        moderatorIds,
        isActive: Boolean(isActive)
      };

      const newBoard = await CommunityBoard.create(boardData);
      
      return successResponse(res, '创建板块成功', newBoard, 201);
    } catch (error) {
      logger.error('创建板块失败:', error);
      return errorResponse(res, '创建板块失败', 500);
    }
  }

  /**
   * 更新板块
   */
  static async updateBoard(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // 如果更新名称，检查是否冲突
      if (updateData.name) {
        const existingBoard = await CommunityBoard.findByName(updateData.name);
        if (existingBoard && existingBoard.id !== parseInt(id)) {
          return errorResponse(res, '板块名称已存在', 400);
        }
      }

      const updatedBoard = await CommunityBoard.update(parseInt(id), updateData);
      
      if (!updatedBoard) {
        return errorResponse(res, '板块不存在', 404);
      }

      return successResponse(res, '更新板块成功', updatedBoard);
    } catch (error) {
      logger.error('更新板块失败:', error);
      return errorResponse(res, '更新板块失败', 500);
    }
  }

  /**
   * 删除板块
   */
  static async deleteBoard(req, res) {
    try {
      const { id } = req.params;
      
      const success = await CommunityBoard.delete(parseInt(id));
      
      if (!success) {
        return errorResponse(res, '板块不存在', 404);
      }

      return successResponse(res, '删除板块成功');
    } catch (error) {
      logger.error('删除板块失败:', error);
      if (error.message === '该板块下还有帖子，无法删除') {
        return errorResponse(res, error.message, 400);
      }
      return errorResponse(res, '删除板块失败', 500);
    }
  }

  /**
   * 搜索板块
   */
  static async searchBoards(req, res) {
    try {
      const { q: keyword } = req.query;
      
      if (!keyword) {
        return errorResponse(res, '搜索关键词不能为空', 400);
      }

      const boards = await CommunityBoard.search(keyword);
      
      return successResponse(res, '搜索板块成功', boards);
    } catch (error) {
      logger.error('搜索板块失败:', error);
      return errorResponse(res, '搜索板块失败', 500);
    }
  }

  /**
   * 获取板块统计信息
   */
  static async getBoardStats(req, res) {
    try {
      const { id } = req.params;
      
      const stats = await CommunityBoard.getStats(parseInt(id));
      
      if (!stats) {
        return errorResponse(res, '板块不存在', 404);
      }

      return successResponse(res, '获取板块统计成功', stats);
    } catch (error) {
      logger.error('获取板块统计失败:', error);
      return errorResponse(res, '获取板块统计失败', 500);
    }
  }

  /**
   * 批量更新板块排序
   */
  static async batchUpdateSort(req, res) {
    try {
      const { boards } = req.body;
      
      if (!Array.isArray(boards) || boards.length === 0) {
        return errorResponse(res, '排序数据不能为空', 400);
      }

      // 验证数据格式
      for (const board of boards) {
        if (!board.id || typeof board.sortOrder !== 'number') {
          return errorResponse(res, '排序数据格式不正确', 400);
        }
      }

      await CommunityBoard.batchUpdateSort(boards);
      
      return successResponse(res, '批量更新排序成功');
    } catch (error) {
      logger.error('批量更新排序失败:', error);
      return errorResponse(res, '批量更新排序失败', 500);
    }
  }

  /**
   * 添加版主
   */
  static async addModerator(req, res) {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return errorResponse(res, '用户ID不能为空', 400);
      }

      await CommunityBoard.addModerator(parseInt(id), userId);
      
      return successResponse(res, '添加版主成功');
    } catch (error) {
      logger.error('添加版主失败:', error);
      return errorResponse(res, '添加版主失败', 500);
    }
  }

  /**
   * 移除版主
   */
  static async removeModerator(req, res) {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return errorResponse(res, '用户ID不能为空', 400);
      }

      await CommunityBoard.removeModerator(parseInt(id), userId);
      
      return successResponse(res, '移除版主成功');
    } catch (error) {
      logger.error('移除版主失败:', error);
      return errorResponse(res, '移除版主失败', 500);
    }
  }

  /**
   * 批量创建板块
   */
  static async batchCreateBoards(req, res) {
    try {
      const { boards } = req.body;
      
      if (!Array.isArray(boards) || boards.length === 0) {
        return errorResponse(res, '板块数据不能为空', 400);
      }

      const createdBoards = [];
      const errors = [];

      for (const boardData of boards) {
        try {
          // 检查必填字段
          if (!boardData.name || !boardData.displayName) {
            errors.push(`板块 ${boardData.name || '未知'}: 名称和显示名称不能为空`);
            continue;
          }

          // 检查名称是否已存在
          const existingBoard = await CommunityBoard.findByName(boardData.name);
          if (existingBoard) {
            errors.push(`板块 ${boardData.name}: 名称已存在`);
            continue;
          }

          const newBoard = await CommunityBoard.create(boardData);
          createdBoards.push(newBoard);
        } catch (error) {
          errors.push(`板块 ${boardData.name || '未知'}: ${error.message}`);
        }
      }

      const result = {
        created: createdBoards,
        createdCount: createdBoards.length,
        totalCount: boards.length,
        errors
      };

      if (createdBoards.length > 0) {
        return successResponse(res, `成功创建 ${createdBoards.length} 个板块`, result, 201);
      } else {
        return errorResponse(res, '所有板块创建失败', 400, result);
      }
    } catch (error) {
      logger.error('批量创建板块失败:', error);
      return errorResponse(res, '批量创建板块失败', 500);
    }
  }
}

module.exports = CommunityBoardController;
