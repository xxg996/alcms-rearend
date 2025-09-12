/**
 * 用户业务逻辑服务
 * 处理用户相关的所有业务操作
 */

const BaseService = require('./BaseService');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const { checkPasswordStrength } = require('../utils/password');

class UserService extends BaseService {
  constructor() {
    super();
  }

  /**
   * 更新用户资料
   */
  async updateProfile(userId, profileData) {
    return this.withPerformanceMonitoring('updateProfile', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const { nickname, avatar_url, bio } = profileData;
        const updateData = {};

        // 验证昵称
        if (nickname !== undefined) {
          if (nickname.length < 1 || nickname.length > 100) {
            throw new Error('昵称长度必须在1-100个字符之间');
          }
          updateData.nickname = nickname;
        }

        // 验证头像URL
        if (avatar_url !== undefined) {
          if (avatar_url && avatar_url.length > 500) {
            throw new Error('头像URL长度不能超过500个字符');
          }
          updateData.avatar_url = avatar_url;
        }

        // 验证个人简介
        if (bio !== undefined) {
          if (bio && bio.length > 500) {
            throw new Error('个人简介长度不能超过500个字符');
          }
          updateData.bio = bio;
        }

        if (Object.keys(updateData).length === 0) {
          throw new Error('没有提供要更新的数据');
        }

        const updatedUser = await User.updateById(userId, updateData);

        if (!updatedUser) {
          throw new Error('用户不存在');
        }

        // 清除用户相关缓存
        await this.clearCache(`user:${userId}:*`);

        this.log('info', '用户资料更新成功', { 
          userId, 
          updatedFields: Object.keys(updateData) 
        });

        return this.formatSuccessResponse(
          this.sanitizeUserData(updatedUser),
          '用户资料更新成功'
        );

      } catch (error) {
        this.handleError(error, 'updateProfile');
      }
    });
  }

  /**
   * 修改密码
   */
  async changePassword(userId, passwordData) {
    return this.withPerformanceMonitoring('changePassword', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);
        this.validateRequired(passwordData, ['currentPassword', 'newPassword']);

        const { currentPassword, newPassword } = passwordData;

        // 获取用户信息
        const user = await User.findById(userId);
        if (!user) {
          throw new Error('用户不存在');
        }

        // 验证当前密码
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
          throw new Error('当前密码错误');
        }

        // 检查新密码强度
        if (!checkPasswordStrength(newPassword).isValid) {
          throw new Error('新密码强度不足，请使用包含大小写字母、数字的8位以上密码');
        }

        // 检查新密码是否与当前密码相同
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
          throw new Error('新密码不能与当前密码相同');
        }

        // 加密新密码
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 更新密码
        await User.updateById(userId, { 
          password: hashedPassword,
          password_updated_at: new Date()
        });

        this.log('info', '用户密码修改成功', { userId });

        return this.formatSuccessResponse(null, '密码修改成功');

      } catch (error) {
        this.handleError(error, 'changePassword');
      }
    });
  }

  /**
   * 获取用户资料
   */
  async getProfile(userId) {
    return this.withPerformanceMonitoring('getProfile', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const cacheKey = `user:${userId}:profile`;
        
        return await this.getCached(cacheKey, async () => {
          const user = await User.findById(userId);
          
          if (!user) {
            throw new Error('用户不存在');
          }

          return this.formatSuccessResponse(
            this.sanitizeUserData(user),
            '获取用户资料成功'
          );
        }, 600); // 缓存10分钟

      } catch (error) {
        this.handleError(error, 'getProfile');
      }
    });
  }

  /**
   * 获取用户列表
   */
  async getUserList(filters = {}, pagination = {}) {
    return this.withPerformanceMonitoring('getUserList', async () => {
      try {
        const { page, limit, offset } = this.normalizePaginationParams(
          pagination.page,
          pagination.limit
        );

        const { role, status, search } = filters;

        // 构建过滤条件
        const filterOptions = {
          role,
          status,
          search,
          limit,
          offset
        };

        // 获取用户列表和总数
        const [users, totalCount] = await Promise.all([
          User.findByFilters(filterOptions),
          User.countByFilters({ role, status, search })
        ]);

        // 脱敏处理
        const sanitizedUsers = users.map(user => this.sanitizeUserData(user));

        return this.formatPaginatedResponse(
          sanitizedUsers,
          { page, limit },
          totalCount
        );

      } catch (error) {
        this.handleError(error, 'getUserList');
      }
    });
  }

  /**
   * 更新用户状态
   */
  async updateUserStatus(adminUserId, targetUserId, newStatus) {
    return this.withPerformanceMonitoring('updateUserStatus', async () => {
      try {
        this.validateRequired({ adminUserId, targetUserId, newStatus }, 
          ['adminUserId', 'targetUserId', 'newStatus']);

        // 验证状态值
        const validStatuses = ['active', 'inactive', 'banned'];
        if (!validStatuses.includes(newStatus)) {
          throw new Error(`无效的状态值，必须是: ${validStatuses.join(', ')}`);
        }

        // 不能修改自己的状态
        if (adminUserId === targetUserId) {
          throw new Error('不能修改自己的账户状态');
        }

        const updatedUser = await User.updateById(targetUserId, {
          status: newStatus,
          updated_at: new Date()
        });

        if (!updatedUser) {
          throw new Error('目标用户不存在');
        }

        // 清除用户缓存
        await this.clearCache(`user:${targetUserId}:*`);

        this.log('info', '用户状态更新成功', { 
          adminUserId, 
          targetUserId, 
          newStatus 
        });

        return this.formatSuccessResponse(
          this.sanitizeUserData(updatedUser),
          `用户状态已更新为: ${newStatus}`
        );

      } catch (error) {
        this.handleError(error, 'updateUserStatus');
      }
    });
  }

  /**
   * 用户数据脱敏
   */
  sanitizeUserData(user) {
    if (!user) return null;

    const sanitized = { ...user };
    delete sanitized.password;
    delete sanitized.password_updated_at;
    
    return sanitized;
  }

  /**
   * 验证用户权限
   */
  async checkUserPermission(userId, permission) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      return this.checkPermission(user, permission);
    } catch (error) {
      this.handleError(error, 'checkUserPermission');
    }
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats() {
    return this.withPerformanceMonitoring('getUserStats', async () => {
      try {
        const cacheKey = 'user:stats';

        return await this.getCached(cacheKey, async () => {
          const stats = await User.getStats();
          
          return this.formatSuccessResponse(stats, '获取用户统计成功');
        }, 300); // 缓存5分钟

      } catch (error) {
        this.handleError(error, 'getUserStats');
      }
    });
  }
}

module.exports = new UserService();