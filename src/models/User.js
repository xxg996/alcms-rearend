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
      'SELECT id, username, email, nickname, avatar_url, bio, status, created_at, updated_at FROM users WHERE id = $1',
      [id]
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
      `INSERT INTO users (username, email, password_hash, nickname, status) 
       VALUES ($1, $2, $3, $4, 'normal') 
       RETURNING id, username, email, nickname, status, created_at`,
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
       WHERE ur.user_id = $1`,
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
      // 1. 删除刷新令牌
      await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
      
      // 2. 删除用户角色关联
      await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
      
      // 3. 删除用户创建的资源（如果有的话）
      // 这里可以根据业务需求决定是否保留资源但标记为已删除用户创建
      
      // 4. 删除用户本身
      await client.query('DELETE FROM users WHERE id = $1', [userId]);

      await client.query('COMMIT');
      return user;

    } catch (error) {
      await client.query('ROLLBACK');
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
    const { role, status, search, limit = 20, offset = 0 } = options;

    let sqlQuery = `
      SELECT DISTINCT u.id, u.username, u.email, u.nickname, u.avatar_url, 
             u.bio, u.status, u.created_at, u.updated_at,
             array_agg(DISTINCT r.name) as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
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
               u.bio, u.status, u.created_at, u.updated_at
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
    return result.rows.map(row => ({
      ...row,
      roles: row.roles.filter(role => role !== null)
    }));
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
    const { role, status, search } = options;

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

    if (conditions.length > 0) {
      sqlQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = await query(sqlQuery, params);
    return parseInt(result.rows[0].count) || 0;
  }
}

module.exports = User;
