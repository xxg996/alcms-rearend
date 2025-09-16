/**
 * 管理员签到管理路由
 * 处理管理员对签到系统的管理操作
 */

const express = require('express');
const router = express.Router();
const checkinController = require('../../controllers/checkinController');
const {
  authenticateToken,
  requirePermission
} = require('../../middleware/auth');

// 签到配置管理
// 获取所有签到配置
router.get('/configs',
  authenticateToken,
  requirePermission('checkin.config.read'),
  checkinController.getAllConfigs
);

// 创建签到配置
router.post('/configs',
  authenticateToken,
  requirePermission('checkin.config.create'),
  checkinController.createConfig
);

// 更新签到配置
router.put('/configs/:configId',
  authenticateToken,
  requirePermission('checkin.config.update'),
  checkinController.updateConfig
);

// 用户签到管理
// 获取用户签到信息
router.get('/users/:userId/info',
  authenticateToken,
  requirePermission('checkin.read'),
  checkinController.getUserCheckinInfo
);

// 获取用户签到历史
router.get('/users/:userId/history',
  authenticateToken,
  requirePermission('checkin.read'),
  checkinController.getUserCheckinHistory
);

// 补签功能
router.post('/users/:userId/makeup',
  authenticateToken,
  requirePermission('checkin.makeup'),
  checkinController.makeupCheckin
);

// 重置用户签到数据
router.delete('/users/:userId/reset',
  authenticateToken,
  requirePermission('checkin.reset'),
  checkinController.resetUserCheckins
);

// 签到统计
// 获取签到统计
router.get('/statistics',
  authenticateToken,
  requirePermission('checkin.statistics'),
  checkinController.getCheckinStatistics
);

module.exports = router;