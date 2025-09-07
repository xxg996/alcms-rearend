-- CMS 资源管理系统数据库表结构
-- 扩展用户权限系统，添加内容管理功能

-- 资源分类表
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    icon_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 资源类型表
CREATE TABLE IF NOT EXISTS resource_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    mime_types TEXT[], -- 支持的MIME类型数组
    max_file_size BIGINT, -- 最大文件大小（字节）
    is_streamable BOOLEAN DEFAULT FALSE, -- 是否支持在线播放
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#007bff', -- 标签颜色
    usage_count INTEGER DEFAULT 0, -- 使用次数
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 资源表
CREATE TABLE IF NOT EXISTS resources (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE, -- URL友好的标识符
    description TEXT,
    content TEXT, -- 详细内容
    summary VARCHAR(500), -- 摘要
    
    -- 分类和类型
    category_id INTEGER REFERENCES categories(id),
    resource_type_id INTEGER REFERENCES resource_types(id) NOT NULL,
    
    -- 媒体信息
    cover_image_url VARCHAR(500), -- 封面图
    file_url VARCHAR(500), -- 文件地址
    file_size BIGINT, -- 文件大小
    file_mime_type VARCHAR(100), -- 文件MIME类型
    duration INTEGER, -- 媒体时长（秒）
    
    -- 外部链接
    external_url VARCHAR(500), -- 外部链接
    download_url VARCHAR(500), -- 下载链接
    
    -- 访问控制
    is_public BOOLEAN DEFAULT TRUE, -- 是否公开
    is_free BOOLEAN DEFAULT TRUE, -- 是否免费
    required_vip_level VARCHAR(20), -- 需要的VIP等级
    required_points INTEGER DEFAULT 0, -- 需要的积分
    download_limit INTEGER, -- 下载次数限制
    
    -- 状态和统计
    status VARCHAR(20) DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived', 'banned')),
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    
    -- 创建和更新信息
    author_id INTEGER REFERENCES users(id) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP
);

-- 资源标签关联表
CREATE TABLE IF NOT EXISTS resource_tags (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(resource_id, tag_id)
);

-- 用户资源收藏表
CREATE TABLE IF NOT EXISTS user_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, resource_id)
);

-- 资源下载记录表
CREATE TABLE IF NOT EXISTS download_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    download_url VARCHAR(500), -- 实际下载链接
    expires_at TIMESTAMP, -- 链接过期时间
    is_successful BOOLEAN DEFAULT FALSE,
    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 资源评价表
CREATE TABLE IF NOT EXISTS resource_reviews (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(resource_id, user_id)
);

-- 资源举报表
CREATE TABLE IF NOT EXISTS resource_reports (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
    reporter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
    handled_by INTEGER REFERENCES users(id),
    handled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户积分记录表
CREATE TABLE IF NOT EXISTS user_points (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    points INTEGER NOT NULL, -- 积分变化（正数为增加，负数为减少）
    reason VARCHAR(100) NOT NULL, -- 积分变化原因
    resource_id INTEGER REFERENCES resources(id), -- 关联资源（如果适用）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);

CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type_id);
CREATE INDEX IF NOT EXISTS idx_resources_author ON resources(author_id);
CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status);
CREATE INDEX IF NOT EXISTS idx_resources_published ON resources(published_at);
CREATE INDEX IF NOT EXISTS idx_resources_public ON resources(is_public);
CREATE INDEX IF NOT EXISTS idx_resources_created ON resources(created_at);

CREATE INDEX IF NOT EXISTS idx_resource_tags_resource ON resource_tags(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_tags_tag ON resource_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_resource ON user_favorites(resource_id);

CREATE INDEX IF NOT EXISTS idx_download_records_user ON download_records(user_id);
CREATE INDEX IF NOT EXISTS idx_download_records_resource ON download_records(resource_id);
CREATE INDEX IF NOT EXISTS idx_download_records_ip ON download_records(ip_address);

CREATE INDEX IF NOT EXISTS idx_resource_reviews_resource ON resource_reviews(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_reviews_user ON resource_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_resource_reviews_approved ON resource_reviews(is_approved);

CREATE INDEX IF NOT EXISTS idx_resource_reports_resource ON resource_reports(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_reports_status ON resource_reports(status);

CREATE INDEX IF NOT EXISTS idx_user_points_user ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_created ON user_points(created_at);

-- 全文搜索索引
CREATE INDEX IF NOT EXISTS idx_resources_search ON resources USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || COALESCE(content, '')));

-- 添加更新时间触发器
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON resources 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resource_reviews_updated_at BEFORE UPDATE ON resource_reviews 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
