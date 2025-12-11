/**
 * 用户业务逻辑服务
 * 处理用户相关的所有业务操作
 */

const BaseService = require('./BaseService');
const User = require('../models/User');
const VerificationCode = require('../models/VerificationCode');
const { checkPasswordStrength, hashPassword, verifyPassword } = require('../utils/password');

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

        const { nickname, avatar_url, bio, email, ...rest } = profileData;

        if (email !== undefined) {
          throw new Error('请通过专用接口修改邮箱');
        }

        if (Object.keys(rest).length > 0) {
          this.log('warn', '忽略未支持的资料字段', { userId, restKeys: Object.keys(rest) });
        }
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

        const passwordRecord = await User.getPasswordHashById(userId);
        const passwordHash = passwordRecord?.password_hash || null;
        if (!passwordHash) {
          throw new Error('该账户未设置密码，请联系管理员');
        }

        // 验证当前密码
        const isCurrentPasswordValid = await verifyPassword(currentPassword, passwordHash);
        if (!isCurrentPasswordValid) {
          throw new Error('当前密码错误');
        }

        // 检查新密码强度
        if (!checkPasswordStrength(newPassword).isValid) {
          throw new Error('新密码强度不足，请使用包含大小写字母、数字的8位以上密码');
        }

        // 检查新密码是否与当前密码相同
        const isSamePassword = await verifyPassword(newPassword, passwordHash);
        if (isSamePassword) {
          throw new Error('新密码不能与当前密码相同');
        }

        // 加密新密码
        const hashedPassword = await hashPassword(newPassword);

        // 更新密码
        await User.updateById(userId, { 
          password_hash: hashedPassword,
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
   * 修改邮箱
   */
  async changeEmail(userId, emailData) {
    return this.withPerformanceMonitoring('changeEmail', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);
        this.validateRequired(emailData, ['email', 'verificationCode']);

        const rawEmail = emailData.email;
        const verificationCode = emailData.verificationCode;
        if (typeof rawEmail !== 'string') {
          throw new Error('邮箱格式不正确');
        }

        const trimmedEmail = rawEmail.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
          throw new Error('邮箱格式不正确');
        }

        const normalizedEmail = trimmedEmail.toLowerCase();

        const verifyResult = await VerificationCode.verify(normalizedEmail, verificationCode, 'change_email');
        if (!verifyResult?.valid) {
          throw new Error(verifyResult?.reason || '验证码无效或已过期');
        }

        const currentUser = await User.findById(userId);
        if (!currentUser) {
          throw new Error('用户不存在');
        }

        if (currentUser.email && currentUser.email.toLowerCase() === normalizedEmail) {
          throw new Error('新邮箱不能与当前邮箱相同');
        }

        const existingUser = await User.findByEmailExcludeId(normalizedEmail, userId);
        if (existingUser) {
          throw new Error('邮箱已存在');
        }

        const updatedUser = await User.updateById(userId, {
          email: normalizedEmail,
          email_verified: true,
          email_verified_at: new Date(),
          email_verification_token: null,
          email_verification_sent_at: null
        });

        await this.clearCache(`user:${userId}:*`);

        this.log('info', '用户邮箱更新成功', {
          userId,
          email: normalizedEmail
        });

        return this.formatSuccessResponse(
          this.sanitizeUserData(updatedUser),
          '邮箱更新成功'
        );
      } catch (error) {
        this.handleError(error, 'changeEmail');
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

        const user = await User.findById(userId);
        
        if (!user) {
          throw new Error('用户不存在');
        }

        const [followerCount, followingCount] = await Promise.all([
          User.getFollowerCount(userId),
          User.getFollowingCount(userId)
        ]);

        const sanitizedUser = this.sanitizeUserData(user);
        sanitizedUser.follower_count = followerCount;
        sanitizedUser.following_count = followingCount;

        return this.formatSuccessResponse(
          sanitizedUser,
          '获取用户资料成功'
        );

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

        const { role, status, search, vip_status } = filters;

        // 构建过滤条件
        const filterOptions = {
          role,
          status,
          search,
          vip_status,
          limit,
          offset
        };

        // 获取用户列表和总数
        const [users, totalCount] = await Promise.all([
          User.findByFilters(filterOptions),
          User.countByFilters({ role, status, search, vip_status })
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

        // 验证状态值（直接使用数据库状态值）
        const validStatuses = ['normal', 'frozen', 'banned'];
        if (!validStatuses.includes(newStatus)) {
          throw new Error(`无效的状态值，必须是: ${validStatuses.join(', ')}`);
        }

        // 不能修改自己的状态
        if (adminUserId === targetUserId) {
          throw new Error('不能修改自己的账户状态');
        }

        const updatedUser = await User.updateById(targetUserId, {
          status: newStatus
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

    // 删除敏感和内部字段
    delete sanitized.password;
    delete sanitized.password_hash;
    delete sanitized.password_updated_at;

    // 删除冗余的下载相关字段，统一到download_stats中
    delete sanitized.daily_download_limit;
    delete sanitized.daily_downloads_used;
    delete sanitized.last_download_reset_date;
    delete sanitized.actual_daily_limit;
    delete sanitized.today_consumed;
    delete sanitized.referral_code;
    delete sanitized.inviter_id;
    delete sanitized.invited_at;
    delete sanitized.commission_balance;
    delete sanitized.total_commission_earned;

    // 计算今日剩余下载次数
    if (user.actual_daily_limit !== undefined && user.today_consumed !== undefined) {
      const actualLimit = Number.isFinite(Number(user.actual_daily_limit))
        ? Number(user.actual_daily_limit)
        : 0;
      const todayConsumed = Number.isFinite(Number(user.today_consumed))
        ? Number(user.today_consumed)
        : 0;

      sanitized.download_stats = {
        daily_limit: actualLimit,
        today_consumed: todayConsumed,
        remaining_downloads: Math.max(0, actualLimit - todayConsumed)
      };
    }

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

  /**
   * 根据ID获取用户信息
   */
  async getUserById(userId) {
    return this.withPerformanceMonitoring('getUserById', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const cacheKey = `user:${userId}:detail`;
        
        return await this.getCached(cacheKey, async () => {
          const user = await User.findById(userId);
          
          if (!user) {
            throw new Error('用户不存在');
          }

          const [roles, followerCount, followingCount] = await Promise.all([
            User.getUserRoles(userId),
            User.getFollowerCount(userId),
            User.getFollowingCount(userId)
          ]);

          const userWithRoles = {
            ...this.sanitizeUserData(user),
            roles,
            follower_count: followerCount,
            following_count: followingCount
          };

          return this.formatSuccessResponse(userWithRoles, '获取用户信息成功');
        }, 300); // 缓存5分钟

      } catch (error) {
        this.handleError(error, 'getUserById');
      }
    });
  }

  /**
   * 创建用户（管理员功能）
   */
  async createUser(adminUserId, userData) {
    return this.withPerformanceMonitoring('createUser', async () => {
      try {
        this.validateRequired({ adminUserId }, ['adminUserId']);
        this.validateRequired(userData, ['username', 'email', 'password']);

        const { username, email, password, nickname, roleName = 'user', status = 'normal' } = userData;

        // 验证管理员权限
        const adminUser = await User.findById(adminUserId);
        if (!adminUser) {
          throw new Error('管理员账户不存在');
        }

        // 创建用户
        const newUser = await User.createByAdmin({
          username,
          email,
          password,
          nickname,
          roleName,
          status
        });

        this.log('info', '管理员创建用户成功', { 
          adminUserId, 
          newUserId: newUser.id,
          username,
          email,
          roleName,
          status
        });

        return this.formatSuccessResponse(
          this.sanitizeUserData(newUser),
          '用户创建成功'
        );

      } catch (error) {
        this.handleError(error, 'createUser');
      }
    });
  }

  /**
   * 删除用户（管理员功能）
   */
  async deleteUser(adminUserId, targetUserId) {
    return this.withPerformanceMonitoring('deleteUser', async () => {
      try {
        this.validateRequired({ adminUserId, targetUserId }, ['adminUserId', 'targetUserId']);

        // 验证管理员权限
        const adminUser = await User.findById(adminUserId);
        if (!adminUser) {
          throw new Error('管理员账户不存在');
        }

        // 不能删除自己
        if (adminUserId === targetUserId) {
          throw new Error('不能删除自己的账户');
        }

        const deletedUser = await User.deleteUser(targetUserId);

        // 清除用户相关缓存
        await this.clearCache(`user:${targetUserId}:*`);

        this.log('info', '管理员删除用户成功', { 
          adminUserId, 
          deletedUserId: targetUserId,
          deletedUsername: deletedUser.username
        });

        return this.formatSuccessResponse(
          { deletedUser: this.sanitizeUserData(deletedUser) },
          '用户删除成功'
        );

      } catch (error) {
        this.handleError(error, 'deleteUser');
      }
    });
  }

  /**
   * 更改用户角色
   */
  async updateUserRoles(adminUserId, targetUserId, addRoles, removeRoles) {
    return this.withPerformanceMonitoring('updateUserRoles', async () => {
      try {
        this.validateRequired({ adminUserId, targetUserId }, 
          ['adminUserId', 'targetUserId']);

        // 验证管理员权限
        const adminUser = await User.findById(adminUserId);
        if (!adminUser) {
          throw new Error('管理员账户不存在');
        }

        // 验证目标用户存在
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
          throw new Error('目标用户不存在');
        }

        const addedRoles = [];
        const removedRoles = [];
        const errors = [];

        // 处理添加角色
        if (addRoles && addRoles.length > 0) {
          for (const roleName of addRoles) {
            try {
              await User.assignRole(targetUserId, roleName);
              addedRoles.push(roleName);
            } catch (error) {
              errors.push(`添加角色 ${roleName} 失败: ${error.message}`);
            }
          }
        }

        // 处理移除角色
        if (removeRoles && removeRoles.length > 0) {
          for (const roleName of removeRoles) {
            try {
              await User.removeRole(targetUserId, roleName);
              removedRoles.push(roleName);
            } catch (error) {
              errors.push(`移除角色 ${roleName} 失败: ${error.message}`);
            }
          }
        }

        // 获取用户当前角色
        const currentRoles = await User.getUserRoles(targetUserId);

        // 清除用户相关缓存
        await this.clearCache(`user:${targetUserId}:*`);

        this.log('info', '更改用户角色完成', { 
          adminUserId, 
          targetUserId, 
          addedRoles,
          removedRoles,
          errors: errors.length > 0 ? errors : undefined
        });

        const message = errors.length > 0 
          ? `角色更改部分成功，${errors.length}个操作失败` 
          : '角色更改成功';

        return this.formatSuccessResponse({
          addedRoles,
          removedRoles,
          currentRoles: currentRoles.map(role => role.name),
          errors: errors.length > 0 ? errors : undefined
        }, message);

      } catch (error) {
        this.handleError(error, 'updateUserRoles');
      }
    });
  }

  /**
   * 获取用户角色列表
   */
  async getUserRoles(userId) {
    return this.withPerformanceMonitoring('getUserRoles', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const cacheKey = `user:${userId}:roles`;
        
        return await this.getCached(cacheKey, async () => {
          // 验证用户存在
          const user = await User.findById(userId);
          if (!user) {
            throw new Error('用户不存在');
          }

          const roles = await User.getUserRoles(userId);
          
          return this.formatSuccessResponse(roles, '获取用户角色成功');
        }, 300); // 缓存5分钟

      } catch (error) {
        this.handleError(error, 'getUserRoles');
      }
    });
  }

  /**
   * 获取用户权限列表
   */
  async getUserPermissions(userId) {
    return this.withPerformanceMonitoring('getUserPermissions', async () => {
      try {
        this.validateRequired({ userId }, ['userId']);

        const cacheKey = `user:${userId}:permissions`;
        
        return await this.getCached(cacheKey, async () => {
          // 验证用户存在
          const user = await User.findById(userId);
          if (!user) {
            throw new Error('用户不存在');
          }

          const permissions = await User.getUserPermissions(userId);
          
          return this.formatSuccessResponse(permissions, '获取用户权限成功');
        }, 600); // 缓存10分钟

      } catch (error) {
        this.handleError(error, 'getUserPermissions');
      }
    });
  }

  /**
   * 批量更改用户状态
   */
  async batchUpdateUserStatus(adminUserId, userIds, newStatus) {
    return this.withPerformanceMonitoring('batchUpdateUserStatus', async () => {
      try {
        this.validateRequired({ adminUserId, userIds, newStatus }, 
          ['adminUserId', 'userIds', 'newStatus']);

        if (!Array.isArray(userIds) || userIds.length === 0) {
          throw new Error('用户ID列表不能为空');
        }

        // 验证状态值（直接使用数据库状态值）
        const validStatuses = ['normal', 'frozen', 'banned'];
        
        if (!validStatuses.includes(newStatus)) {
          throw new Error(`无效的状态值，必须是: ${validStatuses.join(', ')}`);
        }

        // 验证管理员权限
        const adminUser = await User.findById(adminUserId);
        if (!adminUser) {
          throw new Error('管理员账户不存在');
        }

        // 移除管理员自己的ID（不能修改自己的状态）
        const filteredUserIds = userIds.filter(id => id !== adminUserId);
        
        if (filteredUserIds.length === 0) {
          throw new Error('不能修改自己的账户状态');
        }

        const results = await User.batchUpdateStatus(filteredUserIds, newStatus);

        // 清除批量用户缓存
        for (const userId of filteredUserIds) {
          await this.clearCache(`user:${userId}:*`);
        }

        this.log('info', '批量更新用户状态成功', { 
          adminUserId, 
          affectedUserIds: filteredUserIds,
          newStatus,
          affectedCount: results.length
        });

        // 将数据库状态映射回API状态
        const reverseStatusMapping = {
          'normal': 'active',
          'frozen': 'inactive',
          'banned': 'banned'
        };

        const mappedResults = results.map(user => {
          const sanitizedUser = this.sanitizeUserData(user);
          sanitizedUser.status = reverseStatusMapping[user.status] || user.status;
          return sanitizedUser;
        });

        return this.formatSuccessResponse({
          updatedUsers: mappedResults,
          affectedCount: results.length,
          skippedCount: userIds.length - filteredUserIds.length
        }, `成功更新 ${results.length} 个用户状态为: ${newStatus}`);

      } catch (error) {
        this.handleError(error, 'batchUpdateUserStatus');
      }
    });
  }

  /**
   * 批量删除用户
   */
  async batchDeleteUsers(adminUserId, userIds) {
    return this.withPerformanceMonitoring('batchDeleteUsers', async () => {
      try {
        this.validateRequired({ adminUserId, userIds }, ['adminUserId', 'userIds']);

        if (!Array.isArray(userIds) || userIds.length === 0) {
          throw new Error('用户ID列表不能为空');
        }

        // 验证管理员权限
        const adminUser = await User.findById(adminUserId);
        if (!adminUser) {
          throw new Error('管理员账户不存在');
        }

        // 移除管理员自己的ID（不能删除自己）
        const filteredUserIds = userIds.filter(id => id !== adminUserId);
        
        if (filteredUserIds.length === 0) {
          throw new Error('不能删除自己的账户');
        }

        const results = await User.batchDelete(filteredUserIds);

        // 清除批量用户缓存
        for (const userId of filteredUserIds) {
          await this.clearCache(`user:${userId}:*`);
        }

        this.log('info', '批量删除用户成功', { 
          adminUserId, 
          deletedUserIds: filteredUserIds,
          deletedCount: results.length
        });

        return this.formatSuccessResponse({
          deletedUsers: results.map(user => this.sanitizeUserData(user)),
          deletedCount: results.length,
          skippedCount: userIds.length - filteredUserIds.length
        }, `成功删除 ${results.length} 个用户`);

      } catch (error) {
        this.handleError(error, 'batchDeleteUsers');
      }
    });
  }

  /**
   * 更新用户资料（管理员功能）
   */
  async updateUserProfile(adminUserId, targetUserId, updateData) {
    return this.withPerformanceMonitoring('updateUserProfile', async () => {
      try {
        this.validateRequired({ adminUserId, targetUserId }, ['adminUserId', 'targetUserId']);

        // 验证管理员权限
        const adminUser = await User.findById(adminUserId);
        if (!adminUser) {
          throw new Error('管理员账户不存在');
        }

        // 验证目标用户存在
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
          throw new Error('目标用户不存在');
        }

        const { username, email, nickname, avatar_url, bio } = updateData;
        const profileUpdateData = {};

        // 验证用户名
        if (username !== undefined) {
          if (!username || username.length < 3 || username.length > 50) {
            throw new Error('用户名长度必须在3-50个字符之间');
          }
          
          // 检查用户名是否已存在（除了目标用户自己）
          const existingUser = await User.findByUsernameExcludeId(username, targetUserId);
          if (existingUser) {
            throw new Error('用户名已存在');
          }
          
          profileUpdateData.username = username;
        }

        // 验证邮箱
        if (email !== undefined) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!email || !emailRegex.test(email)) {
            throw new Error('邮箱格式不正确');
          }
          
          // 检查邮箱是否已存在（除了目标用户自己）
          const existingUser = await User.findByEmailExcludeId(email, targetUserId);
          if (existingUser) {
            throw new Error('邮箱已存在');
          }
          
          profileUpdateData.email = email;
        }

        // 验证昵称
        if (nickname !== undefined) {
          if (nickname && (nickname.length < 1 || nickname.length > 100)) {
            throw new Error('昵称长度必须在1-100个字符之间');
          }
          profileUpdateData.nickname = nickname;
        }

        // 验证头像URL
        if (avatar_url !== undefined) {
          if (avatar_url && avatar_url.length > 500) {
            throw new Error('头像URL长度不能超过500个字符');
          }
          profileUpdateData.avatar_url = avatar_url;
        }

        // 验证个人简介
        if (bio !== undefined) {
          if (bio && bio.length > 500) {
            throw new Error('个人简介长度不能超过500个字符');
          }
          profileUpdateData.bio = bio;
        }

        if (Object.keys(profileUpdateData).length === 0) {
          throw new Error('没有提供要更新的数据');
        }

        const updatedUser = await User.updateById(targetUserId, profileUpdateData);

        if (!updatedUser) {
          throw new Error('更新用户资料失败');
        }

        // 清除用户相关缓存
        await this.clearCache(`user:${targetUserId}:*`);

        this.log('info', '管理员更新用户资料成功', { 
          adminUserId,
          targetUserId, 
          updatedFields: Object.keys(profileUpdateData) 
        });

        return this.formatSuccessResponse(
          this.sanitizeUserData(updatedUser),
          '用户资料更新成功'
        );

      } catch (error) {
        this.handleError(error, 'updateUserProfile');
      }
    });
  }
}

module.exports = new UserService();
