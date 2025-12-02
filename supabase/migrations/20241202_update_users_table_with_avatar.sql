-- supabase/migrations/20241202_update_users_table_with_avatar.sql
-- 更新用户表，添加账号登录支持和完整头像功能

-- 首先检查是否需要更新现有用户表结构
DO $$
BEGIN
    -- 检查 users 表是否存在，如果不存在则创建
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        CREATE TABLE users (
            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
            openid VARCHAR(100) UNIQUE,                    -- 微信 OpenID（可选）
            unionid VARCHAR(100),                         -- 微信 UnionID（可选）
            username VARCHAR(50) UNIQUE,                   -- 用户名（账号登录）
            email VARCHAR(100) UNIQUE,                     -- 邮箱（可选）
            phone VARCHAR(20) UNIQUE,                      -- 手机号（可选）
            password VARCHAR(255),                         -- 密码（账号登录时需要）
            name VARCHAR(100) NOT NULL,                   -- 显示名称
            avatar TEXT,                                   -- 头像URL
            avatar_type VARCHAR(20) DEFAULT 'default',     -- 头像类型：default, wechat, upload
            gender INTEGER DEFAULT 0,                     -- 性别：0-未知，1-男，2-女
            city VARCHAR(50),
            province VARCHAR(50),
            country VARCHAR(50),
            language VARCHAR(10) DEFAULT 'zh_CN',
            login_type VARCHAR(20) DEFAULT 'wechat',       -- 登录类型：wechat, account
            status VARCHAR(20) DEFAULT 'active',           -- 状态：active, inactive, banned
            has_real_info BOOLEAN DEFAULT FALSE,           -- 是否有真实用户信息
            email_verified BOOLEAN DEFAULT FALSE,         -- 邮箱是否验证
            phone_verified BOOLEAN DEFAULT FALSE,         -- 手机是否验证
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_login TIMESTAMP WITH TIME ZONE,
            login_count INTEGER DEFAULT 1,                -- 登录次数
            
            -- 索引
            INDEX idx_users_openid (openid),
            INDEX idx_users_username (username),
            INDEX idx_users_email (email),
            INDEX idx_users_phone (phone),
            INDEX idx_users_login_type (login_type),
            INDEX idx_users_status (status),
            INDEX idx_users_last_login (last_login)
        );
    ELSE
        -- 表存在，添加缺失的字段
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'username') THEN
            ALTER TABLE users ADD COLUMN username VARCHAR(50) UNIQUE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email') THEN
            ALTER TABLE users ADD COLUMN email VARCHAR(100) UNIQUE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone') THEN
            ALTER TABLE users ADD COLUMN phone VARCHAR(20) UNIQUE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password') THEN
            ALTER TABLE users ADD COLUMN password VARCHAR(255);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar_type') THEN
            ALTER TABLE users ADD COLUMN avatar_type VARCHAR(20) DEFAULT 'default';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'status') THEN
            ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_verified') THEN
            ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone_verified') THEN
            ALTER TABLE users ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE;
        END IF;
        
        -- 添加缺失的索引
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_username') THEN
            CREATE INDEX idx_users_username ON users(username);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_email') THEN
            CREATE INDEX idx_users_email ON users(email);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_phone') THEN
            CREATE INDEX idx_users_phone ON users(phone);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_status') THEN
            CREATE INDEX idx_users_status ON users(status);
        END IF;
    END IF;
END $$;

-- 创建头像存储策略（使用 Supabase Storage）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    5242880, -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 创建头像访问策略
CREATE POLICY "Users can upload their own avatar" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'avatars' AND 
        auth.role() = 'authenticated' AND 
        (auth.uid()::text = (storage.foldername(name))[1] OR 
         auth.uid()::text = split_part(name, '/', 1))
    );

CREATE POLICY "Users can view their own avatar" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'avatars' AND 
        auth.role() = 'authenticated'
    );

CREATE POLICY "Users can update their own avatar" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'avatars' AND 
        auth.role() = 'authenticated' AND 
        (auth.uid()::text = (storage.foldername(name))[1] OR 
         auth.uid()::text = split_part(name, '/', 1))
    );

CREATE POLICY "Users can delete their own avatar" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'avatars' AND 
        auth.role() = 'authenticated' AND 
        (auth.uid()::text = (storage.foldername(name))[1] OR 
         auth.uid()::text = split_part(name, '/', 1))
    );

-- 创建默认头像的辅助函数
CREATE OR REPLACE FUNCTION get_default_avatar_url()
RETURNS TEXT AS $$
BEGIN
    -- 返回一个简单的默认头像，使用 CSS Avatars 或其他服务
    RETURN 'https://ui-avatars.com/api/?name=用户&background=667eea&color=fff&size=128';
END;
$$ LANGUAGE plpgsql;

-- 创建获取用户头像的函数
CREATE OR REPLACE FUNCTION get_user_avatar(user_id_param BIGINT)
RETURNS TEXT AS $$
DECLARE
    avatar_url TEXT;
    avatar_type_val VARCHAR(20);
    user_name TEXT;
BEGIN
    SELECT avatar, avatar_type, name INTO avatar_url, avatar_type_val, user_name
    FROM users 
    WHERE id = user_id_param;
    
    -- 如果没有头像或头像为空，返回默认头像
    IF avatar_url IS NULL OR avatar_url = '' THEN
        RETURN get_default_avatar_url();
    END IF;
    
    -- 如果是微信头像但URL无效，也返回默认头像
    IF avatar_type_val = 'wechat' AND avatar_url LIKE 'https://thirdwx.qlogo.cn%' THEN
        -- 可以在这里添加微信头像URL的验证逻辑
        -- 简单起见，直接使用微信头像，如果加载失败会在前端处理
        RETURN avatar_url;
    END IF;
    
    -- 如果是上传的头像，确保使用正确的 Supabase Storage URL
    IF avatar_type_val = 'upload' AND NOT avatar_url LIKE 'https://%' THEN
        RETURN current_setting('app.settings.supabase_url', true) || '/storage/v1/object/public/avatars/' || avatar_url;
    END IF;
    
    RETURN avatar_url;
END;
$$ LANGUAGE plpgsql;

-- 创建更新用户头像的函数
CREATE OR REPLACE FUNCTION update_user_avatar(
    user_id_param BIGINT,
    avatar_url_param TEXT,
    avatar_type_param VARCHAR(20) DEFAULT 'upload'
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE users 
    SET 
        avatar = avatar_url_param,
        avatar_type = avatar_type_param,
        updated_at = NOW()
    WHERE id = user_id_param;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器更新 updated_at 字段（如果不存在）
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 添加约束
ALTER TABLE users 
    ADD CONSTRAINT IF NOT EXISTS check_login_type 
    CHECK (login_type IN ('wechat', 'account'));

ALTER TABLE users 
    ADD CONSTRAINT IF NOT EXISTS check_user_status 
    CHECK (status IN ('active', 'inactive', 'banned'));

ALTER TABLE users 
    ADD CONSTRAINT IF NOT EXISTS check_avatar_type 
    CHECK (avatar_type IN ('default', 'wechat', 'upload'));

-- 创建更新用户资料的视图
CREATE OR REPLACE VIEW user_profile_with_avatar AS
SELECT 
    u.*,
    get_user_avatar(u.id) as avatar_display_url,
    CASE 
        WHEN u.avatar IS NULL OR u.avatar = '' THEN true 
        ELSE false 
    END as needs_default_avatar,
    CASE 
        WHEN u.last_login > NOW() - INTERVAL '7 days' THEN TRUE 
        ELSE FALSE 
    END as is_recently_active,
    CASE 
        WHEN u.login_count > 10 THEN 'active' 
        WHEN u.login_count > 3 THEN 'regular' 
        ELSE 'new' 
    END as activity_level
FROM users u;

COMMIT;