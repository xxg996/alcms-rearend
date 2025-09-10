/**
 * VIP和卡密系统数据库迁移脚本
 * 执行VIP系统相关的数据库结构变更
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
    console.log('🚀 开始VIP和卡密系统数据库迁移...');
    
    // 读取并执行VIP系统迁移
    const migrationPath = path.join(__dirname, 'migrations/007_add_vip_card_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 执行VIP和卡密系统表结构创建...');
    await client.query(migrationSQL);
    console.log('✅ VIP和卡密系统表结构创建成功');
    
    console.log('🎉 VIP和卡密系统数据库迁移完成！');
    
  } catch (error) {
    console.error('❌ VIP和卡密系统数据库迁移失败:', error);
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
