/**
 * 微社区模块数据库迁移脚本
 * 执行社区相关的数据库迁移文件
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/database');

async function runCommunityMigrations() {
  console.log('🚀 开始执行微社区模块数据库迁移...');
  console.log('=====================================');

  try {
    // 检查数据库连接
    await query('SELECT 1');
    console.log('✅ 数据库连接成功');

    // 确保迁移记录表存在
    await query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        description TEXT
      )
    `);

    // 社区模块迁移文件列表
    const migrationFiles = [
      {
        version: '005',
        file: '005_create_community_tables.sql',
        description: '创建微社区数据表'
      },
      {
        version: '006',
        file: '006_insert_community_default_data.sql',
        description: '插入微社区默认数据'
      }
    ];

    for (const migration of migrationFiles) {
      console.log(`\n📋 检查迁移: ${migration.description} (${migration.version})`);
      
      // 检查是否已经执行过
      const result = await query(
        'SELECT * FROM schema_migrations WHERE version = $1',
        [migration.version]
      );

      if (result.rows.length > 0) {
        console.log(`⏭️  迁移 ${migration.version} 已经执行过，跳过`);
        continue;
      }

      // 读取并执行迁移文件
      const migrationPath = path.join(__dirname, 'migrations', migration.file);
      
      if (!fs.existsSync(migrationPath)) {
        console.error(`❌ 迁移文件不存在: ${migrationPath}`);
        continue;
      }

      console.log(`📝 执行迁移文件: ${migration.file}`);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      try {
        await query(migrationSQL);
        console.log(`✅ 迁移 ${migration.version} 执行成功`);
      } catch (error) {
        // 检查是否是已存在的错误，如果是则标记为成功
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate key value')) {
          console.log(`⚠️  迁移 ${migration.version} 表已存在，标记为已完成`);
          
          // 手动插入迁移记录
          await query(
            'INSERT INTO schema_migrations (version, description) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
            [migration.version, migration.description]
          );
        } else {
          throw error;
        }
      }
    }

    console.log('\n=====================================');
    console.log('🎉 微社区模块数据库迁移完成！');
    console.log('=====================================');

    // 显示迁移状态
    const migrations = await query('SELECT * FROM schema_migrations ORDER BY version');
    console.log('\n📊 已执行的迁移:');
    migrations.rows.forEach(migration => {
      console.log(`   ${migration.version}: ${migration.description} (${migration.executed_at.toISOString()})`);
    });

    // 显示创建的表
    console.log('\n📋 社区模块数据表:');
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'community_%'
      ORDER BY table_name
    `);
    
    tables.rows.forEach(table => {
      console.log(`   ✓ ${table.table_name}`);
    });

    // 显示默认数据统计
    console.log('\n📊 默认数据统计:');
    const stats = await Promise.all([
      query('SELECT COUNT(*) as count FROM community_boards'),
      query('SELECT COUNT(*) as count FROM permissions WHERE name LIKE \'community.%\''),
      query('SELECT COUNT(*) as count FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id WHERE p.name LIKE \'community.%\'')
    ]);

    console.log(`   📂 社区板块: ${stats[0].rows[0].count} 个`);
    console.log(`   🔑 社区权限: ${stats[1].rows[0].count} 个`);
    console.log(`   👥 角色权限关联: ${stats[2].rows[0].count} 个`);

    console.log('\n🎯 下一步操作建议:');
    console.log('1. 重启应用服务器');
    console.log('2. 测试社区API接口');
    console.log('3. 导入Postman测试集合');
    console.log('4. 创建测试帖子和评论');
    console.log('\n💡 API端点: http://localhost:3000/api/community/boards');

  } catch (error) {
    console.error('\n❌ 微社区模块数据库迁移失败:', error.message);
    console.error('错误详情:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行迁移
if (require.main === module) {
  runCommunityMigrations()
    .then(() => {
      console.log('✅ 迁移脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 迁移脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = runCommunityMigrations;
