-- 微社区模块默认数据
-- 创建时间: 2024-01-01

-- 插入默认社区板块
INSERT INTO community_boards (name, display_name, description, sort_order, is_active) VALUES
('general', '综合讨论', '自由讨论各种话题', 1, true),
('tech', '技术交流', '编程技术、开发经验分享', 2, true),
('frontend', '前端开发', 'HTML、CSS、JavaScript、Vue、React等前端技术', 3, true),
('backend', '后端开发', 'Node.js、Python、Java、数据库等后端技术', 4, true),
('mobile', '移动开发', 'iOS、Android、React Native、Flutter等移动开发', 5, true),
('devops', '运维部署', 'Docker、Kubernetes、CI/CD、服务器运维', 6, true),
('design', '设计分享', 'UI设计、UX设计、平面设计作品分享', 7, true),
('career', '职场发展', '求职面试、职场经验、技能提升', 8, true),
('tools', '工具推荐', '开发工具、效率工具、资源推荐', 9, true),
('qa', '问答求助', '技术问题求助、经验答疑', 10, true),
('off-topic', '水友闲聊', '日常生活、兴趣爱好、轻松话题', 11, true);

-- 扩展权限系统，添加社区相关权限
INSERT INTO permissions (name, display_name, description, resource, action) VALUES
-- 帖子权限
('community.post.create', '发布帖子', '在社区中发布新帖子', 'community_posts', 'create'),
('community.post.edit_own', '编辑自己的帖子', '编辑自己发布的帖子', 'community_posts', 'edit'),
('community.post.delete_own', '删除自己的帖子', '删除自己发布的帖子', 'community_posts', 'delete'),
('community.post.edit_any', '编辑任意帖子', '编辑任意用户的帖子', 'community_posts', 'edit'),
('community.post.delete_any', '删除任意帖子', '删除任意用户的帖子', 'community_posts', 'delete'),
('community.post.pin', '置顶帖子', '设置帖子置顶', 'community_posts', 'manage'),
('community.post.feature', '设置精华帖', '设置帖子为精华', 'community_posts', 'manage'),
('community.post.lock', '锁定帖子', '锁定帖子禁止回复', 'community_posts', 'manage'),

-- 评论权限
('community.comment.create', '发表评论', '在帖子下发表评论', 'community_comments', 'create'),
('community.comment.edit_own', '编辑自己的评论', '编辑自己的评论', 'community_comments', 'edit'),
('community.comment.delete_own', '删除自己的评论', '删除自己的评论', 'community_comments', 'delete'),
('community.comment.delete_any', '删除任意评论', '删除任意用户的评论', 'community_comments', 'delete'),

-- 互动权限
('community.like', '点赞功能', '对帖子和评论点赞', 'community_likes', 'create'),
('community.favorite', '收藏功能', '收藏帖子', 'community_favorites', 'create'),
('community.share', '分享功能', '分享帖子到外部平台', 'community_shares', 'create'),
('community.report', '举报功能', '举报违规内容', 'community_reports', 'create'),

-- 管理权限
('community.moderate', '社区管理', '社区内容审核管理', 'community', 'manage'),
('community.punish', '违规处罚', '对违规用户进行处罚', 'community_punishments', 'manage'),
('community.board.manage', '板块管理', '管理社区板块', 'community_boards', 'manage'),
('community.report.handle', '处理举报', '处理用户举报内容', 'community_reports', 'manage'),

-- 高级权限
('community.bypass_review', '免审核', '发布内容无需审核', 'community', 'special'),
('community.admin', '社区管理员', '完整的社区管理权限', 'community', 'admin');

-- 为角色分配社区权限
-- 普通用户权限
INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'user' AND p.name IN (
    'community.post.create',
    'community.post.edit_own',
    'community.post.delete_own',
    'community.comment.create',
    'community.comment.edit_own',
    'community.comment.delete_own',
    'community.like',
    'community.favorite',
    'community.share',
    'community.report'
);

-- VIP用户权限（继承普通用户权限）
INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'vip' AND p.name IN (
    'community.post.create',
    'community.post.edit_own',
    'community.post.delete_own',
    'community.comment.create',
    'community.comment.edit_own',
    'community.comment.delete_own',
    'community.like',
    'community.favorite',
    'community.share',
    'community.report'
);

-- 版主权限（继承VIP权限 + 管理权限）
INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'moderator' AND p.name IN (
    'community.post.create',
    'community.post.edit_own',
    'community.post.delete_own',
    'community.post.edit_any',
    'community.post.delete_any',
    'community.post.pin',
    'community.post.feature',
    'community.post.lock',
    'community.comment.create',
    'community.comment.edit_own',
    'community.comment.delete_own',
    'community.comment.delete_any',
    'community.like',
    'community.favorite',
    'community.share',
    'community.report',
    'community.moderate',
    'community.punish',
    'community.report.handle',
    'community.bypass_review'
);

-- 管理员权限（所有权限）
INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'admin' AND p.name LIKE 'community.%';

-- 创建示例帖子（仅在开发环境）
INSERT INTO community_posts (title, content, content_type, summary, author_id, board_id, status, published_at) 
SELECT 
    '欢迎来到Alcms社区！',
    '# 欢迎大家！

这里是Alcms内容管理系统的官方社区。

## 社区规则
1. 友善交流，互相尊重
2. 分享有价值的内容
3. 遵守法律法规
4. 禁止发布违规内容

## 板块介绍
- **技术交流**: 分享编程技术和开发经验
- **前端开发**: HTML、CSS、JavaScript等前端技术讨论
- **后端开发**: 服务器端技术、数据库等讨论
- **问答求助**: 遇到问题可以在这里寻求帮助

让我们一起建设一个良好的技术社区环境！',
    'markdown',
    '欢迎来到Alcms社区，一起建设良好的技术交流环境',
    u.id,
    b.id,
    'published',
    CURRENT_TIMESTAMP
FROM users u, community_boards b 
WHERE u.username = 'admin' AND b.name = 'general'
LIMIT 1;

-- 插入一些示例标签（如果不存在）
INSERT INTO tags (name, display_name, description, color) VALUES
('社区公告', '社区公告', '社区重要公告和通知', '#FF6B6B'),
('新手指南', '新手指南', '新用户入门指导', '#4ECDC4'),
('技术分享', '技术分享', '技术经验和知识分享', '#45B7D1'),
('问题讨论', '问题讨论', '技术问题讨论和解答', '#96CEB4'),
('工具推荐', '工具推荐', '好用工具和资源推荐', '#FECA57'),
('职场经验', '职场经验', '职场发展和经验分享', '#FF9FF3'),
('开源项目', '开源项目', '开源项目介绍和分享', '#54A0FF')
ON CONFLICT (name) DO NOTHING;

-- 社区默认数据插入完成
