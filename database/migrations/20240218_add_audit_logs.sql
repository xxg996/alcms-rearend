BEGIN;

CREATE TABLE IF NOT EXISTS user_login_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    identifier VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failure')),
    failure_reason TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_login_logs_user_id ON user_login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_login_logs_status ON user_login_logs(status);
CREATE INDEX IF NOT EXISTS idx_user_login_logs_login_at ON user_login_logs(login_at);

CREATE TABLE IF NOT EXISTS system_operation_logs (
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

CREATE INDEX IF NOT EXISTS idx_sys_op_logs_operator ON system_operation_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_sys_op_logs_target ON system_operation_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_sys_op_logs_action ON system_operation_logs(action);
CREATE INDEX IF NOT EXISTS idx_sys_op_logs_created ON system_operation_logs(created_at);

CREATE TABLE IF NOT EXISTS points_audit_logs (
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

CREATE INDEX IF NOT EXISTS idx_points_audit_user ON points_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_points_audit_operator ON points_audit_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_points_audit_source ON points_audit_logs(source);

COMMIT;
