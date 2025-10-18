-- ============================================================================
-- ALCMS (Advanced Learning Content Management System) 数据库安装脚本
-- 版本: 1.0.0
-- 创建时间: 2025-09-20
-- 描述: 完整的数据库结构和初始数据安装脚本
-- ============================================================================

-- 设置字符编码和基本配置
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- 开始事务
BEGIN;

-- ============================================================================
-- 数据库函数定义
-- ============================================================================

-- 更新社区内容时间戳的触发器函数
CREATE OR REPLACE FUNCTION update_community_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- 更新收藏统计的触发器函数
CREATE OR REPLACE FUNCTION update_favorite_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE community_posts SET favorite_count = favorite_count + 1 WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE community_posts SET favorite_count = favorite_count - 1 WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- 更新点赞统计的触发器函数
CREATE OR REPLACE FUNCTION update_like_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.target_type = 'post' THEN
            UPDATE community_posts SET like_count = like_count + 1 WHERE id = NEW.target_id;
        ELSIF NEW.target_type = 'comment' THEN
            UPDATE community_comments SET like_count = like_count + 1 WHERE id = NEW.target_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.target_type = 'post' THEN
            UPDATE community_posts SET like_count = like_count - 1 WHERE id = OLD.target_id;
        ELSIF OLD.target_type = 'comment' THEN
            UPDATE community_comments SET like_count = like_count - 1 WHERE id = OLD.target_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- 检查子评论数量限制的触发器函数
CREATE OR REPLACE FUNCTION check_subcomment_limit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- 如果是子评论（parent_id不为空）
    IF NEW.parent_id IS NOT NULL THEN
        -- 检查该父评论下的子评论数量
        IF (SELECT COUNT(*) FROM resource_comments WHERE parent_id = NEW.parent_id) >= 999 THEN
            RAISE EXCEPTION '父评论下的子评论数量不能超过999条';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 更新资源评论时间戳的触发器函数
CREATE OR REPLACE FUNCTION update_resource_comment_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- 核心表结构 - 用户管理
-- ============================================================================

-- 用户表
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(100),
    avatar_url VARCHAR(500),
    bio TEXT,
    status VARCHAR(20) DEFAULT 'normal' CHECK (status IN ('normal', 'banned', 'frozen')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- VIP相关字段
    is_vip BOOLEAN DEFAULT FALSE,
    vip_level INTEGER DEFAULT 0,
    vip_expire_at TIMESTAMP,
    vip_activated_at TIMESTAMP,

    -- 积分系统
    points INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,

    -- 邀请与佣金体系
    referral_code VARCHAR(32) UNIQUE,
    inviter_id INTEGER REFERENCES users(id),
    invited_at TIMESTAMP,
    commission_balance DECIMAL(12,2) DEFAULT 0,
    total_commission_earned DECIMAL(12,2) DEFAULT 0,
    commission_pending_balance DECIMAL(12,2) DEFAULT 0,

    -- 下载限制
    daily_download_limit INTEGER DEFAULT 10,
    daily_downloads_used INTEGER DEFAULT 0,
    last_download_reset_date DATE DEFAULT CURRENT_DATE,

    -- 下载增益余额
    download_credit_balance INTEGER DEFAULT 0
);

-- 角色表
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 权限表
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 角色权限关联表
CREATE TABLE role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);

-- 用户角色关联表
CREATE TABLE user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(id),
    UNIQUE(user_id, role_id)
);

-- 用户邀请关系表
CREATE TABLE user_referrals (
    id SERIAL PRIMARY KEY,
    inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referral_code VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(invitee_id),
    UNIQUE(inviter_id, invitee_id)
);

CREATE INDEX idx_user_referrals_inviter ON user_referrals(inviter_id);

-- 系统设置表
CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id)
);

INSERT INTO system_settings (key, value, description) VALUES
('referral_commission', '{"enabled": true, "first_rate": 0.10, "renewal_rate": 0.00, "card_type_rates": {"points": 0.10, "download": 0.10}}', '邀请分佣配置');

-- ============================================================================
-- 资源管理模块
-- ============================================================================

-- 资源类型表
CREATE TABLE resource_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    mime_types TEXT[],
    max_file_size BIGINT,
    is_streamable BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 分类表
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES categories(id),
    sort_order INTEGER DEFAULT 0,
    icon_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 标签表
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 资源主表 (已优化，移除软删除)
CREATE TABLE resources (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    description TEXT,
    content TEXT,
    summary VARCHAR(500),
    category_id INTEGER REFERENCES categories(id),
    resource_type_id INTEGER NOT NULL REFERENCES resource_types(id),
    cover_image_url VARCHAR(500),
    is_public BOOLEAN DEFAULT TRUE,
    is_free BOOLEAN DEFAULT TRUE,
    required_points INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived', 'banned', 'deleted')),
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    author_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP
);

-- 资源文件表 (保留软删除)
CREATE TABLE resource_files (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    file_size BIGINT DEFAULT 0,
    file_type VARCHAR(100),
    file_extension VARCHAR(10),
    quality VARCHAR(20),
    version VARCHAR(20),
    language VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    download_count BIGINT DEFAULT 0,
    last_downloaded_at TIMESTAMP,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 资源标签关联表
CREATE TABLE resource_tags (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(resource_id, tag_id)
);

-- 资源举报表
CREATE TABLE resource_reports (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    reporter_id INTEGER NOT NULL REFERENCES users(id),
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    handled_by INTEGER REFERENCES users(id),
    handled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 资源评论表 (支持层级评论)
CREATE TABLE resource_comments (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id INTEGER DEFAULT NULL REFERENCES resource_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 社区模块
-- ============================================================================

-- 社区版块表
CREATE TABLE community_boards (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url VARCHAR(500),
    cover_image_url VARCHAR(500),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    post_count INTEGER DEFAULT 0,
    last_post_id INTEGER,
    last_post_time TIMESTAMPTZ,
    moderator_ids INTEGER[] DEFAULT '{}'::integer[],
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 社区帖子表
CREATE TABLE community_posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'markdown',
    summary VARCHAR(500),
    author_id INTEGER NOT NULL REFERENCES users(id),
    board_id INTEGER NOT NULL REFERENCES community_boards(id),
    status VARCHAR(20) DEFAULT 'published',
    is_pinned BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    favorite_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    last_reply_id INTEGER,
    last_reply_time TIMESTAMPTZ,
    last_reply_user_id INTEGER REFERENCES users(id),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 社区帖子标签关联表
CREATE TABLE community_post_tags (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, tag_id)
);

-- 社区评论表 (保留软删除)
CREATE TABLE community_comments (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    author_id INTEGER NOT NULL REFERENCES users(id),
    post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES community_comments(id),
    reply_to_user_id INTEGER REFERENCES users(id),
    floor_number INTEGER,
    like_count INTEGER DEFAULT 0,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_reason VARCHAR(255),
    deleted_by INTEGER REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 社区点赞表
CREATE TABLE community_likes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('post', 'comment')),
    target_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, target_type, target_id)
);

-- 社区收藏表
CREATE TABLE community_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id)
);

-- 社区分享表
CREATE TABLE community_shares (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    share_platform VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 社区举报表
CREATE TABLE community_reports (
    id SERIAL PRIMARY KEY,
    reporter_id INTEGER NOT NULL REFERENCES users(id),
    target_type VARCHAR(50) NOT NULL,
    target_id INTEGER NOT NULL,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    handler_id INTEGER,
    handler_note TEXT,
    handled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 社区处罚表
CREATE TABLE community_punishments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    punishment_type VARCHAR(50) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    description TEXT,
    duration_hours INTEGER,
    operator_id INTEGER NOT NULL REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 社区通知表
CREATE TABLE community_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    related_type VARCHAR(50),
    related_id INTEGER,
    sender_id INTEGER,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_community_notifications_user ON community_notifications(user_id, created_at DESC);
CREATE INDEX idx_community_notifications_user_type ON community_notifications(user_id, type);
CREATE INDEX idx_community_notifications_user_read ON community_notifications(user_id, is_read);

-- 社区用户统计表
CREATE TABLE community_user_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    like_given_count INTEGER DEFAULT 0,
    like_received_count INTEGER DEFAULT 0,
    favorite_count INTEGER DEFAULT 0,
    follower_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    reputation_score INTEGER DEFAULT 0,
    last_post_time TIMESTAMPTZ,
    last_comment_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- ============================================================================
-- 用户行为跟踪 (历史数据表，无外键约束)
-- ============================================================================

-- 用户积分记录表
CREATE TABLE user_points (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    points INTEGER NOT NULL,
    reason VARCHAR(255) NOT NULL,
    resource_id INTEGER, -- 保留resource_id用于历史记录，无外键约束
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 下载记录表
CREATE TABLE download_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    resource_id INTEGER NOT NULL, -- 保留resource_id用于历史记录，无外键约束
    ip_address INET,
    user_agent TEXT,
    download_url VARCHAR(500),
    expires_at TIMESTAMP,
    is_successful BOOLEAN DEFAULT FALSE,
    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 每日购买记录表
CREATE TABLE daily_purchases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    resource_id INTEGER NOT NULL, -- 保留resource_id用于历史记录，无外键约束
    points_cost INTEGER NOT NULL,
    purchase_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, resource_id, purchase_date)
);

-- 用户收藏表
CREATE TABLE user_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_id INTEGER NOT NULL, -- 保留resource_id用于历史记录，无外键约束
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, resource_id)
);

-- ============================================================================
-- VIP和积分系统
-- ============================================================================

-- VIP等级表
CREATE TABLE vip_levels (
    id SERIAL PRIMARY KEY,
    level INTEGER NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    benefits JSON DEFAULT '{}'::json,
    price NUMERIC DEFAULT 0.00,
    purchase_url VARCHAR(500),
    duration_days INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    daily_download_limit INTEGER DEFAULT 50
);

-- 订单表（包含VIP订单与卡密订单等）
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    vip_level INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    duration_days INTEGER NOT NULL,
    expire_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'expired')),
    payment_method VARCHAR(50),
    order_no VARCHAR(100) NOT NULL,
    card_key_code VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(order_no)
);

-- 邀请佣金记录表
CREATE TABLE referral_commissions (
    id SERIAL PRIMARY KEY,
    inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_amount DECIMAL(12,2) NOT NULL,
    commission_amount DECIMAL(12,2) NOT NULL,
    commission_rate DECIMAL(6,4) NOT NULL,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('first_recharge', 'renewal')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'no_include')),
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMP,
    UNIQUE(order_id)
);

CREATE INDEX idx_referral_commissions_inviter ON referral_commissions(inviter_id);
CREATE INDEX idx_referral_commissions_invitee ON referral_commissions(invitee_id);
CREATE INDEX idx_referral_commissions_order ON referral_commissions(order_id);

CREATE TABLE referral_payout_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    method VARCHAR(20) NOT NULL CHECK (method IN ('alipay', 'usdt')),
    account VARCHAR(255) NOT NULL,
    account_name VARCHAR(100),
    extra JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id)
);

CREATE INDEX idx_referral_payout_settings_user ON referral_payout_settings(user_id);

CREATE TABLE referral_payout_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    method VARCHAR(20) NOT NULL CHECK (method IN ('alipay', 'usdt')),
    account VARCHAR(255) NOT NULL,
    account_name VARCHAR(100),
    extra JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    requested_notes TEXT,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by INTEGER REFERENCES users(id),
    paid_at TIMESTAMP
);

CREATE INDEX idx_referral_payout_requests_user ON referral_payout_requests(user_id);
CREATE INDEX idx_referral_payout_requests_status ON referral_payout_requests(status);

-- 卡密表
CREATE TABLE card_keys (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(20) DEFAULT 'vip' CHECK (type IN ('vip', 'points', 'days', 'download')),
    vip_level INTEGER DEFAULT 1,
    vip_days INTEGER DEFAULT 30,
    points INTEGER DEFAULT 0,
    download_credits INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'unused' CHECK (status IN ('unused', 'used', 'expired', 'disabled')),
    used_by INTEGER REFERENCES users(id),
    used_at TIMESTAMP,
    expire_at TIMESTAMP,
    batch_id VARCHAR(100),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    value_amount NUMERIC(10,2) DEFAULT 0
);

-- 积分商品表
CREATE TABLE points_products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'virtual',
    points_cost INTEGER NOT NULL,
    stock INTEGER DEFAULT -1,
    is_active BOOLEAN DEFAULT TRUE,
    image_url VARCHAR(255),
    details JSON DEFAULT '{}'::json,
    tags TEXT[] DEFAULT '{}'::text[],
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE virtual_product_items (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES points_products(id) ON DELETE CASCADE,
    code VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','used','disabled')),
    redeemed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    redeemed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (product_id, code)
);

-- 积分兑换记录表
CREATE TABLE points_exchanges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES points_products(id) ON DELETE CASCADE,
    points_cost INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    total_points INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    exchange_data JSON DEFAULT '{}'::json,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 积分记录表
CREATE TABLE points_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL,
    source VARCHAR(50) NOT NULL,
    description TEXT,
    related_id INTEGER,
    related_type VARCHAR(50),
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 签到系统
-- ============================================================================

-- 签到配置表
CREATE TABLE checkin_configs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    daily_points INTEGER DEFAULT 10,
    consecutive_bonus JSON DEFAULT '{}'::json,
    monthly_reset BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 签到配置角色表
CREATE TABLE checkin_config_roles (
    id SERIAL PRIMARY KEY,
    checkin_config_id INTEGER NOT NULL REFERENCES checkin_configs(id) ON DELETE CASCADE,
    role_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    UNIQUE(checkin_config_id, role_name)
);

-- 用户签到记录表
CREATE TABLE user_checkins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
    consecutive_days INTEGER DEFAULT 1,
    points_earned INTEGER DEFAULT 0,
    is_bonus BOOLEAN DEFAULT FALSE,
    bonus_points INTEGER DEFAULT 0,
    config_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, checkin_date)
);

-- ============================================================================
-- 系统管理
-- ============================================================================

-- 刷新令牌表
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN DEFAULT FALSE
);

-- 数据库迁移记录表
CREATE TABLE schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL UNIQUE,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

-- ============================================================================
-- 索引创建
-- ============================================================================

-- 用户相关索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_is_vip ON users(is_vip);
CREATE INDEX idx_users_inviter_id ON users(inviter_id);

-- 资源相关索引
CREATE INDEX idx_resources_author_id ON resources(author_id);
CREATE INDEX idx_resources_category_id ON resources(category_id);
CREATE INDEX idx_resources_resource_type_id ON resources(resource_type_id);
CREATE INDEX idx_resources_status ON resources(status);
CREATE INDEX idx_resources_is_public ON resources(is_public);
CREATE INDEX idx_resources_created_at ON resources(created_at);
CREATE INDEX idx_resources_view_count ON resources(view_count);
CREATE INDEX idx_resources_download_count ON resources(download_count);

-- 资源评论相关索引
CREATE INDEX idx_resource_comments_resource ON resource_comments(resource_id);
CREATE INDEX idx_resource_comments_user ON resource_comments(user_id);
CREATE INDEX idx_resource_comments_parent ON resource_comments(parent_id);
CREATE INDEX idx_resource_comments_approved ON resource_comments(is_approved);
CREATE INDEX idx_resource_comments_created ON resource_comments(created_at);
CREATE INDEX idx_resource_comments_resource_parent ON resource_comments(resource_id, parent_id);

-- 分类相关索引
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_is_active ON categories(is_active);

-- 角色/用户附加索引
CREATE INDEX idx_roles_is_active ON roles(is_active);
CREATE INDEX idx_users_vip_level ON users(vip_level);
CREATE INDEX idx_users_vip_expire_at ON users(vip_expire_at);
CREATE INDEX idx_users_points ON users(points);
CREATE INDEX idx_users_total_points ON users(total_points);
CREATE INDEX idx_users_download_reset_date ON users(last_download_reset_date);

-- 角色/权限关联索引
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- 用户登录日志表
CREATE TABLE user_login_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    identifier VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failure')),
    failure_reason TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_login_logs_user_id ON user_login_logs(user_id);
CREATE INDEX idx_user_login_logs_status ON user_login_logs(status);
CREATE INDEX idx_user_login_logs_login_at ON user_login_logs(login_at);

-- 系统操作日志表
CREATE TABLE system_operation_logs (
    id SERIAL PRIMARY KEY,
    operator_id INTEGER REFERENCES users(id),
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    summary TEXT,
    detail JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sys_op_logs_operator ON system_operation_logs(operator_id);
CREATE INDEX idx_sys_op_logs_target ON system_operation_logs(target_type, target_id);
CREATE INDEX idx_sys_op_logs_action ON system_operation_logs(action);
CREATE INDEX idx_sys_op_logs_created ON system_operation_logs(created_at);

-- 积分操作日志（与 points_records 对应，方便审计）
CREATE TABLE points_audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operator_id INTEGER REFERENCES users(id),
    change_amount INTEGER NOT NULL,
    balance_before INTEGER,
    balance_after INTEGER,
    source VARCHAR(50) NOT NULL,
    description TEXT,
    related_id VARCHAR(100),
    related_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_points_audit_user ON points_audit_logs(user_id);
CREATE INDEX idx_points_audit_operator ON points_audit_logs(operator_id);
CREATE INDEX idx_points_audit_source ON points_audit_logs(source);
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);

-- 刷新令牌索引
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- VIP订单索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_no ON orders(order_no);

-- 社区相关索引
CREATE INDEX idx_community_posts_board_id ON community_posts(board_id);
CREATE INDEX idx_community_posts_author_id ON community_posts(author_id);
CREATE INDEX idx_community_posts_status ON community_posts(status);
CREATE INDEX idx_community_posts_created_at ON community_posts(created_at);

CREATE INDEX idx_community_comments_post_id ON community_comments(post_id);
CREATE INDEX idx_community_comments_author_id ON community_comments(author_id);
CREATE INDEX idx_community_comments_parent_id ON community_comments(parent_id);
CREATE INDEX idx_community_comments_is_deleted ON community_comments(is_deleted);

-- 行为跟踪索引
CREATE INDEX idx_download_records_user_id ON download_records(user_id);
CREATE INDEX idx_download_records_resource_id ON download_records(resource_id);
CREATE INDEX idx_download_records_created_at ON download_records(created_at);

CREATE INDEX idx_user_points_user_id ON user_points(user_id);
CREATE INDEX idx_user_points_resource_id ON user_points(resource_id);
CREATE INDEX idx_user_points_created_at ON user_points(created_at);

-- 积分产品/记录/兑换 索引
CREATE INDEX idx_points_products_active ON points_products(is_active);
CREATE INDEX idx_points_products_type ON points_products(type);
CREATE INDEX idx_points_products_cost ON points_products(points_cost);
CREATE INDEX idx_points_products_tags ON points_products USING GIN (tags);
CREATE INDEX idx_resources_fulltext ON resources USING GIN (
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
);
CREATE INDEX idx_virtual_product_items_product_status ON virtual_product_items(product_id, status);

CREATE TRIGGER update_virtual_product_items_updated_at
  BEFORE UPDATE ON virtual_product_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_points_records_user_id ON points_records(user_id);
CREATE INDEX idx_points_records_type ON points_records(type);
CREATE INDEX idx_points_records_source ON points_records(source);
CREATE INDEX idx_points_records_created_at ON points_records(created_at);
CREATE INDEX idx_points_records_related ON points_records(related_type, related_id);
CREATE INDEX idx_points_exchanges_user_id ON points_exchanges(user_id);
CREATE INDEX idx_points_exchanges_product_id ON points_exchanges(product_id);
CREATE INDEX idx_points_exchanges_status ON points_exchanges(status);

-- ============================================================================
-- 触发器创建
-- ============================================================================

-- 社区帖子更新时间触发器
CREATE TRIGGER trigger_community_posts_updated_at
    BEFORE UPDATE ON community_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_community_updated_at();

-- 社区评论更新时间触发器
CREATE TRIGGER trigger_community_comments_updated_at
    BEFORE UPDATE ON community_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_community_updated_at();

-- 社区收藏统计触发器
CREATE TRIGGER trigger_community_favorites_stats
    AFTER INSERT OR DELETE ON community_favorites
    FOR EACH ROW
    EXECUTE FUNCTION update_favorite_stats();

-- 社区点赞统计触发器
CREATE TRIGGER trigger_community_likes_stats
    AFTER INSERT OR DELETE ON community_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_like_stats();

-- 资源评论子评论数量限制触发器
CREATE TRIGGER trigger_check_subcomment_limit
    BEFORE INSERT ON resource_comments
    FOR EACH ROW
    EXECUTE FUNCTION check_subcomment_limit();

-- 资源评论更新时间触发器
CREATE TRIGGER update_resource_comments_updated_at
    BEFORE UPDATE ON resource_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_resource_comment_updated_at();

-- ============================================================================
-- 默认数据插入
-- ============================================================================

-- 插入默认角色
INSERT INTO roles (name, display_name, description) VALUES
('admin', '管理员', '系统管理员，具有最高权限'),
('moderator', '版主', '版主用户，具有内容管理权限'),
('vip', 'VIP用户', 'VIP用户，享有高级功能权限'),
('user', '普通用户', '系统普通用户，具有基本功能权限');

-- 插入默认权限（覆盖应用所需全量项，含点号/冒号两种命名）
INSERT INTO permissions (name, display_name, description, resource, action) VALUES
-- 系统管理
('system:configure', '系统配置', '配置系统参数和设置', 'system', 'configure'),
('system:maintenance', '系统维护', '执行系统维护操作', 'system', 'maintenance'),
('system:manage', '系统管理', '管理系统设置和重置操作', 'system', 'manage'),

-- 用户与角色权限
('user:create', '创建用户', '创建新用户账户', 'user', 'create'),
('user:read', '查看用户', '查看用户信息', 'user', 'read'),
('user:update', '更新用户', '更新用户信息', 'user', 'update'),
('user:delete', '删除用户', '删除用户账户', 'user', 'delete'),
('user:list', '查看用户列表', '查看所有用户信息', 'user', 'list'),
('user:ban', '封禁用户', '封禁违规用户账号', 'user', 'ban'),
('user:unban', '解封用户', '解除用户账号封禁', 'user', 'unban'),
('user:freeze', '冻结用户', '临时冻结用户账号', 'user', 'freeze'),
('user:unfreeze', '解冻用户', '解除用户账号冻结', 'user', 'unfreeze'),
('user:warn', '警告用户', '对违规用户发出警告', 'user', 'warn'),
('profile:update', '更新个人资料', '更新头像、昵称、简介等', 'profile', 'update'),
('role:assign', '分配角色', '为用户分配或移除角色', 'role', 'assign'),
('permission:manage', '权限管理', '管理系统权限配置', 'permission', 'manage'),

-- 资源权限（冒号与点号两套，以兼容代码使用）
('resource:create', '创建资源', '创建和发布资源内容', 'resource', 'create'),
('resource:read', '查看资源', '查看资源详情和列表', 'resource', 'read'),
('resource:update', '编辑资源', '编辑资源内容和信息', 'resource', 'update'),
('resource:delete', '删除资源', '删除资源内容', 'resource', 'delete'),
('resource:publish', '发布资源', '发布和下架资源', 'resource', 'publish'),
('resource:download', '下载资源', '下载资源文件', 'resource', 'download'),


-- 分类与标签
('category:create', '创建分类', '创建资源分类', 'category', 'create'),
('category:read', '查看分类', '查看分类信息', 'category', 'read'),
('category:update', '编辑分类', '编辑分类信息', 'category', 'update'),
('category:delete', '删除分类', '删除资源分类', 'category', 'delete'),
('tag:create', '创建标签', '创建资源标签', 'tag', 'create'),
('tag:read', '查看标签', '查看标签信息', 'tag', 'read'),
('tag:update', '编辑标签', '编辑标签信息', 'tag', 'update'),
('tag:delete', '删除标签', '删除资源标签', 'tag', 'delete'),

-- 社区权限（点号命名，覆盖发帖/评论/互动/管理）
('community:post:create', '发布帖子', '在社区中发布新帖子', 'community_posts', 'create'),
('community:post:edit_own', '编辑自己的帖子', '编辑自己发布的帖子', 'community_posts', 'edit'),
('community:post:delete_own', '删除自己的帖子', '删除自己发布的帖子', 'community_posts', 'delete'),
('community:post:edit_any', '编辑任意帖子', '编辑任意用户的帖子', 'community_posts', 'edit'),
('community:post:delete_any', '删除任意帖子', '删除任意用户的帖子', 'community_posts', 'delete'),
('community:post:pin', '置顶帖子', '设置帖子置顶', 'community_posts', 'manage'),
('community:post:feature', '设置精华帖', '设置帖子为精华', 'community_posts', 'manage'),
('community:post:lock', '锁定帖子', '锁定帖子禁止回复', 'community_posts', 'manage'),
('community:comment:create', '发表评论', '在帖子下发表评论', 'community_comments', 'create'),
('community:comment:edit_own', '编辑自己的评论', '编辑自己的评论', 'community_comments', 'edit'),
('community:comment:delete_own', '删除自己的评论', '删除自己的评论', 'community_comments', 'delete'),
('community:comment:delete_any', '删除任意评论', '删除任意用户的评论', 'community_comments', 'delete'),
('community:like', '点赞功能', '对帖子和评论点赞', 'community_likes', 'create'),
('community:favorite', '收藏功能', '收藏帖子', 'community_favorites', 'create'),
('community:share', '分享功能', '分享帖子到外部平台', 'community_shares', 'create'),
('community:report', '举报功能', '举报违规内容', 'community_reports', 'create'),
('community:report:handle', '处理举报', '处理用户举报内容', 'community_reports', 'manage'),
('community:moderate', '社区管理', '社区内容审核管理', 'community', 'manage'),
('community:punish', '违规处罚', '对违规用户进行处罚', 'community_punishments', 'manage'),
('community:board:manage', '板块管理', '管理社区板块', 'community_boards', 'manage'),
('community:bypass_review', '免审核', '发布内容无需审核', 'community', 'special'),
('community:admin', '社区管理员', '完整的社区管理权限', 'community', 'admin'),

-- 举报/评价/下载
('report:create', '提交举报', '举报不当内容', 'report', 'create'),
('report:handle', '处理举报', '处理用户举报', 'report', 'handle'),
('review:create', '发表评价', '对资源发表评价和评论', 'review', 'create'),
('review:read', '查看评价', '查看资源评价和评论', 'review', 'read'),
('review:moderate', '审核评价', '审核和管理用户评价', 'review', 'moderate'),
('review:delete', '删除评价', '删除不当评价', 'review', 'delete'),
('download:unlimited', '无限下载', '不受下载次数限制', 'download', 'unlimited'),
('download:vip_content', 'VIP内容下载', '下载VIP专属内容', 'download', 'vip_content'),

-- VIP/卡密/积分/签到 权限
('vip:level:create', '创建VIP等级', '创建新的VIP等级配置', 'vip_level', 'create'),
('vip:level:read', '查看VIP等级', '查看VIP等级配置信息', 'vip_level', 'read'),
('vip:level:update', '更新VIP等级', '修改VIP等级配置', 'vip_level', 'update'),
('vip:level:delete', '删除VIP等级', '删除VIP等级配置', 'vip_level', 'delete'),
('vip:user:read', '查看用户VIP信息', '查看用户的VIP状态和信息', 'vip_user', 'read'),
('vip:user:set', '设置用户VIP', '为用户设置VIP等级和时长', 'vip_user', 'set'),
('vip:user:extend', '延长用户VIP', '延长用户VIP有效期', 'vip_user', 'extend'),
('vip:user:cancel', '取消用户VIP', '取消用户的VIP状态', 'vip_user', 'cancel'),
('vip:order:read', '查看VIP订单', '查看VIP购买和订单记录', 'vip_order', 'read'),
('vip:order:update', '更新VIP订单', '更新VIP订单状态', 'vip_order', 'update'),
('card_key:generate', '生成卡密', '生成单个或批量卡密', 'card_key', 'generate'),
('card_key:read', '查看卡密', '查看卡密信息和列表', 'card_key', 'read'),
('card_key:update', '更新卡密', '更新卡密状态', 'card_key', 'update'),
('card_key:delete', '删除卡密', '删除卡密或批次', 'card_key', 'delete'),
('card_key:redeem', '兑换卡密', '用户兑换卡密功能', 'card_key', 'redeem'),
('card_key:statistics', '卡密统计', '查看卡密使用统计', 'card_key', 'statistics'),
('points:read', '查看积分信息', '查看用户积分余额和记录', 'points', 'read'),
('points:transfer', '积分转账', '向其他用户转账积分', 'points', 'transfer'),
('points:adjust', '调整积分', '管理员调整用户积分', 'points', 'adjust'),
('points:grant', '发放积分', '批量发放积分给用户', 'points', 'grant'),
('points:statistics', '积分统计', '查看积分系统统计数据', 'points', 'statistics'),
('points:manage', '积分管理', '管理用户积分系统', 'points', 'manage'),
('points:view', '查看积分', '查看积分记录', 'points', 'view'),
('checkin:check', '执行签到', '用户每日签到功能', 'checkin', 'check'),
('checkin:read', '查看签到信息', '查看签到记录和统计', 'checkin', 'read'),
('checkin:config:create', '创建签到配置', '创建签到奖励配置', 'checkin_config', 'create'),
('checkin:config:read', '查看签到配置', '查看签到配置信息', 'checkin_config', 'read'),
('checkin:config:update', '更新签到配置', '修改签到奖励配置', 'checkin_config', 'update'),
('checkin:config:delete', '删除签到配置', '删除签到配置', 'checkin_config', 'delete'),
('checkin:makeup', '补签功能', '管理员为用户补签', 'checkin', 'makeup'),
('checkin:reset', '重置签到数据', '重置用户签到记录', 'checkin', 'reset'),
('checkin:statistics', '签到统计', '查看签到系统统计数据', 'checkin', 'statistics'),
('referral:commission:read', '查看邀请佣金配置', '查看邀请佣金开关与比例', 'referral', 'read'),
('referral:commission:update', '更新邀请佣金配置', '调整邀请佣金启用状态与比例', 'referral', 'update'),

-- 其它功能
('content:create_advanced', '创建高级内容', 'VIP用户创建高级内容权限', 'content', 'create_advanced'),
('content:moderate', '内容审核', '审核和管理用户发布的内容', 'content', 'moderate'),
('feature:vip_access', '访问VIP功能', 'VIP专属功能访问权限', 'feature', 'vip_access');

-- 分配角色权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'; -- 管理员拥有所有权限

-- 版主权限（社区与内容管理、部分VIP/积分/签到/卡密只读）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'moderator'
AND p.name IN (
    'user:read','user:list','user:ban','user:warn',
    'resource:read','resource:update','resource:delete','resource:publish',
    'category:read','tag:read','tag:update','tag:delete',
    'review:read','review:moderate','review:delete','report:handle',
    'community:post:edit_any','community:post:delete_any','community:post:pin','community:post:feature','community:post:lock',
    'community:comment:delete_any','community:moderate','community:board:manage','community:report:handle',
    'community:like','community:favorite','community:share',
    'vip:level:read','vip:user:read','vip:order:read',
    'card_key:read','card_key:statistics',
    'points:read','points:statistics',
    'checkin:read','checkin:config:read','checkin:statistics'
);

-- 普通用户权限（基础发帖/评论/互动/资源读写）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'user'
AND p.name IN (
    'resource:create','resource:read','resource:download',
    'category:read','tag:read',
    'review:create','review:read','report:create',
    'community:post:create','community:post:edit_own','community:post:delete_own',
    'community:comment:create','community:comment:edit_own','community:comment:delete_own',
    'community:like','community:favorite','community:share','community:report'
);

-- VIP用户权限（继承普通用户 + VIP特权）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'vip'
AND p.name IN (
    'resource:create','resource:read','resource:download',
    'category:read','tag:read','tag:create',
    'review:create','review:read','report:create','points:view',
    'download:vip_content','feature:vip_access','content:create_advanced',
    'community:post:create','community:post:edit_own','community:post:delete_own',
    'community:comment:create','community:comment:edit_own','community:comment:delete_own',
    'community:like','community:favorite','community:share','community:report'
);

-- 插入默认资源类型
INSERT INTO resource_types (name, display_name, description, mime_types, max_file_size, is_streamable) VALUES
('article', '文章', '文字类资源', '{"text/plain", "text/html", "text/markdown"}', 52428800, FALSE),
('video', '视频', '视频类资源', '{"video/mp4", "video/avi", "video/mkv", "video/mov"}', 2147483648, TRUE),
('audio', '音频', '音频类资源', '{"audio/mp3", "audio/wav", "audio/flac", "audio/aac"}', 268435456, TRUE),
('document', '文档', '文档类资源', '{"application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}', 104857600, FALSE),
('image', '图片', '图片类资源', '{"image/jpeg", "image/png", "image/gif", "image/webp"}', 52428800, FALSE),
('software', '软件', '软件类资源', '{"application/zip", "application/x-rar", "application/x-7z-compressed"}', 2147483648, FALSE);

-- 插入默认分类
INSERT INTO categories (name, display_name, description, sort_order) VALUES
('technology', '科技', '科技类资源', 1),
('education', '教育', '教育类资源', 2),
('entertainment', '娱乐', '娱乐类资源', 3),
('business', '商业', '商业类资源', 4),
('health', '健康', '健康类资源', 5),
('lifestyle', '生活', '生活类资源', 6);

-- 插入默认社区版块
INSERT INTO community_boards (name, display_name, description, sort_order) VALUES
('general', '综合讨论', '综合性话题讨论区', 1),
('tech', '技术交流', '技术相关讨论', 2),
('resources', '资源分享', '资源分享和推荐', 3),
('feedback', '意见反馈', '用户反馈和建议', 4),
('newbie', '新手指导', '新用户指导和帮助', 5);

-- 插入默认VIP等级
INSERT INTO vip_levels (level, name, price, duration_days, daily_download_limit, description) VALUES
(1, '月度VIP', 29.90, 30, 50, '月度VIP会员，享受更多下载权限'),
(2, '季度VIP', 79.90, 90, 100, '季度VIP会员，享受更多下载权限和优惠'),
(3, '年度VIP', 299.90, 365, 200, '年度VIP会员，享受最高权限和最大优惠');

-- 插入默认签到配置
INSERT INTO checkin_configs (day, points_reward, description) VALUES
(1, 5, '第1天签到奖励'),
(2, 5, '第2天签到奖励'),
(3, 10, '第3天签到奖励'),
(4, 10, '第4天签到奖励'),
(5, 15, '第5天签到奖励'),
(6, 15, '第6天签到奖励'),
(7, 20, '第7天签到奖励，周奖励'),
(14, 50, '第14天签到奖励，双周奖励'),
(21, 80, '第21天签到奖励，三周奖励'),
(30, 150, '第30天签到奖励，月度奖励');

-- 插入默认积分商品
INSERT INTO points_products (name, description, price, type, value) VALUES
('7天VIP体验', '7天VIP会员体验', 100, 'vip_days', 7),
('30天VIP', '30天VIP会员', 500, 'vip_days', 30),
('额外下载次数', '增加10次下载次数', 50, 'download_quota', 10),
('积分兑换', '兑换100积分', 90, 'points', 100);

-- 记录安装完成
INSERT INTO schema_migrations (version, description) VALUES
('install_1.0.0', 'ALCMS Database Installation Complete');

-- 提交事务
COMMIT;

-- ============================================================================
-- 安装完成提示
-- ============================================================================

SELECT 'ALCMS 数据库安装完成！' as message,
       'Version: 1.0.0' as version,
       NOW() as installed_at;

-- ============================================================================
-- 使用说明
-- ============================================================================

/*
安装说明：
1. 确保PostgreSQL已安装并运行
2. 创建数据库和用户：
   CREATE DATABASE alcms;
   CREATE USER alcms_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE alcms TO alcms_user;
3. 使用此脚本初始化数据库结构

特性说明：
- 完整的用户权限管理系统
- 资源管理系统（支持硬删除）
- 社区论坛系统
- VIP和积分系统
- 签到系统
- 完善的索引和触发器

注意事项：
- resources表使用硬删除策略
- 历史记录表保留resource_id用于数据分析
- 社区内容和文件使用软删除
- 所有密码需要在应用层进行加密
*/
