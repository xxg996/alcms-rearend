/**
 * Service层统一导出
 * 方便Controller层统一导入和使用
 */

const AuthService = require('./AuthService');
const UserService = require('./UserService');
const ResourceService = require('./ResourceService');

module.exports = {
  AuthService,
  UserService,
  ResourceService
};