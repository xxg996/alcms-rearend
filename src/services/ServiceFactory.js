/**
 * 服务工厂
 * 统一管理和创建所有服务实例，提供依赖注入和服务发现功能
 */

class ServiceFactory {
  constructor() {
    this.services = new Map();
    this.config = new Map();
    this.dependencies = new Map();
    this.initialized = false;
  }

  /**
   * 初始化服务工厂
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    // 注册所有服务
    this.registerServices();
    
    // 设置服务依赖关系
    this.setupDependencies();

    this.initialized = true;
  }

  /**
   * 注册服务
   */
  registerServices() {
    // 基础服务
    this.register('AuthService', () => require('./AuthService'));
    this.register('UserService', () => require('./UserService'));
    this.register('ResourceService', () => require('./ResourceService'));
    this.register('AuditLogService', () => require('./AuditLogService'));
    
    // 业务服务
    this.register('CardKeyService', () => require('./CardKeyService'));
    this.register('CheckinService', () => require('./CheckinService'));
    this.register('VipService', () => require('./VipService'));
    this.register('ReferralService', () => require('./ReferralService'));
    this.register('CommunityService', () => require('./CommunityService'));
    this.register('CategoryService', () => require('./CategoryService'));
    this.register('TagService', () => require('./TagService'));
    this.register('FavoriteService', () => require('./FavoriteService'));
    this.register('PointsService', () => require('./PointsService'));
  }

  /**
   * 设置服务依赖关系
   */
  setupDependencies() {
    // 设置服务间依赖关系
    this.dependencies.set('AuthService', ['UserService']);
    this.dependencies.set('ResourceService', ['CategoryService', 'TagService']);
    this.dependencies.set('CheckinService', ['PointsService', 'VipService']);
    this.dependencies.set('CardKeyService', ['PointsService', 'VipService']);
    this.dependencies.set('CommunityService', ['UserService']);
    this.dependencies.set('FavoriteService', ['ResourceService']);
  }

  /**
   * 注册服务
   */
  register(name, factory, config = {}) {
    this.services.set(name, {
      factory,
      instance: null,
      config,
      singleton: config.singleton !== false // 默认单例
    });
  }

  /**
   * 获取服务实例
   */
  get(serviceName) {
    if (!this.services.has(serviceName)) {
      throw new Error(`服务未找到: ${serviceName}`);
    }

    const service = this.services.get(serviceName);
    
    if (service.singleton && service.instance) {
      return service.instance;
    }

    // 解决依赖
    this.resolveDependencies(serviceName);

    // 创建实例
    const instance = service.factory();
    
    if (service.singleton) {
      service.instance = instance;
    }

    return instance;
  }

  /**
   * 解决服务依赖
   */
  resolveDependencies(serviceName) {
    const deps = this.dependencies.get(serviceName) || [];
    
    for (const dep of deps) {
      if (!this.services.has(dep)) {
        throw new Error(`依赖服务未找到: ${dep} (required by ${serviceName})`);
      }
      
      // 递归解决依赖
      this.get(dep);
    }
  }

  /**
   * 获取所有已注册的服务名称
   */
  getServiceNames() {
    return Array.from(this.services.keys());
  }

  /**
   * 检查服务是否已注册
   */
  has(serviceName) {
    return this.services.has(serviceName);
  }

  /**
   * 设置服务配置
   */
  setConfig(serviceName, config) {
    if (!this.services.has(serviceName)) {
      throw new Error(`服务未找到: ${serviceName}`);
    }

    const service = this.services.get(serviceName);
    service.config = { ...service.config, ...config };
  }

  /**
   * 获取服务配置
   */
  getConfig(serviceName) {
    if (!this.services.has(serviceName)) {
      throw new Error(`服务未找到: ${serviceName}`);
    }

    return this.services.get(serviceName).config;
  }

  /**
   * 创建服务代理
   * 提供中间件支持，如缓存、日志、性能监控等
   */
  createProxy(serviceName, middlewares = []) {
    const originalService = this.get(serviceName);
    
    return new Proxy(originalService, {
      get(target, prop, receiver) {
        const originalMethod = Reflect.get(target, prop, receiver);
        
        if (typeof originalMethod === 'function') {
          return function (...args) {
            // 执行前置中间件
            for (const middleware of middlewares) {
              if (middleware.before) {
                middleware.before(serviceName, prop, args);
              }
            }

            try {
              const result = originalMethod.apply(target, args);
              
              // 如果是Promise，添加后置处理
              if (result && typeof result.then === 'function') {
                return result.then(res => {
                  // 执行后置中间件
                  for (const middleware of middlewares) {
                    if (middleware.after) {
                      middleware.after(serviceName, prop, args, res);
                    }
                  }
                  return res;
                }).catch(err => {
                  // 执行错误中间件
                  for (const middleware of middlewares) {
                    if (middleware.error) {
                      middleware.error(serviceName, prop, args, err);
                    }
                  }
                  throw err;
                });
              }

              // 执行后置中间件
              for (const middleware of middlewares) {
                if (middleware.after) {
                  middleware.after(serviceName, prop, args, result);
                }
              }

              return result;
            } catch (error) {
              // 执行错误中间件
              for (const middleware of middlewares) {
                if (middleware.error) {
                  middleware.error(serviceName, prop, args, error);
                }
              }
              throw error;
            }
          };
        }

        return originalMethod;
      }
    });
  }

  /**
   * 预热服务
   * 提前初始化关键服务以提高首次调用性能
   */
  warmup(serviceNames = []) {
    const servicesToWarmup = serviceNames.length > 0 ? serviceNames : this.getServiceNames();
    
    for (const serviceName of servicesToWarmup) {
      try {
        this.get(serviceName);
      } catch (error) {
        console.warn(`服务预热失败: ${serviceName}`, error.message);
      }
    }
  }

  /**
   * 清理服务实例
   */
  cleanup() {
    for (const [name, service] of this.services) {
      if (service.instance && typeof service.instance.cleanup === 'function') {
        try {
          service.instance.cleanup();
        } catch (error) {
          console.warn(`服务清理失败: ${name}`, error.message);
        }
      }
      service.instance = null;
    }
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    const status = {};
    
    for (const [name, service] of this.services) {
      status[name] = {
        registered: true,
        instantiated: !!service.instance,
        singleton: service.singleton,
        dependencies: this.dependencies.get(name) || []
      };
    }

    return status;
  }

  /**
   * 验证服务依赖
   */
  validateDependencies() {
    const errors = [];
    
    for (const [serviceName, deps] of this.dependencies) {
      for (const dep of deps) {
        if (!this.services.has(dep)) {
          errors.push(`${serviceName} 依赖的服务 ${dep} 未注册`);
        }
      }
    }

    // 检查循环依赖
    const visited = new Set();
    const visiting = new Set();

    const checkCyclicDependency = (serviceName) => {
      if (visiting.has(serviceName)) {
        errors.push(`检测到循环依赖: ${serviceName}`);
        return;
      }

      if (visited.has(serviceName)) {
        return;
      }

      visiting.add(serviceName);
      const deps = this.dependencies.get(serviceName) || [];
      
      for (const dep of deps) {
        checkCyclicDependency(dep);
      }

      visiting.delete(serviceName);
      visited.add(serviceName);
    };

    for (const serviceName of this.services.keys()) {
      checkCyclicDependency(serviceName);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 重置工厂
   */
  reset() {
    this.cleanup();
    this.services.clear();
    this.config.clear();
    this.dependencies.clear();
    this.initialized = false;
  }
}

// 创建全局服务工厂实例
const serviceFactory = new ServiceFactory();

// 导出服务工厂和便捷方法
module.exports = {
  ServiceFactory,
  serviceFactory,
  
  // 便捷方法
  getService: (name) => serviceFactory.get(name),
  registerService: (name, factory, config) => serviceFactory.register(name, factory, config),
  initializeServices: () => serviceFactory.initialize(),
  
  // 中间件
  middlewares: {
    // 日志中间件
    logger: {
      before: (serviceName, methodName, args) => {
        console.log(`[Service] ${serviceName}.${methodName} 调用开始`);
      },
      after: (serviceName, methodName, args, result) => {
        console.log(`[Service] ${serviceName}.${methodName} 调用成功`);
      },
      error: (serviceName, methodName, args, error) => {
        console.error(`[Service] ${serviceName}.${methodName} 调用失败:`, error.message);
      }
    },

    // 性能监控中间件
    performance: {
      before: (serviceName, methodName, args) => {
        const key = `${serviceName}.${methodName}`;
        console.time(key);
      },
      after: (serviceName, methodName, args, result) => {
        const key = `${serviceName}.${methodName}`;
        console.timeEnd(key);
      }
    },

    // 缓存中间件
    cache: {
      // 这里可以实现方法级别的缓存逻辑
      before: (serviceName, methodName, args) => {
        // 检查缓存
      },
      after: (serviceName, methodName, args, result) => {
        // 设置缓存
      }
    }
  }
};
