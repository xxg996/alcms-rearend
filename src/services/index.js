/**
 * Service层统一导出
 * 方便Controller层统一导入和使用
 */

// 基础服务
const BaseService = require('./BaseService');
const AuthService = require('./AuthService');
const UserService = require('./UserService');
const ResourceService = require('./ResourceService');

// 业务服务
const CardKeyService = require('./CardKeyService');
const CheckinService = require('./CheckinService');
const VipService = require('./VipService');
const CommunityService = require('./CommunityService');
const CategoryService = require('./CategoryService');
const TagService = require('./TagService');
const FavoriteService = require('./FavoriteService');
const PointsService = require('./PointsService');

// 服务工厂
const { ServiceFactory, serviceFactory, getService, initializeServices } = require('./ServiceFactory');

// 初始化服务工厂
initializeServices();

module.exports = {
  // 基础服务
  BaseService,
  AuthService,
  UserService,
  ResourceService,
  
  // 业务服务
  CardKeyService,
  CheckinService,
  VipService,
  CommunityService,
  CategoryService,
  TagService,
  FavoriteService,
  PointsService,
  
  // 服务工厂
  ServiceFactory,
  serviceFactory,
  getService,
  
  // 便捷方法 - 通过服务工厂获取服务实例
  services: {
    get auth() { return getService('AuthService'); },
    get user() { return getService('UserService'); },
    get resource() { return getService('ResourceService'); },
    get cardKey() { return getService('CardKeyService'); },
    get checkin() { return getService('CheckinService'); },
    get vip() { return getService('VipService'); },
    get community() { return getService('CommunityService'); },
    get category() { return getService('CategoryService'); },
    get tag() { return getService('TagService'); },
    get favorite() { return getService('FavoriteService'); },
    get points() { return getService('PointsService'); }
  }
};