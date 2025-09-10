/**
 * 积分和签到系统数据库迁移脚本
 * 执行积分和签到系统相关的数据库结构变更
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

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 开始积分和签到系统数据库迁移...');
    
    // 读取并执行积分和签到系统迁移
    const migrationPath = path.join(__dirname, 'migrations/008_add_points_checkin_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 执行积分和签到系统表结构创建...');
    await client.query(migrationSQL);
    console.log('✅ 积分和签到系统表结构创建成功');
    
    // 创建默认签到配置
    console.log('🔧 创建默认签到配置...');
    const defaultConfigSQL = `
      INSERT INTO checkin_configs (name, description, daily_points, consecutive_bonus, monthly_reset)
      VALUES (
        '默认签到配置',
        '系统默认的签到奖励配置',
        10,
        '{"7": 20, "15": 50, "30": 100}',
        true
      )
      ON CONFLICT DO NOTHING;
    `;
    await client.query(defaultConfigSQL);
    console.log('✅ 默认签到配置创建成功');
    
    console.log('🎉 积分和签到系统数据库迁移完成！');
    
  } catch (error) {
    console.error('❌ 积分和签到系统数据库迁移失败:', error);
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
      console.log('✨ 迁移脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 迁移脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
