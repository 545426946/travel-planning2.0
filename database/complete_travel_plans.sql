-- 创建完整的 travel_plans 表结构
DO $$
BEGIN
    -- 检查表是否存在，如果不存在则创建
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'travel_plans') THEN
        CREATE TABLE travel_plans (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title TEXT NOT NULL,
            description TEXT,
            destination TEXT,
            start_date DATE,
            end_date DATE,
            total_days INTEGER DEFAULT 1,
            travelers_count INTEGER DEFAULT 1,
            total_budget DECIMAL(10,2),
            travel_style VARCHAR(50) DEFAULT 'comfortable',
            interests JSONB,
            itinerary TEXT,
            is_ai_generated BOOLEAN DEFAULT FALSE,
            status VARCHAR(20) DEFAULT 'planned',
            tags TEXT[],
            transportation TEXT,
            accommodation TEXT,
            special_requirements TEXT,
            user_id UUID NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    ELSE
        -- 表存在，添加缺失的字段
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_plans' AND column_name = 'total_days') THEN
            ALTER TABLE travel_plans ADD COLUMN total_days INTEGER DEFAULT 1;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_plans' AND column_name = 'travelers_count') THEN
            ALTER TABLE travel_plans ADD COLUMN travelers_count INTEGER DEFAULT 1;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_plans' AND column_name = 'total_budget') THEN
            ALTER TABLE travel_plans ADD COLUMN total_budget DECIMAL(10,2);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_plans' AND column_name = 'travel_style') THEN
            ALTER TABLE travel_plans ADD COLUMN travel_style VARCHAR(50) DEFAULT 'comfortable';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_plans' AND column_name = 'interests') THEN
            ALTER TABLE travel_plans ADD COLUMN interests JSONB;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_plans' AND column_name = 'itinerary') THEN
            ALTER TABLE travel_plans ADD COLUMN itinerary TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_plans' AND column_name = 'is_ai_generated') THEN
            ALTER TABLE travel_plans ADD COLUMN is_ai_generated BOOLEAN DEFAULT FALSE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_plans' AND column_name = 'status') THEN
            ALTER TABLE travel_plans ADD COLUMN status VARCHAR(20) DEFAULT 'planned';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_plans' AND column_name = 'tags') THEN
            ALTER TABLE travel_plans ADD COLUMN tags TEXT[];
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_plans' AND column_name = 'transportation') THEN
            ALTER TABLE travel_plans ADD COLUMN transportation TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_plans' AND column_name = 'accommodation') THEN
            ALTER TABLE travel_plans ADD COLUMN accommodation TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_plans' AND column_name = 'special_requirements') THEN
            ALTER TABLE travel_plans ADD COLUMN special_requirements TEXT;
        END IF;
    END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_travel_plans_user_id ON travel_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_travel_plans_status ON travel_plans(status);
CREATE INDEX IF NOT EXISTS idx_travel_plans_destination ON travel_plans(destination);
CREATE INDEX IF NOT EXISTS idx_travel_plans_created_at ON travel_plans(created_at);
CREATE INDEX IF NOT EXISTS idx_travel_plans_is_ai_generated ON travel_plans(is_ai_generated);

-- 创建触发器更新 updated_at 字段
DROP TRIGGER IF EXISTS update_travel_plans_updated_at ON travel_plans;
CREATE TRIGGER update_travel_plans_updated_at 
    BEFORE UPDATE ON travel_plans 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 添加约束
ALTER TABLE travel_plans 
    ADD CONSTRAINT check_travel_status 
    CHECK (status IN ('planned', 'ongoing', 'completed', 'cancelled'));

-- 插入示例数据用于测试
INSERT INTO travel_plans (title, description, destination, start_date, end_date, total_days, travelers_count, total_budget, travel_style, itinerary, is_ai_generated, status, tags, transportation, accommodation, user_id)
VALUES 
(
    '北京三日游 - AI智能规划',
    '探索北京的历史文化，体验古都魅力',
    '北京',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '2 days',
    3,
    2,
    3000.00,
    'comfortable',
    'Day 1 - 2024-01-15：
🌅 上午 (8:00-12:00)：参观故宫博物院，感受皇家气派
🍽️ 午餐 (12:00-13:00)：品尝北京烤鸭
☀️ 下午 (13:00-17:00)：游览天安门广场
🍽️ 晚餐 (17:00-18:00)：老北京炸酱面
🌙 晚上 (18:00-22:00)：王府井步行街

Day 2 - 2024-01-16：
🌅 上午 (8:00-12:00)：长城八达岭
🍽️ 午餐 (12:00-13:00)：农家菜
☀️ 下午 (13:00-17:00)：颐和园
🍽️ 晚餐 (17:00-18:00)：全聚德烤鸭
🌙 晚上 (18:00-22:00)：后海酒吧街

Day 3 - 2024-01-17：
🌅 上午 (8:00-12:00)：天坛公园
🍽️ 午餐 (12:00-13:00)：豆汁儿焦圈
☀️ 下午 (13:00-17:00)：什刹海
🍽️ 晚餐 (17:00-18:00)：涮羊肉
🌙 晚上 (18:00-22:00)：整理行李，准备返程',
    TRUE,
    'planned',
    ARRAY['AI规划', '历史文化', '美食'],
    '地铁+出租车',
    '星级酒店',
    (SELECT id FROM users WHERE username = 'testuser' LIMIT 1)
)
ON CONFLICT DO NOTHING;

COMMIT;