-- 插入CMS系统默认数据

-- 插入资源类型
INSERT INTO resource_types (name, display_name, description, mime_types, max_file_size, is_streamable) VALUES
('article', '文章', '文字类型资源，如博客文章、教程等', ARRAY['text/html', 'text/markdown'], 10485760, FALSE),
('video', '视频', '视频类型资源，支持在线播放', ARRAY['video/mp4', 'video/avi', 'video/mkv', 'video/webm'], 2147483648, TRUE),
('audio', '音频', '音频类型资源，支持在线播放', ARRAY['audio/mp3', 'audio/wav', 'audio/flac', 'audio/aac'], 104857600, TRUE),
('image', '图片', '图片类型资源', ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'], 52428800, FALSE),
('document', '文档', '文档类型资源，如PDF、Word等', ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], 104857600, FALSE),
('software', '软件', '软件包和应用程序', ARRAY['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'], 1073741824, FALSE),
('ebook', '电子书', '电子书籍资源', ARRAY['application/epub+zip', 'application/pdf', 'application/x-mobipocket-ebook'], 52428800, FALSE)
ON CONFLICT (name) DO NOTHING;

-- 插入默认分类
INSERT INTO categories (name, display_name, description, sort_order) VALUES
('technology', '科技', '科技相关内容', 1),
('entertainment', '娱乐', '娱乐内容', 2),
('education', '教育', '教育学习资源', 3),
('business', '商业', '商业和财经内容', 4),
('lifestyle', '生活', '生活方式和健康', 5),
('art', '艺术', '艺术和设计', 6),
('sports', '体育', '体育运动', 7),
('news', '新闻', '新闻和时事', 8)
ON CONFLICT (name) DO NOTHING;

-- 插入子分类
INSERT INTO categories (name, display_name, description, parent_id, sort_order) VALUES
-- 科技子分类
('programming', '编程开发', '编程和软件开发', (SELECT id FROM categories WHERE name = 'technology'), 1),
('ai', '人工智能', 'AI和机器学习', (SELECT id FROM categories WHERE name = 'technology'), 2),
('mobile', '移动开发', '移动应用开发', (SELECT id FROM categories WHERE name = 'technology'), 3),
('web', 'Web开发', 'Web前端和后端开发', (SELECT id FROM categories WHERE name = 'technology'), 4),

-- 娱乐子分类
('music', '音乐', '音乐作品和相关内容', (SELECT id FROM categories WHERE name = 'entertainment'), 1),
('movies', '电影', '电影和影视作品', (SELECT id FROM categories WHERE name = 'entertainment'), 2),
('games', '游戏', '游戏相关内容', (SELECT id FROM categories WHERE name = 'entertainment'), 3),

-- 教育子分类
('courses', '在线课程', '在线教育课程', (SELECT id FROM categories WHERE name = 'education'), 1),
('tutorials', '教程', '各类学习教程', (SELECT id FROM categories WHERE name = 'education'), 2),
('books', '图书', '电子书籍和学习资料', (SELECT id FROM categories WHERE name = 'education'), 3)
ON CONFLICT (name) DO NOTHING;

-- 插入默认标签
INSERT INTO tags (name, display_name, description, color) VALUES
('hot', '热门', '热门内容', '#ff4757'),
('new', '最新', '最新发布', '#2ed573'),
('recommended', '推荐', '编辑推荐', '#ffa502'),
('free', '免费', '免费资源', '#5352ed'),
('premium', '付费', '付费资源', '#ff6b81'),
('tutorial', '教程', '教学内容', '#70a1ff'),
('opensource', '开源', '开源项目', '#7bed9f'),
('beginner', '入门', '适合初学者', '#a4b0be'),
('advanced', '高级', '高级内容', '#ff3838'),
('trending', '趋势', '当前趋势', '#ff9f43')
ON CONFLICT (name) DO NOTHING;

-- 为现有权限系统添加CMS相关权限
INSERT INTO permissions (name, display_name, description, resource, action) VALUES
-- 资源管理权限
('resource:create', '创建资源', '创建和发布资源内容', 'resource', 'create'),
('resource:read', '查看资源', '查看资源详情和列表', 'resource', 'read'),
('resource:update', '编辑资源', '编辑资源内容和信息', 'resource', 'update'),
('resource:delete', '删除资源', '删除资源内容', 'resource', 'delete'),
('resource:publish', '发布资源', '发布和下架资源', 'resource', 'publish'),
('resource:download', '下载资源', '下载资源文件', 'resource', 'download'),

-- 分类管理权限
('category:create', '创建分类', '创建资源分类', 'category', 'create'),
('category:read', '查看分类', '查看分类信息', 'category', 'read'),
('category:update', '编辑分类', '编辑分类信息', 'category', 'update'),
('category:delete', '删除分类', '删除资源分类', 'category', 'delete'),

-- 标签管理权限
('tag:create', '创建标签', '创建资源标签', 'tag', 'create'),
('tag:read', '查看标签', '查看标签信息', 'tag', 'read'),
('tag:update', '编辑标签', '编辑标签信息', 'tag', 'update'),
('tag:delete', '删除标签', '删除资源标签', 'tag', 'delete'),

-- 评论和评价权限
('review:create', '发表评价', '对资源发表评价和评论', 'review', 'create'),
('review:read', '查看评价', '查看资源评价和评论', 'review', 'read'),
('review:moderate', '审核评价', '审核和管理用户评价', 'review', 'moderate'),
('review:delete', '删除评价', '删除不当评价', 'review', 'delete'),

-- 举报处理权限
('report:create', '提交举报', '举报不当内容', 'report', 'create'),
('report:handle', '处理举报', '处理用户举报', 'report', 'handle'),

-- 积分管理权限
('points:manage', '积分管理', '管理用户积分系统', 'points', 'manage'),
('points:view', '查看积分', '查看积分记录', 'points', 'view'),

-- 下载权限
('download:unlimited', '无限下载', '不受下载次数限制', 'download', 'unlimited'),
('download:vip_content', 'VIP内容下载', '下载VIP专属内容', 'download', 'vip_content')
ON CONFLICT (name) DO NOTHING;

-- 为角色分配CMS权限
-- 普通用户权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'user' AND p.name IN (
    'resource:read',
    'resource:download',
    'category:read',
    'tag:read',
    'review:create',
    'review:read',
    'report:create',
    'points:view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- VIP用户权限（继承普通用户权限）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'vip' AND p.name IN (
    'resource:read',
    'resource:download',
    'resource:create',
    'category:read',
    'tag:read',
    'tag:create',
    'review:create',
    'review:read',
    'report:create',
    'points:view',
    'download:vip_content'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 版主权限（继承VIP权限，添加审核权限）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'moderator' AND p.name IN (
    'resource:read',
    'resource:download',
    'resource:create',
    'resource:update',
    'resource:publish',
    'category:read',
    'category:create',
    'tag:read',
    'tag:create',
    'tag:update',
    'review:create',
    'review:read',
    'review:moderate',
    'review:delete',
    'report:create',
    'report:handle',
    'points:view',
    'download:vip_content'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 管理员权限（拥有所有CMS权限）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.name LIKE '%:%'
ON CONFLICT (role_id, permission_id) DO NOTHING;
