/**
 * 用户提升为管理员脚本
 * 将指定ID的用户提升为管理员并授予所有权限
 */

require('dotenv').config();
const { query, closePool } = require('../src/config/database');
const readline = require('readline');

// 创建命令行接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * 提示用户输入
 */
function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

/**
 * 验证用户ID是否为有效数字
 */
function isValidUserId(userId) {
  const num = parseInt(userId);
  return !isNaN(num) && num > 0;
}

/**
 * 获取用户信息
 */
async function getUserInfo(userId) {
  const result = await query(
    `SELECT id, username, email, nickname, status, created_at
     FROM users 
     WHERE id = $1`,
    [userId]
  );
  
  return result.rows[0] || null;
}

/**
 * 获取用户当前角色
 */
async function getUserRoles(userId) {
  const result = await query(
    `SELECT r.id, r.name, r.display_name
     FROM roles r
     JOIN user_roles ur ON r.id = ur.role_id
     WHERE ur.user_id = $1`,
    [userId]
  );
  
  return result.rows;
}

/**
 * 获取管理员角色信息
 */
async function getAdminRole() {
  const result = await query(
    'SELECT id, name, display_name FROM roles WHERE name = $1',
    ['admin']
  );
  
  if (result.rows.length === 0) {
    throw new Error('管理员角色不存在，请先执行数据库迁移 (npm run migrate)');
  }
  
  return result.rows[0];
}

/**
 * 移除用户的所有现有角色
 */
async function removeAllUserRoles(userId) {
  await query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
}

/**
 * 为用户分配管理员角色
 */
async function assignAdminRole(userId, adminRoleId) {
  await query(
    'INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES ($1, $2, CURRENT_TIMESTAMP)',
    [userId, adminRoleId]
  );
}

/**
 * 验证管理员权限完整性
 */
async function verifyAdminPermissions(userId) {
  // 获取用户当前权限数量
  const userPermissionsResult = await query(
    `SELECT COUNT(DISTINCT p.id) as user_permission_count
     FROM permissions p
     JOIN role_permissions rp ON p.id = rp.permission_id
     JOIN user_roles ur ON rp.role_id = ur.role_id
     WHERE ur.user_id = $1`,
    [userId]
  );

  // 获取管理员角色应有的权限数量
  const adminPermissionsResult = await query(
    `SELECT COUNT(DISTINCT p.id) as admin_permission_count
     FROM permissions p
     JOIN role_permissions rp ON p.id = rp.permission_id
     JOIN roles r ON rp.role_id = r.id
     WHERE r.name = 'admin'`,
    []
  );

  // 获取系统总权限数量
  const totalPermissionsResult = await query(
    'SELECT COUNT(*) as total_permission_count FROM permissions'
  );

  const userPermissionCount = parseInt(userPermissionsResult.rows[0].user_permission_count);
  const adminPermissionCount = parseInt(adminPermissionsResult.rows[0].admin_permission_count);
  const totalPermissionCount = parseInt(totalPermissionsResult.rows[0].total_permission_count);

  return {
    userPermissionCount,
    adminPermissionCount,
    totalPermissionCount,
    isComplete: userPermissionCount === adminPermissionCount
  };
}

/**
 * 获取权限分类统计
 */
async function getPermissionStatistics(userId) {
  const result = await query(
    `SELECT 
       p.resource,
       COUNT(*) as permission_count
     FROM permissions p
     JOIN role_permissions rp ON p.id = rp.permission_id
     JOIN user_roles ur ON rp.role_id = ur.role_id
     WHERE ur.user_id = $1
     GROUP BY p.resource
     ORDER BY p.resource`,
    [userId]
  );
  
  return result.rows;
}

/**
 * 主要提升逻辑
 */
async function promoteUserToAdmin(userId) {
  try {
    console.log(`🚀 开始将用户 ID: ${userId} 提升为管理员...\n`);

    // 1. 验证用户存在
    console.log('👤 验证用户信息...');
    const user = await getUserInfo(userId);
    if (!user) {
      throw new Error(`用户 ID: ${userId} 不存在`);
    }

    console.log('✅ 用户信息:');
    console.log(`   用户ID: ${user.id}`);
    console.log(`   用户名: ${user.username}`);
    console.log(`   邮箱: ${user.email}`);
    console.log(`   昵称: ${user.nickname || '未设置'}`);
    console.log(`   状态: ${user.status}`);
    console.log(`   注册时间: ${user.created_at}\n`);

    // 2. 检查用户状态
    if (user.status === 'banned') {
      throw new Error('无法提升已封禁的用户为管理员');
    }
    if (user.status === 'frozen') {
      throw new Error('无法提升已冻结的用户为管理员');
    }

    // 3. 获取当前角色
    console.log('🔍 检查当前角色...');
    const currentRoles = await getUserRoles(userId);
    if (currentRoles.length > 0) {
      console.log('📋 当前角色:');
      currentRoles.forEach(role => {
        console.log(`   - ${role.display_name} (${role.name})`);
      });
      
      // 检查是否已经是管理员
      const isAlreadyAdmin = currentRoles.some(role => role.name === 'admin');
      if (isAlreadyAdmin) {
        console.log('\n⚠️ 用户已经是管理员，将重新验证权限...');
      }
    } else {
      console.log('📋 当前角色: 无');
    }

    // 4. 获取管理员角色
    console.log('\n🛡️ 获取管理员角色信息...');
    const adminRole = await getAdminRole();
    console.log(`✅ 管理员角色: ${adminRole.display_name} (ID: ${adminRole.id})`);

    // 5. 开始事务处理
    await query('BEGIN');

    try {
      // 移除所有现有角色
      console.log('\n🧹 清理现有角色...');
      await removeAllUserRoles(userId);
      console.log('✅ 已移除所有现有角色');

      // 分配管理员角色
      console.log('\n👑 分配管理员角色...');
      await assignAdminRole(userId, adminRole.id);
      console.log('✅ 管理员角色分配成功');

      // 提交事务
      await query('COMMIT');
      console.log('✅ 角色变更已保存');

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

    // 6. 验证权限
    console.log('\n🔍 验证管理员权限...');
    const permissionStats = await verifyAdminPermissions(userId);
    
    if (permissionStats.isComplete) {
      console.log(`✅ 权限验证成功: ${permissionStats.userPermissionCount}/${permissionStats.totalPermissionCount} 个权限`);
    } else {
      console.log(`⚠️ 权限验证异常:`);
      console.log(`   用户权限: ${permissionStats.userPermissionCount}`);
      console.log(`   管理员权限: ${permissionStats.adminPermissionCount}`);
      console.log(`   系统总权限: ${permissionStats.totalPermissionCount}`);
    }

    // 7. 显示权限分类统计
    console.log('\n📊 权限分类统计:');
    const categoryStats = await getPermissionStatistics(userId);
    categoryStats.forEach(stat => {
      console.log(`   ${stat.resource}: ${stat.permission_count} 个权限`);
    });

    // 8. 完成提示
    console.log('\n🎉 用户提升为管理员完成！');
    console.log('=====================================');
    console.log('📋 管理员信息:');
    console.log(`   用户ID: ${user.id}`);
    console.log(`   用户名: ${user.username}`);
    console.log(`   邮箱: ${user.email}`);
    console.log(`   角色: 系统管理员`);
    console.log(`   权限数量: ${permissionStats.userPermissionCount}`);
    console.log('=====================================');
    console.log('⚠️ 安全提醒: 管理员权限已生效，请妥善保管账户安全！');

  } catch (error) {
    console.error('❌ 提升用户为管理员失败:', error.message);
    if (error.stack) {
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    let userId;

    // 检查命令行参数
    const args = process.argv.slice(2);
    if (args.length > 0) {
      userId = args[0];
      console.log(`📝 使用命令行参数: 用户ID = ${userId}`);
    } else {
      // 交互式输入
      console.log('🔧 用户提升为管理员工具');
      console.log('=====================================');
      console.log('此脚本将指定用户提升为系统管理员并授予所有权限\n');
      
      userId = await askQuestion('请输入要提升为管理员的用户ID: ');
    }

    // 验证用户ID
    if (!isValidUserId(userId)) {
      throw new Error('用户ID必须是大于0的整数');
    }

    // 确认操作
    if (args.length === 0) { // 只有交互模式才需要确认
      const confirmation = await askQuestion(`\n⚠️ 确认将用户 ID: ${userId} 提升为管理员？(y/N): `);
      if (confirmation.toLowerCase() !== 'y' && confirmation.toLowerCase() !== 'yes') {
        console.log('❌ 操作已取消');
        return;
      }
    }

    // 执行提升操作
    await promoteUserToAdmin(parseInt(userId));

  } catch (error) {
    console.error('❌ 脚本执行失败:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await closePool();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { promoteUserToAdmin, main };
