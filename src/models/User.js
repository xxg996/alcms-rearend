/**
 * 用户数据模型
 * 处理用户相关的数据库操作
 */

const { query, getClient } = require('../config/database');
const { hashPassword, verifyPassword } = require('../utils/password');
const { hashToken } = require('../utils/jwt');

class User {
  /**
   * 根据邮箱查找用户
   * @param {string} email - 用户邮箱
   * @returns {Promise<Object|null>} 用户信息或null
   */
  static async findByEmail(email) {
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  /**
   * 根据用户名查找用户
   * @param {string} username - 用户名
   * @returns {Promise<Object|null>} 用户信息或null
   */
  static async findByUsername(username) {
    const result = await query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0] || null;
  }

  /**
   * 根据ID查找用户
   * @param {number} id - 用户ID
   * @returns {Promise<Object|null>} 用户信息或null
   */
  static async findById(id) {
    const result = await query(
      `SELECT
        id, username, email, nickname, avatar_url, bio, status,
        created_at, updated_at,
        referral_code, inviter_id, invited_at,
        commission_balance, total_commission_earned,
        points, vip_level, is_vip
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * 根据邀请码查找用户
   */
  static async findByReferralCode(code) {
    if (!code) {
      return null;
    }

    const result = await query(
      `SELECT 
        id, username, email, nickname, status,
        referral_code, commission_balance, total_commission_earned
       FROM users
       WHERE referral_code = $1`,
      [code]
    );

    return result.rows[0] || null;
  }

  /**
   * 根据用户名查找用户（排除指定ID）
   * @param {string} username - 用户名
   * @param {number} excludeId - 要排除的用户ID
   * @returns {Promise<Object|null>} 用户信息或null
   */
  static async findByUsernameExcludeId(username, excludeId) {
    const result = await query(
      'SELECT * FROM users WHERE username = $1 AND id != $2',
      [username, excludeId]
    );
    return result.rows[0] || null;
  }

  /**
   * 根据邮箱查找用户（排除指定ID）
   * @param {string} email - 邮箱
   * @param {number} excludeId - 要排除的用户ID
   * @returns {Promise<Object|null>} 用户信息或null
   */
  static async findByEmailExcludeId(email, excludeId) {
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND id != $2',
      [email, excludeId]
    );
    return result.rows[0] || null;
  }

  /**
   * 创建新用户
   * @param {Object} userData - 用户数据
   * @returns {Promise<Object>} 创建的用户信息
   */
  static async create(userData) {
    const { username, email, password, nickname } = userData;

    // 检查用户名和邮箱是否已存在
    const existingUser = await query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('用户名或邮箱已存在');
    }

    // 哈希密码
    const passwordHash = await hashPassword(password);

    // 插入新用户
    const result = await query(
      `INSERT INTO users (
        username, email, password_hash, nickname, status
       ) 
       VALUES ($1, $2, $3, $4, 'normal') 
       RETURNING 
         id, username, email, nickname, status,
         referral_code, inviter_id, invited_at,
         commission_balance, total_commission_earned,
         created_at`,
      [username, email, passwordHash, nickname || username]
    );

    const newUser = result.rows[0];

    // 为新用户分配默认角色（普通用户）
    await this.assignRole(newUser.id, 'user');

    return newUser;
  }

  /**
   * 验证用户密码
   * @param {string} email - 用户邮箱
   * @param {string} password - 密码
   * @returns {Promise<Object|null>} 验证成功返回用户信息，失败返回null
   */
  static async authenticate(email, password) {
    const user = await query(
      'SELECT id, username, email, password_hash, nickname, status FROM users WHERE email = $1',
      [email]
    );

    if (user.rows.length === 0) {
      return null;
    }

    const userData = user.rows[0];

    // 检查用户状态
    if (userData.status !== 'normal') {
      throw new Error(`账号已被${userData.status === 'banned' ? '封禁' : '冻结'}`);
    }

    // 验证密码
    const isValidPassword = await verifyPassword(password, userData.password_hash);
    if (!isValidPassword) {
      return null;
    }

    // 返回用户信息（不包含密码哈希）
    const { password_hash, ...userInfo } = userData;
    return userInfo;
  }

  /**
   * 更新用户信息
   * @param {number} userId - 用户ID
   * @param {Object} updateData - 更新的数据
   * @returns {Promise<Object>} 更新后的用户信息
   */
  static async update(userId, updateData) {
    const allowedFields = ['nickname', 'avatar_url', 'bio'];
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        values.push(updateData[field]);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      throw new Error('没有可更新的字段');
    }

    values.push(userId);
    const result = await query(
      `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${paramIndex} 
       RETURNING id, username, email, nickname, avatar_url, bio, status, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('用户不存在');
    }

    return result.rows[0];
  }

  /**
   * 根据ID更新用户信息（通用方法）
   * @param {number} userId - 用户ID
   * @param {Object} updateData - 更新的数据
   * @returns {Promise<Object>} 更新后的用户信息
   */
  static async updateById(userId, updateData) {
    const fields = Object.keys(updateData);
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    for (const field of fields) {
      updateFields.push(`${field} = $${paramIndex}`);
      values.push(updateData[field]);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      throw new Error('没有可更新的字段');
    }

    values.push(userId);
    const result = await query(
      `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${paramIndex} 
       RETURNING id, username, email, nickname, avatar_url, bio, status, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('用户不存在');
    }

    return result.rows[0];
  }

  /**
   * 修改用户状态
   * @param {number} userId - 用户ID
   * @param {string} status - 新状态 (normal, banned, frozen)
   * @returns {Promise<Object>} 更新后的用户信息
   */
  static async updateStatus(userId, status) {
    const validStatuses = ['normal', 'banned', 'frozen'];
    if (!validStatuses.includes(status)) {
      throw new Error('无效的用户状态');
    }

    const result = await query(
      'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, status',
      [status, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('用户不存在');
    }

    return result.rows[0];
  }

  /**
   * 为用户分配角色
   * @param {number} userId - 用户ID
   * @param {string} roleName - 角色名称
   * @returns {Promise<void>}
   */
  static async assignRole(userId, roleName) {
    const roleResult = await query(
      'SELECT id FROM roles WHERE name = $1',
      [roleName]
    );

    if (roleResult.rows.length === 0) {
      throw new Error('角色不存在');
    }

    const roleId = roleResult.rows[0].id;

    await query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT (user_id, role_id) DO NOTHING',
      [userId, roleId]
    );
  }

  /**
   * 移除用户角色
   * @param {number} userId - 用户ID
   * @param {string} roleName - 角色名称
   * @returns {Promise<void>}
   */
  static async removeRole(userId, roleName) {
    const roleResult = await query(
      'SELECT id FROM roles WHERE name = $1',
      [roleName]
    );

    if (roleResult.rows.length === 0) {
      throw new Error('角色不存在');
    }

    const roleId = roleResult.rows[0].id;

    // 检查用户是否拥有该角色
    const userRoleResult = await query(
      'SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = $2',
      [userId, roleId]
    );

    if (userRoleResult.rows.length === 0) {
      throw new Error('用户没有该角色');
    }

    // 移除角色
    await query(
      'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2',
      [userId, roleId]
    );
  }

  /**
   * 获取用户的所有权限
   * @param {number} userId - 用户ID
   * @returns {Promise<Array>} 权限列表
   */
  static async getUserPermissions(userId) {
    const result = await query(
      `SELECT DISTINCT p.name, p.resource, p.action, p.display_name
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       JOIN user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = $1 AND p.is_active = true`,
      [userId]
    );

    return result.rows;
  }

  /**
   * 获取用户的角色
   * @param {number} userId - 用户ID
   * @returns {Promise<Array>} 角色列表
   */
  static async getUserRoles(userId) {
    const result = await query(
      `SELECT r.name, r.display_name, r.description
       FROM roles r
       JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [userId]
    );

    return result.rows;
  }

  /**
   * 存储刷新令牌
   * @param {number} userId - 用户ID
   * @param {string} refreshToken - 刷新令牌
   * @param {Date} expiresAt - 过期时间
   * @returns {Promise<void>}
   */
  static async storeRefreshToken(userId, refreshToken, expiresAt) {
    const tokenHash = hashToken(refreshToken);
    
    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenHash, expiresAt]
    );
  }

  /**
   * 验证刷新令牌
   * @param {string} refreshToken - 刷新令牌
   * @returns {Promise<Object|null>} 令牌信息或null
   */
  static async validateRefreshToken(refreshToken) {
    const tokenHash = hashToken(refreshToken);
    
    const result = await query(
      `SELECT rt.*, u.id as user_id, u.username, u.email 
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token_hash = $1 AND rt.expires_at > NOW() AND rt.is_revoked = FALSE`,
      [tokenHash]
    );

    return result.rows[0] || null;
  }

  /**
   * 撤销刷新令牌
   * @param {string} refreshToken - 刷新令牌
   * @returns {Promise<void>}
   */
  static async revokeRefreshToken(refreshToken) {
    const tokenHash = hashToken(refreshToken);
    
    await query(
      'UPDATE refresh_tokens SET is_revoked = TRUE WHERE token_hash = $1',
      [tokenHash]
    );
  }

  /**
   * 删除用户（管理员功能）
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>} 被删除的用户信息
   */
  static async deleteUser(userId) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // 先获取用户信息
      const userResult = await client.query(
        'SELECT id, username, email, nickname FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('用户不存在');
      }

      const user = userResult.rows[0];

      // 删除用户相关的数据（级联删除）
      // 按照依赖关系的顺序删除，先删除子表数据，再删除主表数据

      // 1. 删除用户相关的活动数据
      await client.query('DELETE FROM user_checkins WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM user_points WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM points_records WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM points_exchanges WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM daily_purchases WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM download_records WHERE user_id = $1', [userId]);

      // 2. 删除用户收藏和互动数据
      await client.query('DELETE FROM user_favorites WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM resource_comments WHERE user_id = $1', [userId]);

      // 3. 删除VIP相关数据
      await client.query('DELETE FROM vip_orders WHERE user_id = $1', [userId]);

      // 4. 删除社区相关数据
      await client.query('DELETE FROM community_favorites WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM community_likes WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM community_shares WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM community_user_stats WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM community_punishments WHERE user_id = $1', [userId]);

      // 5. 删除通知数据
      await client.query('DELETE FROM community_notifications WHERE user_id = $1 OR sender_id = $1', [userId]);

      // 6. 删除举报数据（作为举报者）
      await client.query('DELETE FROM resource_reports WHERE reporter_id = $1', [userId]);
      await client.query('DELETE FROM community_reports WHERE reporter_id = $1', [userId]);

      // 7. 处理用户创建的内容
      // 对于用户创建的帖子和评论，将其标记为已删除用户创建，而不是直接删除
      await client.query(`
        UPDATE community_posts
        SET author_id = NULL,
            content = '[用户已删除]',
            title = CASE WHEN title IS NOT NULL THEN '[已删除用户的帖子]' ELSE title END
        WHERE author_id = $1
      `, [userId]);

      await client.query(`
        UPDATE community_comments
        SET author_id = NULL,
            content = '[用户已删除]'
        WHERE author_id = $1
      `, [userId]);

      // 8. 处理用户创建的资源（保留资源但标记为已删除用户创建）
      await client.query(`
        UPDATE resources
        SET author_id = NULL
        WHERE author_id = $1
      `, [userId]);

      // 9. 处理引用用户作为操作者的记录
      // 将created_by, assigned_by等字段设置为NULL
      await client.query('UPDATE user_roles SET assigned_by = NULL WHERE assigned_by = $1', [userId]);
      await client.query('UPDATE checkin_configs SET created_by = NULL WHERE created_by = $1', [userId]);
      await client.query('UPDATE checkin_config_roles SET created_by = NULL WHERE created_by = $1', [userId]);
      await client.query('UPDATE points_products SET created_by = NULL WHERE created_by = $1', [userId]);
      await client.query('UPDATE card_keys SET created_by = NULL WHERE created_by = $1', [userId]);

      // 10. 处理已使用的卡密
      await client.query('UPDATE card_keys SET used_by = NULL WHERE used_by = $1', [userId]);

      // 11. 处理举报处理记录
      await client.query('UPDATE resource_reports SET handled_by = NULL WHERE handled_by = $1', [userId]);
      await client.query('UPDATE community_reports SET handler_id = NULL WHERE handler_id = $1', [userId]);
      await client.query('UPDATE community_punishments SET operator_id = NULL WHERE operator_id = $1', [userId]);

      // 12. 处理评论回复关系
      await client.query('UPDATE community_comments SET reply_to_user_id = NULL WHERE reply_to_user_id = $1', [userId]);

      // 13. 处理帖子最后回复者
      await client.query('UPDATE community_posts SET last_reply_user_id = NULL WHERE last_reply_user_id = $1', [userId]);

      // 14. 处理删除操作者引用（保留评论的删除操作者，资源无软删除无需处理）
      await client.query('UPDATE community_comments SET deleted_by = NULL WHERE deleted_by = $1', [userId]);

      // 15. 删除认证和角色数据
      await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);

      // 16. 最后删除用户本身
      await client.query('DELETE FROM users WHERE id = $1', [userId]);

      await client.query('COMMIT');

      console.log(`✅ 成功删除用户 ${user.username}(ID:${userId}) 及其所有相关数据`);

      return user;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ 删除用户失败:`, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 管理员创建用户
   * @param {Object} userData - 用户数据
   * @param {string} userData.username - 用户名
   * @param {string} userData.email - 邮箱
   * @param {string} userData.password - 密码
   * @param {string} [userData.nickname] - 昵称
   * @param {string} [userData.roleName] - 初始角色
   * @param {string} [userData.status] - 用户状态
   * @returns {Promise<Object>} 创建的用户信息
   */
  static async createByAdmin(userData) {
    const { username, email, password, nickname, roleName = 'user', status = 'normal' } = userData;

    // 检查用户名和邮箱是否已存在
    const existingUser = await query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('用户名或邮箱已存在');
    }

    // 验证状态值
    const validStatuses = ['normal', 'banned', 'frozen'];
    if (!validStatuses.includes(status)) {
      throw new Error('无效的用户状态');
    }

    // 哈希密码
    const passwordHash = await hashPassword(password);

    // 插入新用户
    const result = await query(
      `INSERT INTO users (username, email, password_hash, nickname, status) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, username, email, nickname, status, created_at`,
      [username, email, passwordHash, nickname || username, status]
    );

    const newUser = result.rows[0];

    // 为新用户分配指定角色
    await this.assignRole(newUser.id, roleName);

    return newUser;
  }

  /**
   * 根据过滤条件查找用户列表
   * @param {Object} options - 查询选项
   * @param {string} [options.role] - 角色过滤
   * @param {string} [options.status] - 状态过滤
   * @param {string} [options.search] - 搜索关键词
   * @param {number} [options.limit] - 数量限制
   * @param {number} [options.offset] - 偏移量
   * @returns {Promise<Array>} 用户列表
   */
  static async findByFilters(options = {}) {
    const { role, status, search, vip_status, limit = 20, offset = 0 } = options;

    let sqlQuery = `
      SELECT DISTINCT u.id, u.username, u.email, u.nickname, u.avatar_url,
             u.bio, u.status, u.created_at, u.updated_at,
             u.is_vip, u.vip_level, u.vip_expire_at, u.vip_activated_at,
             u.points, u.total_points,
             u.daily_download_limit, u.daily_downloads_used, u.last_download_reset_date,
             vl.name as vip_level_name, vl.display_name as vip_level_display_name,
             COALESCE(vl.daily_download_limit, u.daily_download_limit, 10) as actual_daily_limit,
             COALESCE(
               (SELECT COUNT(*) FROM daily_purchases dp
                WHERE dp.user_id = u.id
                  AND dp.purchase_date = CURRENT_DATE
                  AND dp.points_cost = 0),
               CASE
                 WHEN u.last_download_reset_date::date < CURRENT_DATE THEN 0
                 ELSE u.daily_downloads_used
               END
             ) as today_consumed,
             array_agg(DISTINCT r.name) as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      LEFT JOIN vip_levels vl ON u.vip_level = vl.level AND vl.is_active = true
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    // 状态过滤
    if (status) {
      sqlQuery += ` AND u.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // 角色过滤
    if (role) {
      sqlQuery += ` AND EXISTS (
        SELECT 1 FROM user_roles ur2
        JOIN roles r2 ON ur2.role_id = r2.id
        WHERE ur2.user_id = u.id AND r2.name = $${paramIndex}
      )`;
      params.push(role);
      paramIndex++;
    }

    // VIP状态过滤
    if (vip_status) {
      if (vip_status === 'vip') {
        sqlQuery += ` AND u.is_vip = true`;
      } else if (vip_status === 'non_vip') {
        sqlQuery += ` AND u.is_vip = false`;
      } else if (vip_status === 'expired') {
        sqlQuery += ` AND u.is_vip = true AND u.vip_expire_at IS NOT NULL AND u.vip_expire_at < CURRENT_TIMESTAMP`;
      } else if (vip_status === 'active') {
        sqlQuery += ` AND u.is_vip = true AND (u.vip_expire_at IS NULL OR u.vip_expire_at > CURRENT_TIMESTAMP)`;
      } else if (vip_status === 'permanent') {
        sqlQuery += ` AND u.is_vip = true AND u.vip_expire_at IS NULL`;
      }
    }

    // 搜索过滤
    if (search) {
      sqlQuery += ` AND (
        u.username ILIKE $${paramIndex} OR 
        u.email ILIKE $${paramIndex} OR 
        u.nickname ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // 分组和排序
    sqlQuery += `
      GROUP BY u.id, u.username, u.email, u.nickname, u.avatar_url,
               u.bio, u.status, u.created_at, u.updated_at,
               u.is_vip, u.vip_level, u.vip_expire_at, u.vip_activated_at,
               u.points, u.total_points,
               u.daily_download_limit, u.daily_downloads_used, u.last_download_reset_date,
               vl.name, vl.display_name, vl.daily_download_limit
      ORDER BY u.created_at DESC
    `;

    // 分页
    if (limit > 0) {
      sqlQuery += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    if (offset > 0) {
      sqlQuery += ` OFFSET $${paramIndex}`;
      params.push(offset);
    }

    const result = await query(sqlQuery, params);
    return result.rows.map(row => {
      // 检查VIP是否过期
      let isVipExpired = false;
      if (row.is_vip && row.vip_expire_at) {
        isVipExpired = new Date(row.vip_expire_at) < new Date();
      }

      return {
        ...row,
        roles: row.roles.filter(role => role !== null),
        is_vip_expired: isVipExpired,
        is_vip_permanent: row.is_vip && !row.vip_expire_at
      };
    });
  }

  /**
   * 根据过滤条件统计用户数量
   * @param {Object} options - 查询选项
   * @param {string} [options.role] - 角色过滤
   * @param {string} [options.status] - 状态过滤
   * @param {string} [options.search] - 搜索关键词
   * @returns {Promise<number>} 用户总数
   */
  static async countByFilters(options = {}) {
    const { role, status, search, vip_status } = options;

    let sqlQuery = `
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
    `;
    
    const params = [];
    let paramIndex = 1;
    const conditions = [];

    // 状态过滤
    if (status) {
      conditions.push(`u.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    // 角色过滤
    if (role) {
      sqlQuery += ` LEFT JOIN user_roles ur ON u.id = ur.user_id
                    LEFT JOIN roles r ON ur.role_id = r.id`;
      conditions.push(`r.name = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    // 搜索过滤
    if (search) {
      conditions.push(`(
        u.username ILIKE $${paramIndex} OR
        u.email ILIKE $${paramIndex} OR
        u.nickname ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // VIP状态过滤
    if (vip_status) {
      if (vip_status === 'vip') {
        conditions.push(`u.is_vip = true`);
      } else if (vip_status === 'non_vip') {
        conditions.push(`u.is_vip = false`);
      } else if (vip_status === 'expired') {
        conditions.push(`u.is_vip = true AND u.vip_expire_at IS NOT NULL AND u.vip_expire_at < CURRENT_TIMESTAMP`);
      } else if (vip_status === 'active') {
        conditions.push(`u.is_vip = true AND (u.vip_expire_at IS NULL OR u.vip_expire_at > CURRENT_TIMESTAMP)`);
      } else if (vip_status === 'permanent') {
        conditions.push(`u.is_vip = true AND u.vip_expire_at IS NULL`);
      }
    }

    if (conditions.length > 0) {
      sqlQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = await query(sqlQuery, params);
    return parseInt(result.rows[0].count) || 0;
  }

  /**
   * 获取用户统计信息
   * @returns {Promise<Object>} 用户统计数据
   */
  static async getStats() {
    try {
      // 获取基础统计
      const totalStatsResult = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'normal' THEN 1 END) as normal,
          COUNT(CASE WHEN status = 'banned' THEN 1 END) as banned,
          COUNT(CASE WHEN status = 'frozen' THEN 1 END) as frozen
        FROM users
      `);

      // 获取角色分布统计
      const roleStatsResult = await query(`
        SELECT
          r.name as role_name,
          r.display_name,
          COUNT(ur.user_id) as count
        FROM roles r
        LEFT JOIN user_roles ur ON r.id = ur.role_id
        GROUP BY r.id, r.name, r.display_name
        ORDER BY count DESC
      `);

      // 获取VIP统计
      const vipStatsResult = await query(`
        SELECT
          COUNT(CASE WHEN is_vip = true THEN 1 END) as total_vip,
          COUNT(CASE WHEN is_vip = false THEN 1 END) as total_non_vip,
          COUNT(CASE WHEN is_vip = true AND (vip_expire_at IS NULL OR vip_expire_at > CURRENT_TIMESTAMP) THEN 1 END) as active_vip,
          COUNT(CASE WHEN is_vip = true AND vip_expire_at IS NOT NULL AND vip_expire_at < CURRENT_TIMESTAMP THEN 1 END) as expired_vip,
          COUNT(CASE WHEN is_vip = true AND vip_expire_at IS NULL THEN 1 END) as permanent_vip
        FROM users
      `);

      // 获取VIP等级分布统计
      const vipLevelStatsResult = await query(`
        SELECT
          u.vip_level,
          vl.name as level_name,
          vl.display_name as level_display_name,
          COUNT(u.id) as count
        FROM users u
        LEFT JOIN vip_levels vl ON u.vip_level = vl.level AND vl.is_active = true
        WHERE u.is_vip = true
        GROUP BY u.vip_level, vl.name, vl.display_name
        ORDER BY u.vip_level
      `);

      // 获取时间段统计（今日、本周、本月新增用户）
      const timeStatsResult = await query(`
        SELECT
          COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as new_today,
          COUNT(CASE WHEN created_at >= DATE_TRUNC('week', CURRENT_DATE) THEN 1 END) as new_this_week,
          COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as new_this_month,
          COUNT(CASE WHEN created_at >= DATE_TRUNC('year', CURRENT_DATE) THEN 1 END) as new_this_year
        FROM users
      `);

      // 获取最近活跃统计（如果有last_login_at字段）
      const activityStatsResult = await query(`
        SELECT
          COUNT(CASE WHEN updated_at >= CURRENT_DATE - INTERVAL '1 day' THEN 1 END) as active_1d,
          COUNT(CASE WHEN updated_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as active_7d,
          COUNT(CASE WHEN updated_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as active_30d
        FROM users
        WHERE status = 'normal'
      `);

      // 获取用户增长趋势（最近7天）
      const growthTrendResult = await query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM users
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 7
      `);

      const totalStats = totalStatsResult.rows[0];
      const roleStats = roleStatsResult.rows;
      const vipStats = vipStatsResult.rows[0];
      const vipLevelStats = vipLevelStatsResult.rows;
      const timeStats = timeStatsResult.rows[0];
      const activityStats = activityStatsResult.rows[0];
      const growthTrend = growthTrendResult.rows;

      // 构建角色统计对象
      const byRole = {};
      roleStats.forEach(role => {
        byRole[role.role_name] = {
          count: parseInt(role.count) || 0,
          display_name: role.display_name
        };
      });

      // 构建VIP等级统计对象
      const byVipLevel = {};
      vipLevelStats.forEach(level => {
        byVipLevel[level.vip_level] = {
          count: parseInt(level.count) || 0,
          level_name: level.level_name,
          level_display_name: level.level_display_name
        };
      });

      return {
        // 总体统计
        total: parseInt(totalStats.total) || 0,
        active: parseInt(totalStats.normal) || 0,
        banned: parseInt(totalStats.banned) || 0,
        frozen: parseInt(totalStats.frozen) || 0,

        // 角色分布
        byRole,

        // VIP统计
        vip: {
          total: parseInt(vipStats.total_vip) || 0,
          active: parseInt(vipStats.active_vip) || 0,
          expired: parseInt(vipStats.expired_vip) || 0,
          permanent: parseInt(vipStats.permanent_vip) || 0,
          non_vip: parseInt(vipStats.total_non_vip) || 0,
          byLevel: byVipLevel
        },

        // 时间段新增用户
        newUsers: {
          today: parseInt(timeStats.new_today) || 0,
          thisWeek: parseInt(timeStats.new_this_week) || 0,
          thisMonth: parseInt(timeStats.new_this_month) || 0,
          thisYear: parseInt(timeStats.new_this_year) || 0
        },

        // 活跃度统计
        activeUsers: {
          last1Day: parseInt(activityStats.active_1d) || 0,
          last7Days: parseInt(activityStats.active_7d) || 0,
          last30Days: parseInt(activityStats.active_30d) || 0
        },

        // 增长趋势
        growthTrend: growthTrend.map(item => ({
          date: item.date,
          count: parseInt(item.count) || 0
        })),

        // 计算比率
        ratios: {
          activeRate: totalStats.total > 0 ? 
            ((parseInt(totalStats.normal) / parseInt(totalStats.total)) * 100).toFixed(2) : '0.00',
          bannedRate: totalStats.total > 0 ? 
            ((parseInt(totalStats.banned) / parseInt(totalStats.total)) * 100).toFixed(2) : '0.00'
        }
      };

    } catch (error) {
      throw new Error(`获取用户统计失败: ${error.message}`);
    }
  }

  /**
   * 批量更新用户状态
   * @param {Array} userIds - 用户ID数组
   * @param {string} status - 新状态
   * @returns {Promise<Array>} 更新后的用户列表
   */
  static async batchUpdateStatus(userIds, status) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('用户ID列表不能为空');
    }

    const validStatuses = ['normal', 'banned', 'frozen'];
    if (!validStatuses.includes(status)) {
      throw new Error('无效的用户状态');
    }

    const client = await getClient();
    
    try {
      await client.query('BEGIN');

      // 批量更新用户状态
      const placeholders = userIds.map((_, index) => `$${index + 2}`).join(',');
      const sql = `
        UPDATE users 
        SET status = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id IN (${placeholders})
        RETURNING id, username, email, nickname, status, updated_at
      `;

      const result = await client.query(sql, [status, ...userIds]);

      await client.query('COMMIT');
      return result.rows;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 批量删除用户
   * @param {Array} userIds - 用户ID数组
   * @returns {Promise<Array>} 被删除的用户列表
   */
  static async batchDelete(userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('用户ID列表不能为空');
    }

    const client = await getClient();
    
    try {
      await client.query('BEGIN');

      // 先获取要删除的用户信息
      const placeholders = userIds.map((_, index) => `$${index + 1}`).join(',');
      const selectSql = `
        SELECT id, username, email, nickname FROM users 
        WHERE id IN (${placeholders})
      `;
      const usersResult = await client.query(selectSql, userIds);
      const usersToDelete = usersResult.rows;

      if (usersToDelete.length === 0) {
        throw new Error('没有找到要删除的用户');
      }

      // 批量删除用户相关数据
      // 1. 删除刷新令牌
      await client.query(`DELETE FROM refresh_tokens WHERE user_id IN (${placeholders})`, userIds);
      
      // 2. 删除用户角色关联
      await client.query(`DELETE FROM user_roles WHERE user_id IN (${placeholders})`, userIds);
      
      // 3. 删除其他相关数据（可根据业务需求扩展）
      // 例如：用户收藏、评论、帖子等
      
      // 4. 删除用户本身
      await client.query(`DELETE FROM users WHERE id IN (${placeholders})`, userIds);

      await client.query('COMMIT');
      return usersToDelete;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 更新用户密码
   * @param {number} userId - 用户ID
   * @param {string} newPassword - 新密码
   * @returns {Promise<boolean>} 更新是否成功
   */
  static async updatePassword(userId, newPassword) {
    const bcrypt = require('bcrypt');
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    const result = await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, userId]
    );

    return result.rowCount > 0;
  }

  /**
   * 撤销用户的所有刷新令牌
   * @param {number} userId - 用户ID
   * @returns {Promise<number>} 撤销的令牌数量
   */
  static async revokeAllRefreshTokens(userId) {
    const result = await query(
      'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1 AND is_revoked = false',
      [userId]
    );

    return result.rowCount;
  }
}

module.exports = User;
