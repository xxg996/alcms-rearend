-- 微社区模块数据库表结构
-- 创建时间: 2024-01-01
-- 版本: 1.0.0

-- 创建社区板块表
CREATE TABLE IF NOT EXISTS community_boards (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url VARCHAR(500),
    cover_image_url VARCHAR(500),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    post_count INTEGER NOT NULL DEFAULT 0,
    last_post_id INTEGER,
    last_post_time TIMESTAMP WITH TIME ZONE,
    moderator_ids INTEGER[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建帖子表
CREATE TABLE IF NOT EXISTS community_posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(20) NOT NULL DEFAULT 'markdown', -- markdown, html
    summary VARCHAR(500),
    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    board_id INTEGER NOT NULL REFERENCES community_boards(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'published', -- draft, published, reviewing, rejected, deleted
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    view_count INTEGER NOT NULL DEFAULT 0,
    reply_count INTEGER NOT NULL DEFAULT 0,
    like_count INTEGER NOT NULL DEFAULT 0,
    favorite_count INTEGER NOT NULL DEFAULT 0,
    share_count INTEGER NOT NULL DEFAULT 0,
    last_reply_id INTEGER,
    last_reply_time TIMESTAMP WITH TIME ZONE,
    last_reply_user_id INTEGER REFERENCES users(id),
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建帖子标签关联表
CREATE TABLE IF NOT EXISTS community_post_tags (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, tag_id)
);

-- 创建评论表（支持楼中楼）
CREATE TABLE IF NOT EXISTS community_comments (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES community_comments(id) ON DELETE CASCADE,
    reply_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    floor_number INTEGER NOT NULL DEFAULT 1,
    like_count INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_reason VARCHAR(200),
    deleted_by INTEGER REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建点赞表
CREATE TABLE IF NOT EXISTS community_likes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL, -- post, comment
    target_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, target_type, target_id)
);

-- 创建收藏表
CREATE TABLE IF NOT EXISTS community_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id)
);

-- 创建分享记录表
CREATE TABLE IF NOT EXISTS community_shares (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    share_platform VARCHAR(50), -- wechat, weibo, qq, link
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建举报表
CREATE TABLE IF NOT EXISTS community_reports (
    id SERIAL PRIMARY KEY,
    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL, -- post, comment, user
    target_id INTEGER NOT NULL,
    reason VARCHAR(50) NOT NULL, -- spam, inappropriate, harassment, fake, other
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, reviewing, resolved, rejected
    handler_id INTEGER REFERENCES users(id),
    handler_note TEXT,
    handled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建社区违规处罚表
CREATE TABLE IF NOT EXISTS community_punishments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    punishment_type VARCHAR(20) NOT NULL, -- warning, mute, ban_posting, ban_community
    reason VARCHAR(200) NOT NULL,
    description TEXT,
    duration_hours INTEGER, -- NULL表示永久
    operator_id INTEGER NOT NULL REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建社区通知表
CREATE TABLE IF NOT EXISTS community_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL, -- reply, mention, like, favorite, system
    title VARCHAR(200) NOT NULL,
    content TEXT,
    related_type VARCHAR(20), -- post, comment
    related_id INTEGER,
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建用户社区统计表
CREATE TABLE IF NOT EXISTS community_user_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    post_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    like_given_count INTEGER NOT NULL DEFAULT 0,
    like_received_count INTEGER NOT NULL DEFAULT 0,
    favorite_count INTEGER NOT NULL DEFAULT 0,
    follower_count INTEGER NOT NULL DEFAULT 0,
    following_count INTEGER NOT NULL DEFAULT 0,
    reputation_score INTEGER NOT NULL DEFAULT 0,
    last_post_time TIMESTAMP WITH TIME ZONE,
    last_comment_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_community_boards_sort_order ON community_boards(sort_order, is_active);
CREATE INDEX IF NOT EXISTS idx_community_posts_board_id ON community_posts(board_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_author_id ON community_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_status ON community_posts(status);
CREATE INDEX IF NOT EXISTS idx_community_posts_published_at ON community_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_last_reply_time ON community_posts(last_reply_time DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_pinned_featured ON community_posts(is_pinned DESC, is_featured DESC, last_reply_time DESC);

CREATE INDEX IF NOT EXISTS idx_community_comments_post_id ON community_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_author_id ON community_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_parent_id ON community_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_floor ON community_comments(post_id, floor_number);

CREATE INDEX IF NOT EXISTS idx_community_likes_user_target ON community_likes(user_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_community_likes_target ON community_likes(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_community_favorites_user_id ON community_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_community_favorites_post_id ON community_favorites(post_id);

CREATE INDEX IF NOT EXISTS idx_community_reports_status ON community_reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_community_reports_target ON community_reports(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_community_punishments_user_active ON community_punishments(user_id, is_active, expires_at);

CREATE INDEX IF NOT EXISTS idx_community_notifications_user_read ON community_notifications(user_id, is_read, created_at DESC);

-- 创建全文搜索索引
CREATE INDEX IF NOT EXISTS idx_community_posts_search 
ON community_posts USING gin(to_tsvector('english', title || ' ' || content));

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_community_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 应用触发器
CREATE TRIGGER update_community_boards_updated_at
    BEFORE UPDATE ON community_boards
    FOR EACH ROW EXECUTE FUNCTION update_community_updated_at();

CREATE TRIGGER update_community_posts_updated_at
    BEFORE UPDATE ON community_posts
    FOR EACH ROW EXECUTE FUNCTION update_community_updated_at();

CREATE TRIGGER update_community_comments_updated_at
    BEFORE UPDATE ON community_comments
    FOR EACH ROW EXECUTE FUNCTION update_community_updated_at();

CREATE TRIGGER update_community_reports_updated_at
    BEFORE UPDATE ON community_reports
    FOR EACH ROW EXECUTE FUNCTION update_community_updated_at();

CREATE TRIGGER update_community_punishments_updated_at
    BEFORE UPDATE ON community_punishments
    FOR EACH ROW EXECUTE FUNCTION update_community_updated_at();

CREATE TRIGGER update_community_user_stats_updated_at
    BEFORE UPDATE ON community_user_stats
    FOR EACH ROW EXECUTE FUNCTION update_community_updated_at();

-- 创建统计更新函数
CREATE OR REPLACE FUNCTION update_post_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- 更新帖子回复数和最后回复信息
        UPDATE community_posts 
        SET reply_count = reply_count + 1,
            last_reply_id = NEW.id,
            last_reply_time = NEW.created_at,
            last_reply_user_id = NEW.author_id
        WHERE id = NEW.post_id;
        
        -- 更新板块统计
        UPDATE community_boards 
        SET last_post_id = NEW.post_id,
            last_post_time = NEW.created_at
        WHERE id = (SELECT board_id FROM community_posts WHERE id = NEW.post_id);
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- 更新帖子回复数
        UPDATE community_posts 
        SET reply_count = reply_count - 1
        WHERE id = OLD.post_id;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 创建点赞统计更新函数
CREATE OR REPLACE FUNCTION update_like_stats()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- 创建收藏统计更新函数
CREATE OR REPLACE FUNCTION update_favorite_stats()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- 应用统计触发器
CREATE TRIGGER trigger_update_post_stats
    AFTER INSERT OR DELETE ON community_comments
    FOR EACH ROW EXECUTE FUNCTION update_post_stats();

CREATE TRIGGER trigger_update_like_stats
    AFTER INSERT OR DELETE ON community_likes
    FOR EACH ROW EXECUTE FUNCTION update_like_stats();

CREATE TRIGGER trigger_update_favorite_stats
    AFTER INSERT OR DELETE ON community_favorites
    FOR EACH ROW EXECUTE FUNCTION update_favorite_stats();

-- 社区表创建完成
