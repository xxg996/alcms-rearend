/**
 * 数据库迁移脚本
 * 自动执行SQL迁移文件，建立数据库表结构
 */

const fs = require('fs');
const path = require('path');
const { query, closePool } = require('../src/config/database');

/**
 * 执行数据库迁移
 */
async function runMigrations() {
  try {
    console.log('🚀 开始执行数据库迁移...');
    
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // 按文件名排序确保执行顺序

    for (const file of migrationFiles) {
      console.log(`📄 执行迁移文件: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      await query(sql);
      console.log(`✅ 迁移文件 ${file} 执行成功`);
    }
    
    console.log('🎉 所有迁移文件执行完成！');
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// 如果直接运行此脚本，则执行迁移
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
