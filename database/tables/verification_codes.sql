-- 邮箱验证码表
-- 用于存储注册和找回密码的验证码
CREATE TABLE verification_codes (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(6) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('register', 'reset_password')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE NULL,
    is_used BOOLEAN DEFAULT FALSE,
    ip_address INET,
    user_agent TEXT,
    CONSTRAINT verification_codes_email_type_unique UNIQUE(email, type, is_used)
        DEFERRABLE INITIALLY DEFERRED
);

-- 创建索引
CREATE INDEX idx_verification_codes_email_type ON verification_codes(email, type);
CREATE INDEX idx_verification_codes_expires_at ON verification_codes(expires_at);
CREATE INDEX idx_verification_codes_created_at ON verification_codes(created_at);

-- 添加表注释
COMMENT ON TABLE verification_codes IS '邮箱验证码表，用于用户注册和密码重置';
COMMENT ON COLUMN verification_codes.id IS '主键ID';
COMMENT ON COLUMN verification_codes.email IS '接收验证码的邮箱地址';
COMMENT ON COLUMN verification_codes.code IS '6位数字验证码';
COMMENT ON COLUMN verification_codes.type IS '验证码类型：register=注册，reset_password=找回密码';
COMMENT ON COLUMN verification_codes.created_at IS '验证码创建时间';
COMMENT ON COLUMN verification_codes.expires_at IS '验证码过期时间（通常5-10分钟）';
COMMENT ON COLUMN verification_codes.used_at IS '验证码使用时间';
COMMENT ON COLUMN verification_codes.is_used IS '是否已使用';
COMMENT ON COLUMN verification_codes.ip_address IS '请求IP地址';
COMMENT ON COLUMN verification_codes.user_agent IS '客户端User-Agent';