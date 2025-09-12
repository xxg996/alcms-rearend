-- ALCMS 数据库优化脚本
-- 执行前请先备份数据库
-- 建议在低峰期执行
-- 生成日期: 2025-09-11

-- ========================================
-- 第一部分：添加性能优化索引
-- ========================================

BEGIN;

-- 1. 资源表复合索引优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_status_public_created 
ON resources(status, is_public, created_at DESC) 
WHERE status = 'published';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_search_optimized
ON resources USING gin(
  to_tsvector('simple', 
    coalesce(title, '') || ' ' || 
    coalesce(description, '') || ' ' || 
    coalesce(summary, '')
  )
);

-- 2. 用户表活跃用户索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active 
ON users(id, username, email) 
WHERE status = 'normal';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_vip_active
ON users(id, vip_level, vip_expire_at)
WHERE is_vip = true AND status = 'normal';

-- 3. 社区帖子热度排序索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_community_posts_hot 
ON community_posts(
  board_id,
  status,
  (view_count * 0.3 + reply_count * 0.5 + like_count * 0.2) DESC
) WHERE status = 'published';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_community_posts_user_recent
ON community_posts(author_id, created_at DESC)
WHERE status = 'published';

-- 4. 评论查询优化索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_community_comments_post_floor
ON community_comments(post_id, floor_number)
WHERE is_deleted = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_community_comments_tree
ON community_comments(post_id, parent_id, created_at)
WHERE is_deleted = false;

-- 5. 积分记录查询索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_points_records_user_recent
ON points_records(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_points_records_source_type
ON points_records(source, type, created_at DESC);

-- 6. 签到记录优化索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_checkins_month
ON user_checkins(
  user_id, 
  date_trunc('month', checkin_date),
  checkin_date
);

-- 7. 标签使用统计索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resource_tags_count
ON resource_tags(tag_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_community_post_tags_count
ON community_post_tags(tag_id);

-- 8. 通知查询优化索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_community_notifications_unread
ON community_notifications(user_id, created_at DESC)
WHERE is_read = false;

-- 9. VIP订单查询索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vip_orders_user_status
ON vip_orders(user_id, status, created_at DESC);

-- 10. 收藏查询优化索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_favorites_user_created
ON user_favorites(user_id, created_at DESC);

COMMIT;

-- ========================================
-- 第二部分：添加数据完整性约束
-- ========================================

BEGIN;

-- 邮箱格式验证
ALTER TABLE users 
ADD CONSTRAINT check_email_format 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$');

-- 积分范围验证
ALTER TABLE resources 
ADD CONSTRAINT check_points_range 
CHECK (required_points >= 0 AND required_points <= 999999);

-- 用户积分非负验证
ALTER TABLE users
ADD CONSTRAINT check_user_points_positive
CHECK (points >= 0 AND total_points >= 0);

-- VIP等级有效性
ALTER TABLE users
ADD CONSTRAINT check_vip_consistency
CHECK (
  (is_vip = false AND vip_level IS NULL AND vip_expire_at IS NULL) OR
  (is_vip = true AND vip_level IS NOT NULL AND vip_expire_at IS NOT NULL)
);

-- 评论楼层号验证
ALTER TABLE community_comments
ADD CONSTRAINT check_floor_number_positive
CHECK (floor_number > 0);

-- 卡密状态转换验证
ALTER TABLE card_keys
ADD CONSTRAINT check_card_key_status_transition
CHECK (
  (status = 'unused' AND used_by IS NULL AND used_at IS NULL) OR
  (status = 'used' AND used_by IS NOT NULL AND used_at IS NOT NULL) OR
  (status = 'expired')
);

COMMIT;

-- ========================================
-- 第三部分：创建性能监控基础设施
-- ========================================

BEGIN;

-- 创建慢查询日志表
CREATE TABLE IF NOT EXISTS slow_query_logs (
  id BIGSERIAL PRIMARY KEY,
  query_text TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  cpu_time_ms INTEGER,
  rows_returned INTEGER,
  context JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_slow_query_logs_created ON slow_query_logs(created_at DESC);
CREATE INDEX idx_slow_query_logs_duration ON slow_query_logs(duration_ms DESC);

-- 创建数据库性能指标表
CREATE TABLE IF NOT EXISTS performance_metrics (
  id BIGSERIAL PRIMARY KEY,
  metric_type VARCHAR(50) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_performance_metrics_type_created 
ON performance_metrics(metric_type, created_at DESC);

-- 创建审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  operation VARCHAR(10) NOT NULL,
  user_id INTEGER,
  record_id INTEGER,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_table_record 
ON audit_logs(table_name, record_id, created_at DESC);

CREATE INDEX idx_audit_logs_user 
ON audit_logs(user_id, created_at DESC);

COMMIT;

-- ========================================
-- 第四部分：创建性能优化函数
-- ========================================

-- 批量更新统计信息函数
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS void AS $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE 'ANALYZE ' || quote_ident(tbl.tablename);
    RAISE NOTICE 'Analyzed table: %', tbl.tablename;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 查找未使用的索引
CREATE OR REPLACE FUNCTION find_unused_indexes()
RETURNS TABLE(
  schema_name TEXT,
  table_name TEXT,
  index_name TEXT,
  index_size TEXT,
  index_scans BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    schemaname::TEXT,
    tablename::TEXT,
    indexname::TEXT,
    pg_size_pretty(pg_relation_size(indexrelid))::TEXT,
    idx_scan
  FROM pg_stat_user_indexes
  WHERE idx_scan < 100
  AND indexrelname NOT LIKE 'pg_%'
  ORDER BY pg_relation_size(indexrelid) DESC;
END;
$$ LANGUAGE plpgsql;

-- 查找需要维护的表（碎片化）
CREATE OR REPLACE FUNCTION find_bloated_tables()
RETURNS TABLE(
  schema_name TEXT,
  table_name TEXT,
  bloat_ratio NUMERIC,
  wasted_bytes BIGINT,
  wasted_size TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH constants AS (
    SELECT current_setting('block_size')::NUMERIC AS bs, 23 AS hdr, 8 AS ma
  ),
  no_stats AS (
    SELECT table_schema, table_name, 
      n_live_tup::NUMERIC as est_rows,
      pg_table_size(relid)::NUMERIC as table_size
    FROM information_schema.columns
      JOIN pg_stat_user_tables as psut
        ON table_schema=psut.schemaname
        AND table_name=psut.relname
      LEFT OUTER JOIN pg_stats
      ON table_schema=pg_stats.schemaname
        AND table_name=pg_stats.tablename
        AND column_name=attname 
    WHERE attname IS NULL
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
    GROUP BY table_schema, table_name, relid, n_live_tup
  ),
  null_headers AS (
    SELECT
      hdr+1+(hdr+ma-(CASE WHEN hdr%ma=0 THEN ma ELSE hdr%ma END))::INT AS nullhdr,
      SUM((1-null_frac)*avg_width) AS datawidth,
      MAX(null_frac) AS maxfracsum,
      hdr+(
        SELECT 1+COUNT(*)::INT FROM pg_stats s2
        WHERE null_frac<>0 AND s2.schemaname = s.schemaname 
          AND s2.tablename = s.tablename
      ) AS nullhdr2
    FROM pg_stats s, constants
    GROUP BY schemaname, tablename, hdr, ma, bs
  ),
  data_headers AS (
    SELECT
      ma, bs, hdr, schemaname, tablename,
      (datawidth+(hdr+ma-(CASE WHEN hdr%ma=0 THEN ma ELSE hdr%ma END)))::NUMERIC AS datahdr,
      (maxfracsum*(nullhdr+ma-(CASE WHEN nullhdr%ma=0 THEN ma ELSE nullhdr%ma END))) AS nullhdr2
    FROM null_headers
  ),
  table_estimates AS (
    SELECT schemaname, tablename, bs,
      reltuples::NUMERIC as est_rows, relpages * bs as table_bytes,
      CEIL((reltuples*
          (datahdr + nullhdr2 + 4 + ma -
            (CASE WHEN datahdr%ma=0 THEN ma ELSE datahdr%ma END)
          )::NUMERIC) / (bs-20)
      ) * bs AS expected_bytes,
      reltoastrelid
    FROM data_headers
      JOIN pg_class ON tablename = relname
      JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace 
        AND schemaname = nspname
    WHERE pg_class.relkind = 'r'
  ),
  estimates_with_toast AS (
    SELECT schemaname, tablename, 
      TRUE AS can_estimate,
      est_rows,
      table_bytes + COALESCE(toast.relpages, 0) * bs AS table_bytes,
      expected_bytes + 
        CASE WHEN reltoastrelid = 0 THEN 0
          ELSE COALESCE(toast.relpages, 0) * bs END
        AS expected_bytes
    FROM table_estimates
      LEFT OUTER JOIN pg_class AS toast 
        ON table_estimates.reltoastrelid = toast.oid
        AND toast.relkind = 't'
  ),
  table_estimates_plus AS (
    SELECT current_database() as databasename,
      schemaname, tablename, can_estimate, 
      est_rows,
      CASE WHEN table_bytes > 0 THEN table_bytes::BIGINT ELSE NULL END AS table_bytes,
      CASE WHEN expected_bytes > 0 AND table_bytes > 0 
        THEN expected_bytes::BIGINT ELSE NULL END AS expected_bytes,
      CASE WHEN expected_bytes > 0 AND table_bytes > 0 
        AND expected_bytes <= table_bytes
        THEN (table_bytes - expected_bytes)::BIGINT ELSE 0 END AS bloat_bytes
    FROM estimates_with_toast
    UNION ALL
    SELECT current_database() as databasename, 
      table_schema, table_name, FALSE,
      est_rows, table_size,
      NULL, NULL
    FROM no_stats
  ),
  bloat_summary AS (
    SELECT current_database() as databasename,
      schemaname, tablename, can_estimate,
      table_bytes, expected_bytes, bloat_bytes,
      CASE WHEN table_bytes > 0 AND bloat_bytes > 0 
        THEN bloat_bytes * 100 / table_bytes ELSE 0 END AS bloat_ratio
    FROM table_estimates_plus
  )
  SELECT 
    schemaname::TEXT,
    tablename::TEXT,
    ROUND(bloat_ratio, 2),
    bloat_bytes,
    pg_size_pretty(bloat_bytes)::TEXT
  FROM bloat_summary
  WHERE bloat_ratio > 20
    AND bloat_bytes > 1024*1024
  ORDER BY bloat_bytes DESC;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 第五部分：创建维护任务
-- ========================================

-- 自动VACUUM和统计更新函数
CREATE OR REPLACE FUNCTION perform_maintenance()
RETURNS void AS $$
DECLARE
  tbl RECORD;
BEGIN
  -- 更新所有表的统计信息
  FOR tbl IN 
    SELECT schemaname, tablename 
    FROM pg_stat_user_tables
    WHERE n_dead_tup > 1000
  LOOP
    EXECUTE format('VACUUM ANALYZE %I.%I', tbl.schemaname, tbl.tablename);
    RAISE NOTICE 'Vacuumed and analyzed: %.%', tbl.schemaname, tbl.tablename;
  END LOOP;
  
  -- 重建膨胀严重的索引
  FOR tbl IN
    SELECT schemaname, tablename, indexname
    FROM pg_stat_user_indexes
    JOIN pg_class ON indexrelid = pg_class.oid
    WHERE pg_relation_size(indexrelid) > 100*1024*1024 -- 大于100MB
  LOOP
    EXECUTE format('REINDEX INDEX CONCURRENTLY %I.%I', 
                   tbl.schemaname, tbl.indexname);
    RAISE NOTICE 'Reindexed: %.%', tbl.schemaname, tbl.indexname;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 第六部分：查询优化视图
-- ========================================

-- 创建常用查询的物化视图
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_stats AS
SELECT 
  u.id as user_id,
  u.username,
  u.email,
  u.status,
  u.is_vip,
  u.vip_level,
  u.points,
  COUNT(DISTINCT r.id) as resource_count,
  COUNT(DISTINCT cp.id) as post_count,
  COUNT(DISTINCT cc.id) as comment_count,
  MAX(cp.created_at) as last_post_at,
  MAX(cc.created_at) as last_comment_at
FROM users u
LEFT JOIN resources r ON u.id = r.author_id
LEFT JOIN community_posts cp ON u.id = cp.author_id
LEFT JOIN community_comments cc ON u.id = cc.author_id
WHERE u.status = 'normal'
GROUP BY u.id;

CREATE UNIQUE INDEX idx_mv_user_stats_user_id ON mv_user_stats(user_id);

-- 刷新物化视图的函数
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_stats;
  RAISE NOTICE 'Refreshed materialized views at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 执行信息
-- ========================================

-- 显示优化结果
DO $$
BEGIN
  RAISE NOTICE '===================================';
  RAISE NOTICE '数据库优化脚本执行完成';
  RAISE NOTICE '===================================';
  RAISE NOTICE '1. 已创建性能优化索引';
  RAISE NOTICE '2. 已添加数据完整性约束';
  RAISE NOTICE '3. 已创建监控基础设施';
  RAISE NOTICE '4. 已创建优化辅助函数';
  RAISE NOTICE '5. 已创建维护任务';
  RAISE NOTICE '6. 已创建查询优化视图';
  RAISE NOTICE '';
  RAISE NOTICE '请运行以下命令更新统计信息:';
  RAISE NOTICE 'SELECT update_table_statistics();';
  RAISE NOTICE '';
  RAISE NOTICE '查看未使用的索引:';
  RAISE NOTICE 'SELECT * FROM find_unused_indexes();';
  RAISE NOTICE '';
  RAISE NOTICE '查看需要维护的表:';
  RAISE NOTICE 'SELECT * FROM find_bloated_tables();';
END;
$$;