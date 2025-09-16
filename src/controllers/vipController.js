/**
 * VIP系统控制器
 * 处理VIP等级管理、用户VIP操作等
 * 
 * @swagger
 * tags:
 *   - name: VIP
 *     description: VIP系统管理相关接口
 */

const VIP = require('../models/VIP');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/vip/levels:
 *   get:
 *     tags: [VIP]
 *     summary: 获取所有VIP等级配置
 *     description: 获取系统中所有可用的VIP等级配置信息
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 获取VIP等级成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/VIPLevel'
 *             example:
 *               success: true
 *               message: "VIP等级获取成功"
 *               data:
 *                 - level: 1
 *                   name: "vip1"
 *                   display_name: "VIP会员"
 *                   description: "享受基础VIP权益"
 *                   benefits:
 *                     download_limit: 100
 *                     ad_free: true
 *                   price: 19.99
 *                   duration_days: 30
 *                   is_active: true
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getAllLevels = async (req, res) => {
  try {
    const levels = await VIP.getAllLevels();
    
    res.json({
      success: true,
      message: 'VIP等级获取成功',
      data: levels
    });
  } catch (error) {
    logger.error('获取VIP等级失败:', error);
    res.status(500).json({
      success: false,
      message: '获取VIP等级失败'
    });
  }
};

/**
 * @swagger
 * /api/vip/levels/{level}:
 *   get:
 *     tags: [VIP]
 *     summary: 获取指定VIP等级配置
 *     description: 获取指定等级的VIP配置详情（公开接口）
 *     parameters:
 *       - in: path
 *         name: level
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: VIP等级
 *         example: 1
 *     responses:
 *       200:
 *         description: VIP等级获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/VIPLevel'
 *             example:
 *               success: true
 *               message: "VIP等级获取成功"
 *               data:
 *                 id: 1
 *                 level: 1
 *                 name: "vip1"
 *                 display_name: "VIP会员"
 *                 description: "享受基础VIP权益"
 *                 benefits:
 *                   download_limit: 100
 *                   ad_free: true
 *                   priority_support: false
 *                 price: "19.99"
 *                 duration_days: 30
 *                 is_active: true
 *                 created_at: "2025-09-13T17:27:05.489Z"
 *                 updated_at: "2025-09-13T17:27:05.489Z"
 *       404:
 *         description: VIP等级不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "VIP等级不存在"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getLevelById = async (req, res) => {
  try {
    const { level } = req.params;
    const vipLevel = await VIP.getLevelById(parseInt(level));
    
    if (!vipLevel) {
      return res.status(404).json({
        success: false,
        message: 'VIP等级不存在'
      });
    }
    
    res.json({
      success: true,
      message: 'VIP等级获取成功',
      data: vipLevel
    });
  } catch (error) {
    logger.error('获取VIP等级失败:', error);
    res.status(500).json({
      success: false,
      message: '获取VIP等级失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/vip/levels:
 *   post:
 *     tags: [VIP]
 *     summary: 创建VIP等级配置
 *     description: 管理员创建新的VIP等级配置（仅限管理员）
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateVIPLevelRequest'
 *           example:
 *             level: 2
 *             name: "vip2"
 *             display_name: "高级VIP"
 *             description: "享受高级VIP权益，包括更多下载次数和优先客服"
 *             benefits:
 *               download_limit: 500
 *               ad_free: true
 *               priority_support: true
 *               exclusive_content: true
 *             price: 39.99
 *             duration_days: 90
 *     responses:
 *       201:
 *         description: VIP等级创建成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/VIPLevel'
 *             example:
 *               success: true
 *               message: "VIP等级创建成功"
 *               data:
 *                 id: 2
 *                 level: 2
 *                 name: "vip2"
 *                 display_name: "高级VIP"
 *                 description: "享受高级VIP权益，包括更多下载次数和优先客服"
 *                 benefits:
 *                   download_limit: 500
 *                   ad_free: true
 *                   priority_support: true
 *                   exclusive_content: true
 *                 price: "39.99"
 *                 duration_days: 90
 *                 is_active: true
 *                 created_at: "2025-09-13T17:27:05.489Z"
 *                 updated_at: "2025-09-13T17:27:05.489Z"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missing_fields:
 *                 value:
 *                   success: false
 *                   message: "等级、名称和显示名称为必填字段"
 *               invalid_level:
 *                 value:
 *                   success: false
 *                   message: "VIP等级不能为负数"
 *               level_exists:
 *                 value:
 *                   success: false
 *                   message: "该VIP等级已存在"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const createLevel = async (req, res) => {
  try {
    const {
      level,
      name,
      display_name,
      description,
      benefits,
      price,
      duration_days
    } = req.body;

    // 验证必填字段
    if (!level || !name || !display_name) {
      return res.status(400).json({
        success: false,
        message: '等级、名称和显示名称为必填字段'
      });
    }

    // 验证等级数值
    if (level < 0) {
      return res.status(400).json({
        success: false,
        message: 'VIP等级不能为负数'
      });
    }

    const newLevel = await VIP.createLevel({
      level: parseInt(level),
      name,
      display_name,
      description,
      benefits: benefits || {},
      price: parseFloat(price) || 0,
      duration_days: parseInt(duration_days) || 30
    });
    
    res.status(201).json({
      success: true,
      message: 'VIP等级创建成功',
      data: newLevel
    });
  } catch (error) {
    logger.error('创建VIP等级失败:', error);
    if (error.code === '23505') { // 唯一约束违反
      return res.status(400).json({
        success: false,
        message: '该VIP等级已存在'
      });
    }
    res.status(500).json({
      success: false,
      message: '创建VIP等级失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/vip/levels/{level}:
 *   put:
 *     tags: [VIP]
 *     summary: 更新VIP等级配置
 *     description: 管理员更新指定VIP等级的配置（仅限管理员）
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: level
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: VIP等级
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateVIPLevelRequest'
 *           example:
 *             display_name: "更新的VIP会员"
 *             description: "更新的VIP权益说明"
 *             benefits:
 *               download_limit: 200
 *               ad_free: true
 *               priority_support: true
 *             price: 29.99
 *             duration_days: 60
 *     responses:
 *       200:
 *         description: VIP等级更新成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/VIPLevel'
 *             example:
 *               success: true
 *               message: "VIP等级更新成功"
 *               data:
 *                 id: 1
 *                 level: 1
 *                 name: "vip1"
 *                 display_name: "更新的VIP会员"
 *                 description: "更新的VIP权益说明"
 *                 benefits:
 *                   download_limit: 200
 *                   ad_free: true
 *                   priority_support: true
 *                 price: "29.99"
 *                 duration_days: 60
 *                 is_active: true
 *                 created_at: "2025-09-13T17:27:05.489Z"
 *                 updated_at: "2025-09-13T17:35:12.123Z"
 *       404:
 *         description: VIP等级不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "VIP等级不存在"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const updateLevel = async (req, res) => {
  try {
    const { level } = req.params;
    const updateData = req.body;

    // 移除level字段，防止更新主键
    delete updateData.level;

    const updatedLevel = await VIP.updateLevel(parseInt(level), updateData);
    
    if (!updatedLevel) {
      return res.status(404).json({
        success: false,
        message: 'VIP等级不存在'
      });
    }
    
    res.json({
      success: true,
      message: 'VIP等级更新成功',
      data: updatedLevel
    });
  } catch (error) {
    logger.error('更新VIP等级失败:', error);
    res.status(500).json({
      success: false,
      message: '更新VIP等级失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/vip/levels/{level}:
 *   delete:
 *     tags: [VIP]
 *     summary: 删除VIP等级配置
 *     description: 管理员删除指定VIP等级配置（软删除，仅限管理员）
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: level
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: VIP等级
 *         example: 1
 *     responses:
 *       200:
 *         description: VIP等级删除成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/VIPLevel'
 *             example:
 *               success: true
 *               message: "VIP等级删除成功"
 *               data:
 *                 id: 1
 *                 level: 1
 *                 name: "vip1"
 *                 display_name: "VIP会员"
 *                 is_active: false
 *                 updated_at: "2025-09-13T17:40:15.789Z"
 *       404:
 *         description: VIP等级不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "VIP等级不存在"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const deleteLevel = async (req, res) => {
  try {
    const { level } = req.params;
    const deletedLevel = await VIP.deleteLevel(parseInt(level));
    
    if (!deletedLevel) {
      return res.status(404).json({
        success: false,
        message: 'VIP等级不存在'
      });
    }
    
    res.json({
      success: true,
      message: 'VIP等级删除成功',
      data: deletedLevel
    });
  } catch (error) {
    logger.error('删除VIP等级失败:', error);
    res.status(500).json({
      success: false,
      message: '删除VIP等级失败'
    });
  }
};

/**
 * @swagger
 * /api/vip/my-info:
 *   get:
 *     tags: [VIP]
 *     summary: 获取当前用户VIP信息
 *     description: 获取当前登录用户的VIP状态和详细信息
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: VIP信息获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserVIPInfo'
 *             example:
 *               success: true
 *               message: "VIP信息获取成功"
 *               data:
 *                 user_id: 1
 *                 username: "testuser"
 *                 nickname: "测试用户"
 *                 is_vip: true
 *                 vip_level: 1
 *                 vip_level_name: "vip1"
 *                 vip_level_display_name: "VIP会员"
 *                 vip_start_at: "2025-09-12T00:00:00.000Z"
 *                 vip_expire_at: "2025-10-12T23:59:59.000Z"
 *                 is_expired: false
 *                 is_permanent: false
 *       404:
 *         description: 用户不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "用户不存在"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getMyVIPInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const vipInfo = await VIP.getUserVIPInfo(userId);
    
    if (!vipInfo) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查VIP是否过期
    let isExpired = false;
    if (vipInfo.is_vip && vipInfo.vip_expire_at) {
      isExpired = new Date(vipInfo.vip_expire_at) < new Date();
    }
    
    res.json({
      success: true,
      message: 'VIP信息获取成功',
      data: {
        ...vipInfo,
        is_expired: isExpired,
        is_permanent: vipInfo.is_vip && !vipInfo.vip_expire_at
      }
    });
  } catch (error) {
    logger.error('获取VIP信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取VIP信息失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/vip/users/{userId}/info:
 *   get:
 *     tags: [VIP]
 *     summary: 获取用户VIP信息
 *     description: 管理员获取指定用户的VIP详细信息（仅限管理员）
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 用户ID
 *         example: 123
 *     responses:
 *       200:
 *         description: VIP信息获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserVIPInfo'
 *       404:
 *         description: 用户不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "用户不存在"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getUserVIPInfo = async (req, res) => {
  try {
    const { userId } = req.params;
    const vipInfo = await VIP.getUserVIPInfo(parseInt(userId));
    
    if (!vipInfo) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查VIP是否过期
    let isExpired = false;
    if (vipInfo.is_vip && vipInfo.vip_expire_at) {
      isExpired = new Date(vipInfo.vip_expire_at) < new Date();
    }
    
    res.json({
      success: true,
      message: 'VIP信息获取成功',
      data: {
        ...vipInfo,
        is_expired: isExpired,
        is_permanent: vipInfo.is_vip && !vipInfo.vip_expire_at
      }
    });
  } catch (error) {
    logger.error('获取用户VIP信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户VIP信息失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/vip/users/{userId}/set:
 *   post:
 *     tags: [VIP]
 *     summary: 设置用户VIP
 *     description: 管理员设置指定用户的VIP等级和有效期
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 用户ID
 *         example: 123
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SetUserVIPRequest'
 *           example:
 *             vip_level: 1
 *             days: 30
 *     responses:
 *       200:
 *         description: VIP设置成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user:
 *                           $ref: '#/components/schemas/UserVIPInfo'
 *                         vip_level_info:
 *                           $ref: '#/components/schemas/VIPLevel'
 *             example:
 *               success: true
 *               message: "VIP设置成功"
 *               data:
 *                 user:
 *                   user_id: 123
 *                   is_vip: true
 *                   vip_level: 1
 *                   vip_expire_at: "2025-10-12T23:59:59.000Z"
 *                 vip_level_info:
 *                   level: 1
 *                   name: "vip1"
 *                   display_name: "VIP会员"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalid_level:
 *                 value:
 *                   success: false
 *                   message: "VIP等级必须大于等于0"
 *               level_not_exist:
 *                 value:
 *                   success: false
 *                   message: "VIP等级不存在"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const setUserVIP = async (req, res) => {
  try {
    const { userId } = req.params;
    const { vip_level, days } = req.body;

    if (!vip_level || vip_level < 0) {
      return res.status(400).json({
        success: false,
        message: 'VIP等级必须大于等于0'
      });
    }

    if (days < 0) {
      return res.status(400).json({
        success: false,
        message: 'VIP天数不能为负数'
      });
    }

    // 检查VIP等级是否存在
    const levelConfig = await VIP.getLevelById(vip_level);
    if (!levelConfig) {
      return res.status(400).json({
        success: false,
        message: 'VIP等级不存在'
      });
    }

    const result = await VIP.setUserVIP(parseInt(userId), vip_level, days || 30);
    
    res.json({
      success: true,
      message: 'VIP设置成功',
      data: {
        user: result,
        vip_level_info: levelConfig
      }
    });
  } catch (error) {
    logger.error('设置用户VIP失败:', error);
    res.status(500).json({
      success: false,
      message: '设置用户VIP失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/vip/users/{userId}/extend:
 *   post:
 *     tags: [VIP]
 *     summary: 延长用户VIP时间
 *     description: 管理员延长指定用户的VIP有效期（仅限管理员）
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 用户ID
 *         example: 123
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExtendVIPRequest'
 *           example:
 *             days: 30
 *     responses:
 *       200:
 *         description: VIP延长成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserVIPInfo'
 *             example:
 *               success: true
 *               message: "VIP延长成功"
 *               data:
 *                 id: 123
 *                 is_vip: true
 *                 vip_level: 1
 *                 vip_expire_at: "2025-11-12T23:59:59.000Z"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "VIP天数不能为负数"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const extendUserVIP = async (req, res) => {
  try {
    const { userId } = req.params;
    const { days } = req.body;

    if (days < 0) {
      return res.status(400).json({
        success: false,
        message: 'VIP天数不能为负数'
      });
    }

    const result = await VIP.extendUserVIP(parseInt(userId), days || 30);
    
    res.json({
      success: true,
      message: days === 0 ? 'VIP设置为永久成功' : 'VIP延长成功',
      data: result
    });
  } catch (error) {
    logger.error('延长用户VIP失败:', error);
    res.status(500).json({
      success: false,
      message: '延长用户VIP失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/vip/users/{userId}/cancel:
 *   delete:
 *     tags: [VIP]
 *     summary: 取消用户VIP
 *     description: 管理员取消指定用户的VIP资格（仅限管理员）
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 用户ID
 *         example: 123
 *     responses:
 *       200:
 *         description: VIP取消成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserVIPInfo'
 *             example:
 *               success: true
 *               message: "VIP取消成功"
 *               data:
 *                 id: 123
 *                 username: "testuser"
 *                 is_vip: false
 *                 vip_level: 0
 *                 vip_expire_at: null
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const cancelUserVIP = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await VIP.cancelUserVIP(parseInt(userId));
    
    res.json({
      success: true,
      message: 'VIP取消成功',
      data: result
    });
  } catch (error) {
    logger.error('取消用户VIP失败:', error);
    res.status(500).json({
      success: false,
      message: '取消用户VIP失败'
    });
  }
};

/**
 * @swagger
 * /api/vip/my-orders:
 *   get:
 *     tags: [VIP]
 *     summary: 获取用户订单历史
 *     description: 获取当前用户的VIP订单历史记录
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *         description: 返回数量限制
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 偏移量
 *     responses:
 *       200:
 *         description: 订单历史获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VIPOrderListResponse'
 *             example:
 *               success: true
 *               message: "订单历史获取成功"
 *               data:
 *                 - id: 1001
 *                   order_number: "VIP202509120001"
 *                   vip_level: 1
 *                   vip_level_name: "vip1"
 *                   duration_days: 30
 *                   amount: 19.99
 *                   status: "paid"
 *                   payment_method: "alipay"
 *                   created_at: "2025-09-12T10:00:00.000Z"
 *                   paid_at: "2025-09-12T10:05:00.000Z"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10, offset = 0 } = req.query;
    
    const orders = await VIP.getUserOrders(userId, parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      message: '订单历史获取成功',
      data: orders
    });
  } catch (error) {
    logger.error('获取订单历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取订单历史失败'
    });
  }
};

/**
 * @swagger
 * /api/vip/orders/{orderId}:
 *   get:
 *     tags: [VIP]
 *     summary: 获取订单详情
 *     description: 获取指定VIP订单的详细信息（订单所有者或管理员可访问）
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 订单ID
 *         example: 1001
 *     responses:
 *       200:
 *         description: 订单详情获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/VIPOrder'
 *             example:
 *               success: true
 *               message: "订单详情获取成功"
 *               data:
 *                 id: 1001
 *                 user_id: 123
 *                 username: "testuser"
 *                 email: "test@example.com"
 *                 order_number: "VIP202509120001"
 *                 vip_level: 1
 *                 vip_level_name: "vip1"
 *                 vip_level_display_name: "VIP会员"
 *                 duration_days: 30
 *                 amount: "19.99"
 *                 status: "paid"
 *                 payment_method: "alipay"
 *                 payment_transaction_id: "2025091200001001"
 *                 created_at: "2025-09-12T10:00:00.000Z"
 *                 paid_at: "2025-09-12T10:05:00.000Z"
 *       403:
 *         description: 无权查看此订单
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "无权查看此订单"
 *       404:
 *         description: 订单不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "订单不存在"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await VIP.getOrderById(parseInt(orderId));
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }

    // 检查权限：只有订单所有者或管理员才能查看
    const isOwner = order.user_id === req.user.id;
    const isAdmin = req.user.roles?.some(role => ['admin', 'super_admin'].includes(role.name));
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: '无权查看此订单'
      });
    }
    
    res.json({
      success: true,
      message: '订单详情获取成功',
      data: order
    });
  } catch (error) {
    logger.error('获取订单详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取订单详情失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/vip/system/update-expired:
 *   post:
 *     tags: [VIP]
 *     summary: 更新过期VIP用户
 *     description: 系统定时任务，批量更新所有过期的VIP用户状态（仅限管理员）
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 过期VIP用户更新成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             description: 用户ID
 *                           username:
 *                             type: string
 *                             description: 用户名
 *                           vip_expire_at:
 *                             type: string
 *                             format: date-time
 *                             description: VIP过期时间
 *             example:
 *               success: true
 *               message: "成功更新3个过期VIP用户"
 *               data:
 *                 - id: 101
 *                   username: "user1"
 *                   vip_expire_at: "2025-09-10T23:59:59.000Z"
 *                 - id: 102
 *                   username: "user2"
 *                   vip_expire_at: "2025-09-11T23:59:59.000Z"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const updateExpiredVIP = async (req, res) => {
  try {
    const expiredUsers = await VIP.updateExpiredVIP();
    
    res.json({
      success: true,
      message: `成功更新${expiredUsers.length}个过期VIP用户`,
      data: expiredUsers
    });
  } catch (error) {
    logger.error('更新过期VIP失败:', error);
    res.status(500).json({
      success: false,
      message: '更新过期VIP失败'
    });
  }
};

module.exports = {
  getAllLevels,
  getLevelById,
  createLevel,
  updateLevel,
  deleteLevel,
  getMyVIPInfo,
  getUserVIPInfo,
  setUserVIP,
  extendUserVIP,
  cancelUserVIP,
  getMyOrders,
  getOrderById,
  updateExpiredVIP
};
