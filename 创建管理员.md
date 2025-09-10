# 🔑 管理员账户设置指南

## 📋 默认管理员账户信息

系统已创建默认管理员账户，用于初始系统管理：

```
用户名: admin
邮箱: admin@alcms.com
密码: admin123
角色: 系统管理员
权限数量: 16个（拥有所有系统权限）
```

## 🚀 快速验证

### 1. 登录测试
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@alcms.com",
    "password": "admin123"
  }'
```

### 2. 权限验证
使用返回的访问令牌测试管理员权限：
```bash
# 获取用户列表（需要管理员权限）
curl -X GET "http://localhost:3000/api/users" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 获取用户统计（需要管理员权限）
curl -X GET "http://localhost:3000/api/users/stats" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 🛠️ 管理员功能

### 用户管理
- ✅ 查看所有用户列表（分页、搜索、过滤）
- ✅ 获取用户详细信息
- ✅ 更新用户状态（封禁/冻结/解封）
- ✅ 分配和移除用户角色
- ✅ 查看用户统计信息

### 权限控制
管理员拥有以下权限：
- `user:read` - 查看用户信息
- `user:update` - 更新用户信息
- `profile:update` - 更新个人资料
- `content:create_advanced` - 创建高级内容
- `feature:vip_access` - 访问VIP功能
- `content:moderate` - 内容审核
- `user:warn` - 警告用户
- `report:handle` - 处理举报
- `user:list` - 查看用户列表
- `user:ban` - 封禁用户
- `user:unban` - 解封用户
- `user:freeze` - 冻结用户
- `user:unfreeze` - 解冻用户
- `role:assign` - 分配角色
- `permission:manage` - 权限管理
- `system:configure` - 系统配置

## 🔧 创建额外管理员

### 方法一：使用脚本
```bash
# 重新运行管理员创建脚本（如果需要重置）
npm run create-admin
```

### 方法二：通过API
1. 使用现有管理员账户登录
2. 注册新用户账户
3. 为新用户分配管理员角色：
```bash
curl -X POST http://localhost:3000/api/users/{userId}/roles \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"roleName": "admin"}'
```

## 🔒 安全配置建议

### 立即执行（生产环境）
1. **修改默认密码**
   ```bash
   # 通过API修改密码（待实现密码修改接口）
   # 或直接在数据库中更新password_hash
   ```

2. **更改管理员邮箱**
   ```sql
   UPDATE users SET email = 'your-admin@yourdomain.com' 
   WHERE username = 'admin';
   ```

3. **限制管理员登录IP**
   - 配置防火墙规则
   - 修改安全中间件添加IP白名单

### 推荐安全措施
1. **启用更强的密码策略**
   - 密码长度至少12位
   - 包含大小写字母、数字、特殊字符
   - 定期强制修改密码

2. **会话管理**
   - 缩短管理员令牌有效期
   - 启用自动登出机制
   - 监控异常登录活动

3. **审计日志**
   - 记录所有管理员操作
   - 定期审查访问日志
   - 设置敏感操作告警

## 📊 Postman 测试

### 导入管理员登录示例
1. 将 `postman/Admin-Login-Example.json` 导入到Postman
2. 或使用现有集合中的登录接口，修改为管理员凭据
3. 登录后自动保存管理员令牌到环境变量

### 管理员权限测试流程
1. **登录管理员账户** → 获取令牌
2. **获取用户列表** → 验证用户管理权限
3. **查看用户统计** → 验证数据统计权限
4. **更新用户状态** → 验证用户状态管理权限
5. **分配用户角色** → 验证角色管理权限

## 🚨 故障排除

### 登录失败
- 检查用户名和密码是否正确
- 确认管理员账户状态为 'normal'
- 验证管理员角色是否正确分配

### 权限不足
- 确认用户拥有管理员角色
- 检查角色权限关联表数据
- 验证JWT令牌有效性

### 数据库检查
```sql
-- 检查管理员用户
SELECT u.*, ur.role_id, r.name as role_name 
FROM users u 
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.username = 'admin';

-- 检查管理员权限数量
SELECT COUNT(*) as permission_count
FROM permissions p
JOIN role_permissions rp ON p.id = rp.permission_id
JOIN roles r ON rp.role_id = r.id
WHERE r.name = 'admin';
```

## 📞 技术支持

如遇问题，请检查：
1. 后端服务运行状态
2. 数据库连接配置
3. 环境变量设置
4. 日志文件错误信息

---

**管理员账户配置完成，请确保生产环境的安全配置！** 🛡️
