/**
 * 缓存调试工具
 * 用于诊断缓存相关问题
 */

const { cache } = require('./cache');
const { logger } = require('./logger');

class CacheDebugger {
  /**
   * 获取所有缓存键的详细信息
   */
  async getAllKeys() {
    try {
      if (cache.isConnected && cache.client) {
        const keys = await cache.client.keys('*');
        const result = {
          total: keys.length,
          keys: keys,
          patterns: this.groupKeysByPattern(keys)
        };

        console.log('=== 缓存键分析 ===');
        console.log(`总计: ${result.total} 个键`);
        console.log('\n=== 按模式分组 ===');
        Object.entries(result.patterns).forEach(([pattern, keys]) => {
          console.log(`${pattern}: ${keys.length} 个键`);
          keys.slice(0, 3).forEach(key => console.log(`  - ${key}`));
          if (keys.length > 3) console.log(`  ... 还有 ${keys.length - 3} 个`);
        });

        return result;
      } else if (cache.memoryCache) {
        const keys = Array.from(cache.memoryCache.keys());
        const result = {
          total: keys.length,
          keys: keys,
          patterns: this.groupKeysByPattern(keys)
        };

        console.log('=== 内存缓存键分析 ===');
        console.log(`总计: ${result.total} 个键`);
        console.log('\n=== 按模式分组 ===');
        Object.entries(result.patterns).forEach(([pattern, keys]) => {
          console.log(`${pattern}: ${keys.length} 个键`);
          keys.slice(0, 3).forEach(key => console.log(`  - ${key}`));
          if (keys.length > 3) console.log(`  ... 还有 ${keys.length - 3} 个`);
        });

        return result;
      }

      return { total: 0, keys: [], patterns: {} };
    } catch (error) {
      logger.error('获取缓存键失败:', error);
      return { total: 0, keys: [], patterns: {}, error: error.message };
    }
  }

  /**
   * 按模式分组键名
   */
  groupKeysByPattern(keys) {
    const patterns = {};

    keys.forEach(key => {
      // 提取前缀模式
      const parts = key.split(':');
      const pattern = parts.length > 1 ? `${parts[0]}:*` : key;

      if (!patterns[pattern]) {
        patterns[pattern] = [];
      }
      patterns[pattern].push(key);
    });

    return patterns;
  }

  /**
   * 测试缓存清理模式
   */
  async testClearPattern(pattern) {
    try {
      console.log(`\n=== 测试清理模式: ${pattern} ===`);

      // 获取匹配的键
      let matchedKeys = [];
      if (cache.isConnected && cache.client) {
        matchedKeys = await cache.client.keys(pattern);
      } else if (cache.memoryCache) {
        const regexPattern = pattern
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.')
          .replace(/\[([^\]]+)\]/g, '[$1]');
        const regex = new RegExp(`^${regexPattern}$`);

        matchedKeys = Array.from(cache.memoryCache.keys()).filter(key => regex.test(key));
      }

      console.log(`匹配到 ${matchedKeys.length} 个键:`);
      matchedKeys.forEach(key => console.log(`  - ${key}`));

      if (matchedKeys.length > 0) {
        console.log('\n执行删除...');
        const deleted = await cache.delByPattern(pattern);
        console.log(`删除结果: ${deleted ? '成功' : '失败'}`);

        // 验证删除结果
        let remainingKeys = [];
        if (cache.isConnected && cache.client) {
          remainingKeys = await cache.client.keys(pattern);
        } else if (cache.memoryCache) {
          const regexPattern = pattern
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.')
            .replace(/\[([^\]]+)\]/g, '[$1]');
          const regex = new RegExp(`^${regexPattern}$`);

          remainingKeys = Array.from(cache.memoryCache.keys()).filter(key => regex.test(key));
        }

        console.log(`验证: 剩余 ${remainingKeys.length} 个匹配键`);
        if (remainingKeys.length > 0) {
          console.log('剩余键:');
          remainingKeys.forEach(key => console.log(`  - ${key}`));
        }
      } else {
        console.log('没有匹配的键');
      }

      return { pattern, matchedKeys, success: matchedKeys.length === 0 || await cache.delByPattern(pattern) };
    } catch (error) {
      logger.error('测试缓存清理失败:', error);
      return { pattern, error: error.message, success: false };
    }
  }

  /**
   * 完整的缓存诊断
   */
  async diagnose() {
    console.log('\n🔍 开始缓存诊断...\n');

    // 1. 获取缓存连接状态
    console.log('=== 缓存连接状态 ===');
    console.log(`连接状态: ${cache.isConnected ? '已连接' : '未连接'}`);
    console.log(`缓存类型: ${cache.isConnected ? 'Redis' : '内存缓存'}`);

    // 2. 获取所有键
    const keysInfo = await this.getAllKeys();

    // 3. 测试常见的清理模式
    console.log('\n=== 测试清理模式 ===');
    const testPatterns = [
      'categories:*',
      'tags:*',
      'resources:*',
      'api:*',
      'user:*',
      'stats:*'
    ];

    for (const pattern of testPatterns) {
      const result = await this.testClearPattern(pattern);
      if (result.error) {
        console.log(`❌ ${pattern}: ${result.error}`);
      } else if (result.success) {
        console.log(`✅ ${pattern}: 清理成功`);
      } else {
        console.log(`⚠️ ${pattern}: 清理可能失败`);
      }
    }

    // 4. 缓存统计
    const stats = await cache.getStats();
    console.log('\n=== 缓存统计 ===');
    console.log(JSON.stringify(stats, null, 2));

    console.log('\n✅ 缓存诊断完成');

    return {
      connectionStatus: cache.isConnected,
      cacheType: cache.isConnected ? 'Redis' : 'Memory',
      keysInfo,
      stats
    };
  }

  /**
   * 清空所有缓存（危险操作）
   */
  async clearAll(confirm = false) {
    if (!confirm) {
      console.log('⚠️ 这是一个危险操作，会清空所有缓存数据');
      console.log('如果确认要执行，请传入 confirm=true 参数');
      return false;
    }

    try {
      console.log('🗑️ 正在清空所有缓存...');
      const result = await cache.flush();
      console.log(result ? '✅ 缓存清空成功' : '❌ 缓存清空失败');
      return result;
    } catch (error) {
      logger.error('清空缓存失败:', error);
      console.log('❌ 缓存清空失败:', error.message);
      return false;
    }
  }

  /**
   * 创建测试缓存数据
   */
  async createTestData() {
    console.log('📝 创建测试缓存数据...');

    const testData = [
      { key: 'categories:tree:false', value: { test: 'category tree data' } },
      { key: 'categories:list', value: { test: 'category list data' } },
      { key: 'tags:list:1:20', value: { test: 'tags list data' } },
      { key: 'tags:popular', value: { test: 'popular tags data' } },
      { key: 'resources:list:1:1:20:created_at:desc', value: { test: 'resources list data' } },
      { key: 'api:resources:list:anonymous:1:20', value: { test: 'api resources data' } },
      { key: 'user:profile:123', value: { test: 'user profile data' } },
      { key: 'stats:overview', value: { test: 'stats data' } }
    ];

    for (const { key, value } of testData) {
      await cache.set(key, value, 3600);
      console.log(`✅ 创建: ${key}`);
    }

    console.log('✅ 测试数据创建完成');
    return testData.length;
  }
}

// 如果直接运行此文件，执行诊断
if (require.main === module) {
  (async () => {
    await cache.initialize();
    const cacheDebugger = new CacheDebugger();

    // 检查命令行参数
    const args = process.argv.slice(2);

    if (args.includes('--clear-all')) {
      await cacheDebugger.clearAll(args.includes('--confirm'));
    } else if (args.includes('--create-test-data')) {
      await cacheDebugger.createTestData();
    } else if (args.includes('--test-pattern') && args[args.indexOf('--test-pattern') + 1]) {
      const pattern = args[args.indexOf('--test-pattern') + 1];
      await cacheDebugger.testClearPattern(pattern);
    } else {
      await cacheDebugger.diagnose();
    }

    await cache.close();
    process.exit(0);
  })().catch(console.error);
}

module.exports = CacheDebugger;