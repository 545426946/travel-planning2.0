-- =============================================
-- 足迹功能数据库表 - 在 Supabase SQL Editor 中执行
-- =============================================

-- 1. 创建足迹记录表
CREATE TABLE IF NOT EXISTS footprints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type VARCHAR(20) DEFAULT 'attraction',
  name VARCHAR(100) NOT NULL,
  province VARCHAR(50),
  city VARCHAR(50),
  district VARCHAR(50),
  latitude DECIMAL(10, 6) NOT NULL,
  longitude DECIMAL(10, 6) NOT NULL,
  address TEXT,
  photos TEXT[] DEFAULT '{}',
  note TEXT,
  plan_id UUID,
  checkin_time TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建旅行统计表
CREATE TABLE IF NOT EXISTS travel_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  total_provinces INTEGER DEFAULT 0,
  total_cities INTEGER DEFAULT 0,
  total_attractions INTEGER DEFAULT 0,
  total_distance INTEGER DEFAULT 0,
  total_trips INTEGER DEFAULT 0,
  visited_provinces TEXT[] DEFAULT '{}',
  visited_cities TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_footprints_user_id ON footprints(user_id);
CREATE INDEX IF NOT EXISTS idx_footprints_checkin_time ON footprints(checkin_time DESC);
CREATE INDEX IF NOT EXISTS idx_footprints_province ON footprints(province);
CREATE INDEX IF NOT EXISTS idx_travel_stats_user_id ON travel_stats(user_id);

-- 4. 启用 RLS
ALTER TABLE footprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_stats ENABLE ROW LEVEL SECURITY;

-- 5. 删除已存在的策略（如果有）
DROP POLICY IF EXISTS "Users can view own footprints" ON footprints;
DROP POLICY IF EXISTS "Users can insert own footprints" ON footprints;
DROP POLICY IF EXISTS "Users can update own footprints" ON footprints;
DROP POLICY IF EXISTS "Users can delete own footprints" ON footprints;
DROP POLICY IF EXISTS "Users can view own stats" ON travel_stats;
DROP POLICY IF EXISTS "Users can insert own stats" ON travel_stats;
DROP POLICY IF EXISTS "Users can update own stats" ON travel_stats;

-- 6. 创建 RLS 策略 - footprints
CREATE POLICY "Users can view own footprints" ON footprints
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own footprints" ON footprints
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own footprints" ON footprints
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own footprints" ON footprints
  FOR DELETE USING (auth.uid() = user_id);

-- 7. 创建 RLS 策略 - travel_stats
CREATE POLICY "Users can view own stats" ON travel_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stats" ON travel_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stats" ON travel_stats
  FOR UPDATE USING (auth.uid() = user_id);

-- 8. 授权
GRANT ALL ON footprints TO authenticated;
GRANT ALL ON travel_stats TO authenticated;

-- 完成提示
SELECT '足迹功能数据库表创建完成！' as message;
