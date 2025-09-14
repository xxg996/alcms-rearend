/**
 * 角色模型
 * 处理角色相关的数据操作
 */

const { query, getClient } = require('../config/database');

class Role {
  /**
   * 根据ID查找角色
   * @param {number} id - 角色ID
   * @returns {Promise<Object|null>} 角色信息
   */
  static async findById(id) {
    const result = await query(
      'SELECT * FROM roles WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * 根据名称查找角色
   * @param {string} name - 角色名称
   * @returns {Promise<Object|null>} 角色信息
   */
  static async findByName(name) {
    const result = await query(
      'SELECT * FROM roles WHERE name = $1',
      [name]
    );
    return result.rows[0] || null;
  }

  /**
   * 获取所有角色
   * @returns {Promise<Array>} 角色列表
   */
  static async findAll() {
    const result = await query(
      'SELECT * FROM roles ORDER BY id ASC'
    );
    return result.rows;
  }

  /**
   * 获取角色的所有权限
   * @param {number} roleId - 角色ID
   * @returns {Promise<Array>} 权限列表
   */
  static async getPermissions(roleId) {
    const result = await query(`
      SELECT p.* FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1 AND p.is_active = true
      ORDER BY p.resource, p.action
    `, [roleId]);
    return result.rows;
  }

  /**
   * 为角色分配权限（批量）
   * @param {number} roleId - 角色ID
   * @param {Array<number>} permissionIds - 权限ID数组
   * @returns {Promise<Object>} 分配结果
   */
  static async assignPermissions(roleId, permissionIds) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // 获取现有权限
      const existingResult = await client.query(
        'SELECT permission_id FROM role_permissions WHERE role_id = $1 AND permission_id = ANY($2)',
        [roleId, permissionIds]
      );
      const existingPermissionIds = existingResult.rows.map(row => row.permission_id);
      
      // 过滤出需要新增的权限
      const newPermissionIds = permissionIds.filter(id => !existingPermissionIds.includes(id));
      
      const assignedPermissions = [];
      
      // 插入新的角色权限关联
      for (const permissionId of newPermissionIds) {
        await client.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
          [roleId, permissionId]
        );
        
        // 获取权限详情
        const permResult = await client.query(
          'SELECT * FROM permissions WHERE id = $1',
          [permissionId]
        );
        if (permResult.rows[0]) {
          assignedPermissions.push(permResult.rows[0]);
        }
      }

      await client.query('COMMIT');

      return {
        assignedCount: newPermissionIds.length,
        skippedCount: existingPermissionIds.length,
        assignedPermissions
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 撤销角色权限（批量）
   * @param {number} roleId - 角色ID
   * @param {Array<number>} permissionIds - 权限ID数组
   * @returns {Promise<Object>} 撤销结果
   */
  static async revokePermissions(roleId, permissionIds) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // 获取要撤销的权限详情
      const permissionsResult = await client.query(
        'SELECT p.* FROM permissions p JOIN role_permissions rp ON p.id = rp.permission_id WHERE rp.role_id = $1 AND p.id = ANY($2)',
        [roleId, permissionIds]
      );
      const revokedPermissions = permissionsResult.rows;

      // 删除角色权限关联
      const deleteResult = await client.query(
        'DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = ANY($2)',
        [roleId, permissionIds]
      );

      await client.query('COMMIT');

      return {
        revokedCount: deleteResult.rowCount,
        revokedPermissions
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 创建新角色
   * @param {Object} roleData - 角色数据
   * @returns {Promise<Object>} 创建的角色信息
   */
  static async create(roleData) {
    const { name, display_name, description } = roleData;
    const result = await query(
      'INSERT INTO roles (name, display_name, description, created_at, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
      [name, display_name, description]
    );
    return result.rows[0];
  }

  /**
   * 更新角色
   * @param {number} id - 角色ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} 更新后的角色信息
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
      `UPDATE roles SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${paramIndex} 
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('角色不存在');
    }

    return result.rows[0];
  }

  /**
   * 删除角色
   * @param {number} id - 角色ID
   * @returns {Promise<boolean>} 删除是否成功
   */
  static async deleteById(id) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // 删除角色权限关联
      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [id]);
      
      // 删除用户角色关联
      await client.query('DELETE FROM user_roles WHERE role_id = $1', [id]);
      
      // 删除角色
      const result = await client.query('DELETE FROM roles WHERE id = $1', [id]);

      await client.query('COMMIT');
      return result.rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Role;