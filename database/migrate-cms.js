/**
 * CMS数据库迁移脚本
 * 仅执行CMS相关的迁移文件
 */

const fs = require('fs');
const path = require('path');
const { query, closePool } = require('../src/config/database');

// CMS迁移文件列表
const CMS_MIGRATION_FILES = [
  '003_create_cms_tables.sql',
  '004_insert_cms_default_data.sql'
];

async function runCMSMigrations() {
  try {
    console.log('🚀 开始执行CMS数据库迁移...');

    for (const filename of CMS_MIGRATION_FILES) {
      const filePath = path.join(__dirname, 'migrations', filename);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️ 迁移文件不存在: ${filename}`);
        continue;
      }

      console.log(`📄 执行CMS迁移文件: ${filename}`);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      try {
        await query(sql);
        console.log(`✅ ${filename} 执行成功`);
      } catch (error) {
        if (error.message.includes('already exists') || error.code === '42710') {
          console.log(`⚠️ ${filename} 中的某些对象已存在，跳过...`);
        } else {
          throw error;
        }
      }
    }

    console.log('✅ CMS数据库迁移完成！');

    // 验证CMS表是否创建成功
    console.log('\n🔍 验证CMS表结构...');
    
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN (
        'categories', 'resource_types', 'tags', 'resources', 
        'resource_tags', 'user_favorites', 'download_records',
        'resource_reviews', 'resource_reports', 'user_points'
      )
      ORDER BY table_name
    `);

    console.log('📋 已创建的CMS表:');
    tables.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    // 检查权限是否添加
    const permissions = await query(`
      SELECT COUNT(*) as count 
      FROM permissions 
      WHERE name LIKE 'resource:%' OR name LIKE 'category:%' OR name LIKE 'tag:%'
    `);

    console.log(`\n🛡️ 已添加CMS权限: ${permissions.rows[0].count} 个`);

  } catch (error) {
    console.error('❌ CMS数据库迁移失败:', error.message);
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
  runCMSMigrations();
}

module.exports = { runCMSMigrations };
