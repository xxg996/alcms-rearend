/**
 * Alcms API 自动化测试脚本
 * 使用 Node.js 和 axios 进行完整的API测试
 */

const axios = require('axios');

// 配置
const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  username: `test_${Date.now()}`,
  email: `test_${Date.now()}@example.com`,
  password: 'TestPass123!',
  nickname: '自动化测试用户'
};

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m', 
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 存储令牌
let accessToken = '';
let refreshToken = '';
let userId = '';

/**
 * 健康检查
 */
async function healthCheck() {
  try {
    log('🔍 检查服务状态...', 'blue');
    const response = await axios.get(`${BASE_URL}/health`);
    
    if (response.data.success) {
      log('✅ 服务正常运行', 'green');
      log(`   版本: ${response.data.version}`);
      log(`   时间: ${response.data.timestamp}`);
      return true;
    }
    return false;
  } catch (error) {
    log('❌ 服务连接失败', 'red');
    log(`   错误: ${error.message}`, 'red');
    return false;
  }
}

/**
 * 用户注册测试
 */
async function testRegister() {
  try {
    log('📝 测试用户注册...', 'blue');
    const response = await axios.post(`${BASE_URL}/api/auth/register`, TEST_USER);
    
    if (response.data.success) {
      log('✅ 注册成功', 'green');
      log(`   用户ID: ${response.data.data.user.id}`);
      log(`   用户名: ${response.data.data.user.username}`);
      log(`   邮箱: ${response.data.data.user.email}`);
      
      // 保存令牌
      accessToken = response.data.data.tokens.accessToken;
      refreshToken = response.data.data.tokens.refreshToken;
      userId = response.data.data.user.id;
      
      return true;
    }
    return false;
  } catch (error) {
    log('❌ 注册失败', 'red');
    log(`   错误: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

/**
 * 用户登录测试
 */
async function testLogin() {
  try {
    log('🔐 测试用户登录...', 'blue');
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    
    if (response.data.success) {
      log('✅ 登录成功', 'green');
      log(`   角色数量: ${response.data.data.user.roles.length}`);
      log(`   令牌类型: ${response.data.data.tokens.tokenType}`);
      
      // 更新令牌
      accessToken = response.data.data.tokens.accessToken;
      refreshToken = response.data.data.tokens.refreshToken;
      
      return true;
    }
    return false;
  } catch (error) {
    log('❌ 登录失败', 'red');
    log(`   错误: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

/**
 * 获取用户信息测试
 */
async function testGetProfile() {
  try {
    log('👤 测试获取用户信息...', 'blue');
    const response = await axios.get(`${BASE_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (response.data.success) {
      log('✅ 获取用户信息成功', 'green');
      log(`   角色: ${response.data.data.roles.map(r => r.display_name).join(', ')}`);
      log(`   权限数量: ${response.data.data.permissions.length}`);
      
      return true;
    }
    return false;
  } catch (error) {
    log('❌ 获取用户信息失败', 'red');
    log(`   错误: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

/**
 * 更新用户资料测试
 */
async function testUpdateProfile() {
  try {
    log('✏️ 测试更新用户资料...', 'blue');
    const updateData = {
      nickname: '更新后的昵称',
      bio: '这是通过自动化测试脚本更新的个人简介'
    };
    
    const response = await axios.put(`${BASE_URL}/api/users/profile`, updateData, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (response.data.success) {
      log('✅ 用户资料更新成功', 'green');
      log(`   新昵称: ${response.data.data.user.nickname}`);
      log(`   个人简介: ${response.data.data.user.bio}`);
      
      return true;
    }
    return false;
  } catch (error) {
    log('❌ 更新用户资料失败', 'red');
    log(`   错误: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

/**
 * 权限测试（预期失败）
 */
async function testPermissionDenied() {
  try {
    log('🔐 测试权限控制...', 'blue');
    await axios.get(`${BASE_URL}/api/users`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    log('❌ 权限控制失效（不应该能访问）', 'red');
    return false;
  } catch (error) {
    if (error.response?.status === 403) {
      log('✅ 权限控制正常', 'green');
      log('   普通用户无法访问管理员接口');
      return true;
    } else {
      log('❌ 权限测试出现意外错误', 'red');
      log(`   错误: ${error.response?.data?.message || error.message}`, 'red');
      return false;
    }
  }
}

/**
 * 令牌刷新测试
 */
async function testRefreshToken() {
  try {
    log('🔄 测试令牌刷新...', 'blue');
    const response = await axios.post(`${BASE_URL}/api/auth/refresh`, {
      refreshToken: refreshToken
    });
    
    if (response.data.success) {
      log('✅ 令牌刷新成功', 'green');
      
      // 更新令牌
      const newAccessToken = response.data.data.tokens.accessToken;
      const newRefreshToken = response.data.data.tokens.refreshToken;
      
      // 测试新令牌是否有效
      const profileResponse = await axios.get(`${BASE_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${newAccessToken}` }
      });
      
      if (profileResponse.data.success) {
        log('✅ 新令牌验证成功', 'green');
        accessToken = newAccessToken;
        refreshToken = newRefreshToken;
        return true;
      }
    }
    return false;
  } catch (error) {
    log('❌ 令牌刷新失败', 'red');
    log(`   错误: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

/**
 * 用户登出测试
 */
async function testLogout() {
  try {
    log('👋 测试用户登出...', 'blue');
    const response = await axios.post(`${BASE_URL}/api/auth/logout`, {
      refreshToken: refreshToken
    });
    
    if (response.data.success) {
      log('✅ 登出成功', 'green');
      
      // 测试令牌是否已失效
      try {
        await axios.post(`${BASE_URL}/api/auth/refresh`, {
          refreshToken: refreshToken
        });
        log('❌ 刷新令牌未被正确撤销', 'red');
        return false;
      } catch (error) {
        if (error.response?.status === 401) {
          log('✅ 刷新令牌已正确撤销', 'green');
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    log('❌ 登出失败', 'red');
    log(`   错误: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

/**
 * API 文档测试
 */
async function testApiDocs() {
  try {
    log('📚 测试API文档...', 'blue');
    const response = await axios.get(`${BASE_URL}/api`);
    
    if (response.data.success && response.data.endpoints) {
      log('✅ API文档正常', 'green');
      log(`   认证接口: ${Object.keys(response.data.endpoints.authentication).length} 个`);
      log(`   用户接口: ${Object.keys(response.data.endpoints.users).length} 个`);
      log(`   功能特性: ${response.data.features.length} 项`);
      
      return true;
    }
    return false;
  } catch (error) {
    log('❌ API文档测试失败', 'red');
    log(`   错误: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

/**
 * 执行所有测试
 */
async function runAllTests() {
  log('🚀 开始 Alcms API 自动化测试', 'yellow');
  log('=====================================', 'yellow');
  
  const tests = [
    { name: '健康检查', fn: healthCheck },
    { name: 'API文档', fn: testApiDocs },
    { name: '用户注册', fn: testRegister },
    { name: '用户登录', fn: testLogin },
    { name: '获取用户信息', fn: testGetProfile },
    { name: '更新用户资料', fn: testUpdateProfile },
    { name: '权限控制测试', fn: testPermissionDenied },
    { name: '令牌刷新', fn: testRefreshToken },
    { name: '用户登出', fn: testLogout }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      log(`❌ 测试 "${test.name}" 出现异常`, 'red');
      log(`   异常: ${error.message}`, 'red');
      failed++;
    }
    
    // 测试间隔
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  log('=====================================', 'yellow');
  log('🎯 测试完成统计', 'yellow');
  log(`✅ 通过: ${passed} 项`, 'green');
  log(`❌ 失败: ${failed} 项`, failed > 0 ? 'red' : 'green');
  log(`📊 成功率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`, 
      failed === 0 ? 'green' : 'yellow');
  
  if (failed === 0) {
    log('🎉 所有测试通过！Alcms API 运行正常！', 'green');
  } else {
    log('⚠️ 部分测试失败，请检查错误信息', 'yellow');
  }
}

/**
 * 主函数
 */
async function main() {
  // 检查是否安装了 axios
  try {
    require.resolve('axios');
  } catch (error) {
    log('❌ 缺少依赖包 axios', 'red');
    log('请运行: npm install axios', 'yellow');
    process.exit(1);
  }
  
  await runAllTests();
}

// 运行测试
if (require.main === module) {
  main().catch(error => {
    log('❌ 测试脚本异常', 'red');
    log(`异常信息: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  healthCheck,
  testRegister,
  testLogin,
  testGetProfile,
  testUpdateProfile,
  testPermissionDenied,
  testRefreshToken,
  testLogout,
  testApiDocs
};
