/**
 * 输入验证中间件
 * 使用 express-validator 进行数据验证
 */

const { body } = require('express-validator');

/**
 * 用户创建验证规则
 */
const createUserValidation = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('用户名长度必须在3-50个字符之间')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('用户名只能包含字母、数字和下划线'),
  
  body('email')
    .isEmail()
    .withMessage('请输入有效的邮箱地址')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('密码长度必须在8-128个字符之间'),
  
  body('nickname')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('昵称长度必须在1-100个字符之间'),
  
  body('roleName')
    .optional()
    .isIn(['user', 'vip', 'moderator', 'admin'])
    .withMessage('无效的角色名称'),
  
  body('status')
    .optional()
    .isIn(['normal', 'banned', 'frozen'])
    .withMessage('无效的用户状态')
];

/**
 * 用户状态更新验证规则
 */
const updateUserStatusValidation = [
  body('status')
    .isIn(['normal', 'banned', 'frozen'])
    .withMessage('无效的用户状态'),
  
  body('reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('原因不能超过500个字符')
];

/**
 * 角色分配验证规则
 */
const assignRoleValidation = [
  body('roleName')
    .isIn(['user', 'vip', 'moderator', 'admin'])
    .withMessage('无效的角色名称')
];

/**
 * 用户资料更新验证规则
 */
const updateProfileValidation = [
  body('nickname')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('昵称长度必须在1-100个字符之间'),
  
  body('avatar_url')
    .optional()
    .isURL()
    .withMessage('头像URL格式无效')
    .isLength({ max: 500 })
    .withMessage('头像URL长度不能超过500个字符'),
  
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('个人简介长度不能超过500个字符')
];

/**
 * 冻结/解冻用户验证规则
 */
const freezeUserValidation = [
  body('reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('原因不能超过500个字符')
];

module.exports = {
  createUserValidation,
  updateUserStatusValidation,
  assignRoleValidation,
  updateProfileValidation,
  freezeUserValidation
};