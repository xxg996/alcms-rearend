/**
 * 创建初始管理员账户脚本
 * 创建用户名为 admin，密码为 admin 的管理员账户
 */

require('dotenv').config();
const { query, closePool } = require('../src/config/database');
const { hashPassword } = require('../src/utils/password');

async function createAdmin() {
  try {
    console.log('🚀 开始创建初始管理员账户...');

    // 检查是否已存在 admin 用户
    const existingAdmin = await query(
      'SELECT id, username, email FROM users WHERE username = $1 OR email = $2',
      ['admin', 'admin@alcms.com']
    );

    if (existingAdmin.rows.length > 0) {
      console.log('⚠️ 管理员账户已存在:');
      console.log(`   用户名: ${existingAdmin.rows[0].username}`);
      console.log(`   邮箱: ${existingAdmin.rows[0].email}`);
      console.log(`   用户ID: ${existingAdmin.rows[0].id}`);
      return;
    }

    // 哈希密码 - 使用符合要求的密码（至少6字符）
    console.log('🔐 加密管理员密码...');
    const adminPassword = 'admin123'; // 符合至少6字符的要求
    const hashedPassword = await hashPassword(adminPassword);

    // 创建管理员用户
    console.log('👤 创建管理员用户...');
    const userResult = await query(
      `INSERT INTO users (username, email, password_hash, nickname, status) 
       VALUES ($1, $2, $3, $4, 'normal') 
       RETURNING id, username, email, nickname, created_at`,
      ['admin', 'admin@alcms.com', hashedPassword, '系统管理员']
    );

    const adminUser = userResult.rows[0];
    console.log('✅ 管理员用户创建成功:');
    console.log(`   用户ID: ${adminUser.id}`);
    console.log(`   用户名: ${adminUser.username}`);
    console.log(`   邮箱: ${adminUser.email}`);
    console.log(`   昵称: ${adminUser.nickname}`);

    // 获取管理员角色ID
    const adminRoleResult = await query(
      'SELECT id FROM roles WHERE name = $1',
      ['admin']
    );

    if (adminRoleResult.rows.length === 0) {
      throw new Error('管理员角色不存在，请先执行数据库迁移');
    }

    const adminRoleId = adminRoleResult.rows[0].id;

    // 分配管理员角色
    console.log('🛡️ 分配管理员角色...');
    await query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
      [adminUser.id, adminRoleId]
    );

    console.log('✅ 管理员角色分配成功');

    // 验证权限
    console.log('🔍 验证管理员权限...');
    const permissionsResult = await query(
      `SELECT COUNT(*) as permission_count
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       JOIN user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = $1`,
      [adminUser.id]
    );

    const permissionCount = permissionsResult.rows[0].permission_count;
    console.log(`✅ 管理员拥有 ${permissionCount} 个权限`);

    console.log('\n🎉 初始管理员账户创建完成！');
    console.log('=====================================');
    console.log('📋 登录信息:');
    console.log('   用户名: admin');
    console.log('   邮箱: admin@alcms.com');
    console.log('   密码: admin123');
    console.log('   角色: 系统管理员');
    console.log('=====================================');
    console.log('⚠️ 安全提醒: 请在生产环境中立即修改默认密码！');

  } catch (error) {
    console.error('❌ 创建管理员账户失败:', error.message);
    if (error.stack) {
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  } finally {
    await closePool();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  createAdmin();
}

module.exports = { createAdmin };
