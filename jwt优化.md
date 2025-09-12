# JWT 安全配置指南

## 🔒 安全修复完成

本项目的 JWT 密钥硬编码安全漏洞已修复。以下是安全改进摘要：

### ✅ 已修复问题

1. **强密钥替换**: 使用 `openssl rand -base64 64` 生成的 512 位安全密钥
2. **移除弱回退**: 消除了 `'default-secret'` 等不安全的回退值
3. **环境验证**: 添加启动时的密钥安全验证
4. **安全工具**: 创建 JWT 安全管理工具类

### 🛠️ 修改的文件

- ✏️ `.env` - 更新为安全的密钥
- ✏️ `.env.example` - 添加安全生成指导
- ✏️ `src/utils/downloadUtils.js` - 移除不安全回退值
- ✏️ `src/app.js` - 添加启动时安全验证
- ➕ `src/utils/secureJwt.js` - 新增安全管理工具

---

## 🔑 JWT 密钥管理最佳实践

### 密钥生成
```bash
# 生成访问令牌密钥
openssl rand -base64 64

# 生成刷新令牌密钥  
openssl rand -base64 64
```

### 环境变量配置
```env
# .env 文件
JWT_SECRET=your_base64_encoded_access_key_here
JWT_REFRESH_SECRET=your_base64_encoded_refresh_key_here
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
```

### 安全要求
- ✅ 密钥长度至少 32 字符（推荐 64+ 字符）
- ✅ 使用加密学安全的随机生成器
- ✅ 访问和刷新密钥必须不同
- ✅ 不包含常见弱模式（如 "secret", "password"）
- ✅ 定期轮换密钥

---

## 🚀 生产环境部署检查清单

### 部署前必须完成
- [ ] 生成新的生产环境密钥
- [ ] 验证 `.env` 文件不在版本控制中
- [ ] 确认密钥强度（使用 `src/utils/secureJwt.js` 验证）
- [ ] 配置密钥管理服务（推荐）

### 推荐的密钥管理服务
- **AWS Secrets Manager**: 自动轮换、访问控制
- **Azure Key Vault**: 密钥版本控制、审计日志
- **HashiCorp Vault**: 动态密钥、细粒度权限
- **Docker Secrets**: 容器化环境密钥管理

---

## 🔧 高级安全配置

### 1. 密钥轮换自动化

```javascript
// 生产环境推荐：定期密钥轮换
const { generateSecureKeys } = require('./src/utils/secureJwt');

// 每月执行一次密钥轮换
setInterval(() => {
  const newKeys = generateSecureKeys();
  // 更新密钥存储服务
  updateKeysInVault(newKeys);
}, 30 * 24 * 60 * 60 * 1000); // 30天
```

### 2. 密钥分离存储

```bash
# 推荐：将密钥存储在外部服务中
# 而不是本地 .env 文件

# 使用环境变量注入
export JWT_SECRET=$(aws secretsmanager get-secret-value --secret-id jwt-access-key --query SecretString --output text)
```

### 3. 监控和审计

```javascript
// 添加 JWT 使用监控
const jwtUsageMonitor = require('./monitoring/jwtMonitor');

// 记录每次密钥使用
jwtUsageMonitor.log({
  action: 'token_generation',
  userId: user.id,
  timestamp: Date.now(),
  keyUsed: 'access'
});
```

---

## ⚠️ 安全警告

### 绝对禁止
❌ 在代码中硬编码 JWT 密钥  
❌ 在日志中输出完整密钥  
❌ 在客户端代码中暴露密钥  
❌ 在版本控制中提交 `.env` 文件  
❌ 在生产环境使用开发密钥  

### 立即行动项
🚨 如果发现密钥泄露：
1. 立即轮换所有 JWT 密钥
2. 撤销所有现有令牌
3. 强制用户重新登录
4. 审计访问日志

---

## 🔍 安全验证命令

```bash
# 验证JWT安全配置
node -e "
require('dotenv').config();
require('./src/utils/secureJwt');
console.log('✅ JWT安全配置验证通过');
"

# 测试令牌功能
node -e "
require('dotenv').config();
const jwt = require('./src/utils/jwt');
const token = jwt.generateAccessToken({userId: 1});
jwt.verifyAccessToken(token);
console.log('✅ JWT功能测试通过');
"
```

---

## 📋 定期安全审查

### 每月检查
- [ ] 验证密钥强度
- [ ] 检查密钥是否泄露
- [ ] 审查令牌使用日志
- [ ] 更新依赖项版本

### 每季度检查
- [ ] 轮换所有 JWT 密钥
- [ ] 安全漏洞扫描
- [ ] 渗透测试
- [ ] 更新安全策略

---

**修复完成时间**: 2025-09-11  
**下次安全审查**: 2025-10-11  
**密钥轮换计划**: 每3个月  

*请将此文档保存在安全的位置，定期更新安全配置。*