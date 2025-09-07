/**
 * 社区板块控制器
 * 处理板块的CRUD操作和管理功能
 */

const CommunityBoard = require('../models/CommunityBoard');
const { successResponse, errorResponse } = require('../utils/responseHelper');

class CommunityBoardController {
  /**
   * 获取板块列表
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
      console.error('获取板块列表失败:', error);
      return errorResponse(res, '获取板块列表失败', 500);
    }
  }

  /**
   * 获取板块详情
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
      console.error('获取板块详情失败:', error);
      return errorResponse(res, '获取板块详情失败', 500);
    }
  }

  /**
   * 创建板块
   */
  static async createBoard(req, res) {
    try {
      const {
        name,
        displayName,
        description,
        iconUrl,
        coverImageUrl,
        sortOrder,
        moderatorIds
      } = req.body;

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
        sortOrder,
        moderatorIds: moderatorIds || []
      };

      const newBoard = await CommunityBoard.create(boardData);
      
      return successResponse(res, '创建板块成功', newBoard, 201);
    } catch (error) {
      console.error('创建板块失败:', error);
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
      console.error('更新板块失败:', error);
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
      console.error('删除板块失败:', error);
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
      console.error('搜索板块失败:', error);
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
      console.error('获取板块统计失败:', error);
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
      console.error('批量更新排序失败:', error);
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
      console.error('添加版主失败:', error);
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
      console.error('移除版主失败:', error);
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
      console.error('批量创建板块失败:', error);
      return errorResponse(res, '批量创建板块失败', 500);
    }
  }
}

module.exports = CommunityBoardController;
