/**
 * 权限模型
 * 处理权限相关的数据操作
 */

const { query, getClient } = require('../config/database');

class Permission {
  /**
   * 根据ID查找权限
   * @param {number} id - 权限ID
   * @returns {Promise<Object|null>} 权限信息
   */
  static async findById(id) {
    const result = await query(
      'SELECT * FROM permissions WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * 根据名称查找权限
   * @param {string} name - 权限名称
   * @returns {Promise<Object|null>} 权限信息
   */
  static async findByName(name) {
    const result = await query(
      'SELECT * FROM permissions WHERE name = $1',
      [name]
    );
    return result.rows[0] || null;
  }

  /**
   * 获取所有权限
   * @param {boolean} activeOnly - 是否只获取启用的权限
   * @returns {Promise<Array>} 权限列表
   */
  static async findAll(activeOnly = false) {
    let sql = 'SELECT * FROM permissions';
    const params = [];
    
    if (activeOnly) {
      sql += ' WHERE is_active = $1';
      params.push(true);
    }
    
    sql += ' ORDER BY resource, action, name';
    
    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * 根据资源获取权限
   * @param {string} resource - 资源名称
   * @param {boolean} activeOnly - 是否只获取启用的权限
   * @returns {Promise<Array>} 权限列表
   */
  static async findByResource(resource, activeOnly = false) {
    let sql = 'SELECT * FROM permissions WHERE resource = $1';
    const params = [resource];
    
    if (activeOnly) {
      sql += ' AND is_active = $2';
      params.push(true);
    }
    
    sql += ' ORDER BY action, name';
    
    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * 获取权限的所有角色
   * @param {number} permissionId - 权限ID
   * @returns {Promise<Array>} 角色列表
   */
  static async getRoles(permissionId) {
    const result = await query(`
      SELECT r.* FROM roles r
      JOIN role_permissions rp ON r.id = rp.role_id
      WHERE rp.permission_id = $1 AND r.is_active = true
      ORDER BY r.name
    `, [permissionId]);
    return result.rows;
  }

  /**
   * 创建新权限
   * @param {Object} permissionData - 权限数据
   * @returns {Promise<Object>} 创建的权限信息
   */
  static async create(permissionData) {
    const { 
      name, 
      display_name, 
      description, 
      resource, 
      action 
    } = permissionData;
    
    const result = await query(
      'INSERT INTO permissions (name, display_name, description, resource, action, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
      [name, display_name, description, resource, action]
    );
    return result.rows[0];
  }

  /**
   * 更新权限
   * @param {number} id - 权限ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} 更新后的权限信息
   */
  static async updateById(id, updateData) {
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

    values.push(id);
    const result = await query(
      `UPDATE permissions SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${paramIndex} 
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('权限不存在');
    }

    return result.rows[0];
  }

  /**
   * 删除权限
   * @param {number} id - 权限ID
   * @returns {Promise<boolean>} 删除是否成功
   */
  static async deleteById(id) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // 删除角色权限关联
      await client.query('DELETE FROM role_permissions WHERE permission_id = $1', [id]);
      
      // 删除权限
      const result = await client.query('DELETE FROM permissions WHERE id = $1', [id]);

      await client.query('COMMIT');
      return result.rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 批量更新权限状态
   * @param {Array<number>} permissionIds - 权限ID数组
   * @param {boolean} isActive - 是否启用
   * @returns {Promise<Object>} 更新结果
   */
  static async batchUpdateStatus(permissionIds, isActive) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        'UPDATE permissions SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2) RETURNING *',
        [isActive, permissionIds]
      );

      await client.query('COMMIT');

      return {
        updatedCount: result.rowCount,
        updatedPermissions: result.rows
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取资源列表
   * @returns {Promise<Array>} 资源列表
   */
  static async getResources() {
    const result = await query(
      'SELECT DISTINCT resource FROM permissions WHERE resource IS NOT NULL ORDER BY resource'
    );
    return result.rows.map(row => row.resource);
  }

  /**
   * 获取操作列表
   * @param {string} resource - 资源名称（可选）
   * @returns {Promise<Array>} 操作列表
   */
  static async getActions(resource = null) {
    let sql = 'SELECT DISTINCT action FROM permissions WHERE action IS NOT NULL';
    const params = [];
    
    if (resource) {
      sql += ' AND resource = $1';
      params.push(resource);
    }
    
    sql += ' ORDER BY action';
    
    const result = await query(sql, params);
    return result.rows.map(row => row.action);
  }
}

module.exports = Permission;