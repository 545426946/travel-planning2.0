-- supabase/migrations/20241124_create_wechat_login_tables.sql
-- 微信登录相关数据库表结构

-- 用户表（更新版本，支持微信登录）
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  openid VARCHAR(100) UNIQUE NOT NULL,  -- 微信 OpenID
  unionid VARCHAR(100),                    -- 微信 UnionID（可选）
  name VARCHAR(100) NOT NULL,
  avatar TEXT,
  gender INTEGER DEFAULT 0,                -- 性别：0-未知，1-男，2-女
  city VARCHAR(50),
  province VARCHAR(50),
  country VARCHAR(50),
  login_type VARCHAR(20) DEFAULT 'wechat', -- 登录类型
  has_real_info BOOLEAN DEFAULT FALSE,       -- 是否有真实用户信息
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_time TIMESTAMP WITH TIME ZONE,
  login_count INTEGER DEFAULT 1,            -- 登录次数
  
  -- 索引
  INDEX idx_users_openid (openid),
  INDEX idx_users_login_type (login_type),
  INDEX idx_users_last_login (last_login_time)
);

-- 用户会话表（用于管理登录态）
CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  openid VARCHAR(100) NOT NULL,
  session_key TEXT,                         -- 微信 session_key（加密存储）
  token VARCHAR(500) NOT NULL UNIQUE,         -- 自定义登录态 token
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 索引
  INDEX idx_sessions_token (token),
  INDEX idx_sessions_openid (openid),
  INDEX idx_sessions_user_id (user_id),
  INDEX idx_sessions_expires (expires_at),
  INDEX idx_sessions_active (is_active)
);

-- 登录日志表（用于安全审计）
CREATE TABLE IF NOT EXISTS login_logs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  openid VARCHAR(100) NOT NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  login_type VARCHAR(20) DEFAULT 'wechat',
  ip_address INET,
  user_agent TEXT,
  login_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  login_result VARCHAR(20) DEFAULT 'success', -- success, failed, blocked
  error_message TEXT,
  
  -- 索引
  INDEX idx_logs_openid (openid),
  INDEX idx_logs_user_id (user_id),
  INDEX idx_logs_time (login_time),
  INDEX idx_logs_result (login_result)
);

-- 用户权限表（可选，用于角色管理）
CREATE TABLE IF NOT EXISTS user_roles (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- 用户角色关联表
CREATE TABLE IF NOT EXISTS user_role_assignments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  role_id BIGINT REFERENCES user_roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by BIGINT REFERENCES users(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- 确保用户角色唯一
  UNIQUE(user_id, role_id),
  INDEX idx_assignments_user (user_id),
  INDEX idx_assignments_role (role_id),
  INDEX idx_assignments_active (is_active)
);

-- 插入默认角色
INSERT INTO user_roles (name, description, permissions) VALUES 
(
  'user',
  '普通用户',
  '["read:own_profile", "update:own_profile", "create:travel_plan", "read:own_travel_plans", "update:own_travel_plans", "delete:own_travel_plans"]'
),
(
  'admin',
  '管理员',
  '["read:all_profiles", "update:any_profile", "delete:any_profile", "read:all_travel_plans", "update:any_travel_plan", "delete:any_travel_plan", "manage:users"]'
)
ON CONFLICT (name) DO NOTHING;

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW 
  EXECUTE PROCEDURE update_updated_at_column();

-- 创建清理过期会话的函数
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions 
  WHERE expires_at < NOW() OR (is_active = FALSE AND last_used_at < NOW() - INTERVAL '7 days');
END;
$$ LANGUAGE plpgsql;

-- 创建定期清理任务（需要 pg_cron 扩展）
-- SELECT cron.schedule('cleanup-sessions', '0 2 * * *', 'SELECT cleanup_expired_sessions();');

-- 创建 RLS (Row Level Security) 策略
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;

-- 用户表 RLS 策略
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid()::text = openid::text);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid()::text = openid::text);

-- 会话表 RLS 策略
CREATE POLICY "Users can view their own sessions" ON user_sessions
  FOR SELECT USING (auth.uid()::text = openid::text);

CREATE POLICY "Users can delete their own sessions" ON user_sessions
  FOR DELETE USING (auth.uid()::text = openid::text);

-- 登录日志 RLS 策略
CREATE POLICY "Users can view their own login logs" ON login_logs
  FOR SELECT USING (auth.uid()::text = openid::text);

-- 角色关联 RLS 策略
CREATE POLICY "Users can view their own role assignments" ON user_role_assignments
  FOR SELECT USING (auth.uid()::text IN (
    SELECT openid::text FROM users WHERE id = user_id
  ));

-- 创建有用的视图
CREATE OR REPLACE VIEW user_profile_extended AS
SELECT 
  u.*,
  COALESCE(ur.name, 'user') as role_name,
  COALESCE(ur.permissions, '[]') as permissions,
  CASE WHEN u.last_login_time > NOW() - INTERVAL '7 days' THEN TRUE ELSE FALSE END as is_recently_active,
  CASE WHEN u.login_count > 10 THEN 'active' WHEN u.login_count > 3 THEN 'regular' ELSE 'new' END as activity_level
FROM users u
LEFT JOIN user_role_assignments ura ON u.id = ura.user_id AND ura.is_active = TRUE
LEFT JOIN user_roles ur ON ura.role_id = ur.id;

-- 创建检查用户登录状态的函数
CREATE OR REPLACE FUNCTION check_user_session(token_text TEXT)
RETURNS TABLE(user_id BIGINT, openid VARCHAR(100), is_valid BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.user_id,
    us.openid,
    (us.token = token_text AND us.is_active = TRUE AND us.expires_at > NOW()) as is_valid
  FROM user_sessions us
  WHERE us.token = token_text;
END;
$$ LANGUAGE plpgsql;

-- 创建创建新会话的函数
CREATE OR REPLACE FUNCTION create_user_session(
  p_user_id BIGINT,
  p_openid VARCHAR(100),
  p_token VARCHAR(500),
  p_expires_hours INTEGER DEFAULT 720 -- 30天 = 720小时
)
RETURNS BIGINT AS $$
DECLARE
  v_session_id BIGINT;
BEGIN
  INSERT INTO user_sessions (
    user_id, 
    openid, 
    token, 
    expires_at
  ) VALUES (
    p_user_id,
    p_openid,
    p_token,
    NOW() + (p_expires_hours || ' hours')::INTERVAL
  )
  RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;