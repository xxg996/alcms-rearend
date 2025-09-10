# ALCMS 新功能使用指南

## 🚀 快速开始

### 1. 数据库迁移
```bash
# 执行所有新功能迁移
node database/migrate-all-new-features.js

# 或分别执行
node database/migrate-vip.js
node database/migrate-points-checkin.js
```

### 2. 系统健康检查
```bash
# 检查所有新功能模块状态
node scripts/system-health-check.js
```

### 3. 启动服务器
```bash
npm run dev
```

## 📋 新增功能模块

### 💎 VIP 会员系统
- **VIP等级管理**: 创建、编辑、删除VIP等级配置
- **用户VIP状态**: 设置、延长、取消用户VIP
- **无限期VIP**: 支持永久VIP设置（天数为0）
- **VIP订单记录**: 完整的购买和变更记录

**主要API**:
- `GET /api/vip/levels` - 获取VIP等级列表
- `GET /api/vip/my-info` - 获取我的VIP信息
- `POST /api/vip/users/{userId}/set` - 设置用户VIP（管理员）

### 🎫 卡密系统
- **卡密生成**: 支持单个和批量生成
- **多种类型**: VIP卡密、积分卡密
- **批次管理**: 批量生成和管理
- **状态跟踪**: 未使用/已使用/过期/禁用

**主要API**:
- `POST /api/card-keys/generate/batch` - 批量生成卡密（管理员）
- `POST /api/card-keys/redeem` - 兑换卡密
- `GET /api/card-keys/info/{code}` - 查询卡密信息

### 💰 积分系统
- **积分管理**: 用户积分获得、消费、转账
- **积分记录**: 详细的积分变更历史
- **排行榜**: 当前积分和历史总积分排行
- **管理功能**: 管理员调整、批量发放

**主要API**:
- `GET /api/points/my-info` - 获取我的积分信息
- `POST /api/points/transfer` - 积分转账
- `GET /api/points/leaderboard` - 积分排行榜

### ✅ 签到系统
- **每日签到**: 用户每日签到获得积分
- **连续奖励**: 连续签到额外奖励
- **配置管理**: 管理员配置签到奖励规则
- **统计排行**: 签到次数和连续天数排行

**主要API**:
- `POST /api/checkin/check` - 执行签到
- `GET /api/checkin/my-status` - 获取签到状态
- `GET /api/checkin/leaderboard` - 签到排行榜

## 🔐 权限控制

### 用户权限
- 卡密兑换
- 积分查看和转账
- 每日签到

### 管理员权限
- VIP等级管理
- 卡密生成和管理
- 积分调整和统计
- 签到配置管理

### 超级管理员权限
- 卡密删除
- 签到数据重置

## 📊 数据库表结构

### 新增表
- `vip_levels` - VIP等级配置
- `vip_orders` - VIP订单记录
- `card_keys` - 卡密管理
- `points_records` - 积分记录
- `checkin_configs` - 签到配置
- `user_checkins` - 用户签到记录

### 用户表新增字段
- `is_vip` - 是否为VIP
- `vip_level` - VIP等级
- `vip_expire_at` - VIP过期时间（NULL=无限期）
- `points` - 当前积分
- `total_points` - 历史总积分

## 🎯 使用示例

### 创建VIP等级
```json
POST /api/vip/levels
{
  "level": 1,
  "name": "vip1",
  "display_name": "VIP会员",
  "description": "基础VIP会员",
  "price": 99.00,
  "duration_days": 30
}
```

### 生成卡密
```json
POST /api/card-keys/generate/batch
{
  "type": "vip",
  "vip_level": 1,
  "vip_days": 30,
  "count": 100
}
```

### 兑换卡密
```json
POST /api/card-keys/redeem
{
  "code": "ABCD-EFGH-IJKL-MNOP"
}
```

### 积分转账
```json
POST /api/points/transfer
{
  "to_user_id": 123,
  "amount": 100,
  "description": "转账给朋友"
}
```

### 创建签到配置
```json
POST /api/checkin/configs
{
  "name": "春节活动签到",
  "description": "春节期间双倍奖励",
  "daily_points": 20,
  "consecutive_bonus": {
    "7": 50,
    "15": 100,
    "30": 200
  }
}
```

## 🔧 系统配置

### 环境变量
确保在 `.env` 文件中配置了正确的数据库连接信息：
```env
PGHOST=localhost
PGPORT=5432
PGDATABASE=alcms
PGUSER=alcms_user
PGPASSWORD=Alcms2024!
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
```

### 默认配置
系统会自动创建默认签到配置：
- 每日签到：10积分
- 连续7天：额外20积分
- 连续15天：额外50积分
- 连续30天：额外100积分

## 📚 API 文档

访问 `http://localhost:3000/docs/swagger.yaml` 查看完整的API文档，或使用Swagger UI进行交互式测试。

## 🎉 完成！

现在您的ALCMS系统已经具备了完整的VIP、卡密、积分和签到功能！用户可以通过签到获得积分，使用卡密兑换VIP或积分，享受完整的会员权益体系。
