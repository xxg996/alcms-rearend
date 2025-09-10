/**
 * 系统健康检查脚本
 * 检查所有新功能模块的运行状态
 */

const { Pool } = require('pg');
require('dotenv').config();

// 数据库连接配置
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'alcms',
  user: process.env.PGUSER || 'alcms_user',
  password: process.env.PGPASSWORD || 'Alcms2024!',
});

class HealthChecker {
  constructor() {
    this.results = {
      database: false,
      tables: false,
      permissions: false,
      models: false,
      routes: false,
      overall: false
    };
  }

  async checkDatabase() {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.results.database = true;
      console.log('✅ 数据库连接正常');
      return true;
    } catch (error) {
      console.error('❌ 数据库连接失败:', error.message);
      return false;
    }
  }

  async checkTables() {
    try {
      const requiredTables = [
        'users', 'roles', 'permissions', 'role_permissions', 'user_roles',
        'vip_levels', 'vip_orders', 'card_keys',
        'points_records', 'checkin_configs', 'user_checkins'
      ];

      const client = await pool.connect();
      
      for (const table of requiredTables) {
        const result = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [table]);
        
        if (result.rows[0].exists) {
          console.log(`✅ 表 ${table} 存在`);
        } else {
          console.error(`❌ 表 ${table} 不存在`);
          client.release();
          return false;
        }
      }
      
      client.release();
      this.results.tables = true;
      console.log('✅ 所有必要表检查通过');
      return true;
    } catch (error) {
      console.error('❌ 表结构检查失败:', error.message);
      return false;
    }
  }

  async checkPermissions() {
    try {
      const client = await pool.connect();
      
      // 检查VIP、积分、签到相关权限是否存在
      const permissionCheck = await client.query(`
        SELECT COUNT(*) as count 
        FROM permissions 
        WHERE name LIKE 'vip.%' 
        OR name LIKE 'card_key.%' 
        OR name LIKE 'points.%' 
        OR name LIKE 'checkin.%'
      `);
      
      const permissionCount = parseInt(permissionCheck.rows[0].count);
      
      if (permissionCount > 0) {
        console.log(`✅ 新功能权限配置正常 (${permissionCount}个权限)`);
        this.results.permissions = true;
        client.release();
        return true;
      } else {
        console.error('❌ 新功能权限配置缺失');
        client.release();
        return false;
      }
    } catch (error) {
      console.error('❌ 权限检查失败:', error.message);
      return false;
    }
  }

  checkModels() {
    try {
      const path = require('path');
      const models = [
        '../src/models/User.js',
        '../src/models/VIP.js',
        '../src/models/CardKey.js',
        '../src/models/Points.js',
        '../src/models/Checkin.js'
      ];

      for (const modelPath of models) {
        try {
          require(modelPath);
          console.log(`✅ 模型 ${modelPath} 加载成功`);
        } catch (error) {
          console.error(`❌ 模型 ${modelPath} 加载失败:`, error.message);
          return false;
        }
      }

      this.results.models = true;
      console.log('✅ 所有数据模型检查通过');
      return true;
    } catch (error) {
      console.error('❌ 模型检查失败:', error.message);
      return false;
    }
  }

  checkRoutes() {
    try {
      const routes = [
        '../src/routes/auth.js',
        '../src/routes/users.js',
        '../src/routes/vip.js',
        '../src/routes/cardKey.js',
        '../src/routes/points.js',
        '../src/routes/checkin.js'
      ];

      for (const routePath of routes) {
        try {
          require(routePath);
          console.log(`✅ 路由 ${routePath} 加载成功`);
        } catch (error) {
          console.error(`❌ 路由 ${routePath} 加载失败:`, error.message);
          return false;
        }
      }

      this.results.routes = true;
      console.log('✅ 所有路由模块检查通过');
      return true;
    } catch (error) {
      console.error('❌ 路由检查失败:', error.message);
      return false;
    }
  }

  async checkJWTIntegration() {
    try {
      const { generateTokenPair, verifyAccessToken } = require('../src/utils/jwt');
      
      // 模拟用户和角色数据
      const testUser = { id: 1, username: 'test', email: 'test@test.com' };
      const testRoles = [{ id: 1, name: 'user', level: 1 }];
      
      // 生成JWT令牌
      const tokens = generateTokenPair(testUser, testRoles);
      
      // 验证JWT令牌
      const payload = verifyAccessToken(tokens.accessToken);
      
      if (payload.roles && payload.roles.length > 0) {
        console.log('✅ JWT角色信息集成正常');
        return true;
      } else {
        console.error('❌ JWT角色信息集成失败');
        return false;
      }
    } catch (error) {
      console.error('❌ JWT集成检查失败:', error.message);
      return false;
    }
  }

  async runFullCheck() {
    console.log('🔍 开始系统健康检查...\n');
    
    const checks = [
      { name: '数据库连接', fn: () => this.checkDatabase() },
      { name: '表结构', fn: () => this.checkTables() },
      { name: '权限配置', fn: () => this.checkPermissions() },
      { name: '数据模型', fn: () => this.checkModels() },
      { name: '路由模块', fn: () => this.checkRoutes() },
      { name: 'JWT集成', fn: () => this.checkJWTIntegration() }
    ];

    let passedChecks = 0;
    
    for (const check of checks) {
      console.log(`\n🔧 检查 ${check.name}...`);
      try {
        const result = await check.fn();
        if (result) {
          passedChecks++;
        }
      } catch (error) {
        console.error(`❌ ${check.name} 检查异常:`, error.message);
      }
    }

    this.results.overall = passedChecks === checks.length;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 系统健康检查报告');
    console.log('='.repeat(50));
    console.log(`✅ 通过检查: ${passedChecks}/${checks.length}`);
    console.log(`📈 系统健康度: ${Math.round(passedChecks / checks.length * 100)}%`);
    
    if (this.results.overall) {
      console.log('🎉 系统状态良好，所有新功能模块运行正常！');
    } else {
      console.log('⚠️  系统存在问题，请检查失败的模块');
    }
    
    await pool.end();
    return this.results.overall;
  }
}

// 运行健康检查
if (require.main === module) {
  const checker = new HealthChecker();
  checker.runFullCheck()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 健康检查执行失败:', error);
      process.exit(1);
    });
}

module.exports = HealthChecker;
