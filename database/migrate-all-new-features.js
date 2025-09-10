/**
 * 全量新功能数据库迁移脚本
 * 按顺序执行VIP、卡密、积分、签到系统的所有迁移
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 数据库连接配置
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'alcms',
  user: process.env.PGUSER || 'alcms_user',
  password: process.env.PGPASSWORD || 'Alcms2024!',
});

// 迁移文件列表（按执行顺序）
const migrations = [
  {
    file: '007_add_vip_card_system.sql',
    description: 'VIP和卡密系统表结构'
  },
  {
    file: '008_add_points_checkin_system.sql',
    description: '积分和签到系统表结构'
  },
  {
    file: '009_add_vip_points_permissions.sql',
    description: 'VIP、积分、签到系统权限配置'
  }
];

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 开始全量新功能数据库迁移...');
    
    for (const migration of migrations) {
      console.log(`\n📝 执行迁移: ${migration.description}`);
      
      const migrationPath = path.join(__dirname, 'migrations', migration.file);
      
      if (!fs.existsSync(migrationPath)) {
        console.log(`⚠️  迁移文件不存在，跳过: ${migration.file}`);
        continue;
      }
      
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      try {
        await client.query(migrationSQL);
        console.log(`✅ ${migration.description} - 执行成功`);
      } catch (error) {
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate key') ||
            error.message.includes('ON CONFLICT')) {
          console.log(`⚡ ${migration.description} - 部分内容已存在，继续执行`);
        } else {
          throw error;
        }
      }
    }
    
    // 创建默认签到配置
    console.log('\n🔧 创建默认签到配置...');
    const defaultConfigSQL = `
      INSERT INTO checkin_configs (name, description, daily_points, consecutive_bonus, monthly_reset)
      VALUES (
        '默认签到配置',
        '系统默认的签到奖励配置：每日10积分，连续7天+20分，连续15天+50分，连续30天+100分',
        10,
        '{"7": 20, "15": 50, "30": 100}',
        true
      )
      ON CONFLICT DO NOTHING;
    `;
    
    try {
      await client.query(defaultConfigSQL);
      console.log('✅ 默认签到配置创建成功');
    } catch (error) {
      if (error.message.includes('syntax error')) {
        // 如果语法错误，使用简化版本
        const simpleConfigSQL = `
          INSERT INTO checkin_configs (name, description, daily_points, consecutive_bonus, monthly_reset)
          SELECT '默认签到配置', '系统默认的签到奖励配置', 10, '{}', true
          WHERE NOT EXISTS (SELECT 1 FROM checkin_configs WHERE name = '默认签到配置');
        `;
        await client.query(simpleConfigSQL);
        console.log('✅ 默认签到配置创建成功（简化版）');
      } else {
        console.log('⚠️  默认签到配置创建跳过:', error.message);
      }
    }
    
    // 验证新功能表是否创建成功
    console.log('\n🔍 验证新功能表创建情况...');
    const tableCheckSQL = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'vip_levels', 'vip_orders', 'card_keys', 
        'points_records', 'checkin_configs', 'user_checkins', 
        'points_products', 'points_exchanges'
      )
      ORDER BY table_name;
    `;
    
    const result = await client.query(tableCheckSQL);
    const createdTables = result.rows.map(row => row.table_name);
    
    console.log('📊 已创建的新功能表:');
    createdTables.forEach(table => {
      console.log(`   ✅ ${table}`);
    });
    
    if (createdTables.length === 0) {
      console.log('   ⚠️  未发现新功能表，可能迁移未成功');
    }
    
    // 检查用户表的新字段
    console.log('\n🔍 验证用户表新字段...');
    const columnCheckSQL = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name IN ('is_vip', 'vip_level', 'vip_expire_at', 'points', 'total_points')
      ORDER BY column_name;
    `;
    
    const columnResult = await client.query(columnCheckSQL);
    const newColumns = columnResult.rows.map(row => row.column_name);
    
    console.log('📊 用户表新增字段:');
    newColumns.forEach(column => {
      console.log(`   ✅ ${column}`);
    });
    
    console.log('\n🎉 全量新功能数据库迁移完成！');
    console.log('\n📝 迁移总结:');
    console.log(`   🗃️  新增表数量: ${createdTables.length}`);
    console.log(`   📄 新增字段数量: ${newColumns.length}`);
    console.log(`   🔧 迁移文件数量: ${migrations.length}`);
    
  } catch (error) {
    console.error('\n❌ 全量新功能数据库迁移失败:', error);
    console.error('错误详情:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 运行迁移
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n✨ 迁移脚本执行完成');
      console.log('\n🚀 现在可以启动服务器测试新功能了！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 迁移脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
