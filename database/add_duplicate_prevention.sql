-- 行程重复保存防护机制
-- 在数据库层面防止重复保存

-- 方法1：添加唯一约束（推荐）
-- 防止同一用户在相同日期保存相同目的地的行程
ALTER TABLE travel_plans 
DROP CONSTRAINT IF EXISTS unique_user_destination_dates;

ALTER TABLE travel_plans 
ADD CONSTRAINT unique_user_destination_dates 
UNIQUE (user_id, destination, start_date, end_date);

-- 方法2：添加内容哈希约束（更严格）
-- 首先添加内容哈希列
ALTER TABLE travel_plans 
DROP COLUMN IF EXISTS content_hash;

ALTER TABLE travel_plans 
ADD COLUMN content_hash VARCHAR(64);

-- 创建生成内容哈希的函数
CREATE OR REPLACE FUNCTION generate_content_hash(
    p_destination TEXT,
    p_start_date DATE,
    p_end_date DATE,
    p_travelers_count INTEGER,
    p_total_budget DECIMAL,
    p_travel_style VARCHAR(50)
) RETURNS VARCHAR(64) AS $$
BEGIN
    RETURN MD5(
        COALESCE(p_destination, '') || 
        COALESCE(p_start_date::TEXT, '') || 
        COALESCE(p_end_date::TEXT, '') || 
        COALESCE(p_travelers_count::TEXT, '') || 
        COALESCE(p_total_budget::TEXT, '') || 
        COALESCE(p_travel_style, '')
    );
END;
$$ LANGUAGE plpgsql;

-- 添加内容哈希唯一约束
ALTER TABLE travel_plans 
DROP CONSTRAINT IF EXISTS unique_content_hash;

ALTER TABLE travel_plants 
ADD CONSTRAINT unique_content_hash 
UNIQUE (user_id, content_hash);

-- 创建触发器，在插入和更新时自动生成内容哈希
CREATE OR REPLACE FUNCTION update_content_hash()
RETURNS TRIGGER AS $$
BEGIN
    NEW.content_hash := generate_content_hash(
        NEW.destination,
        NEW.start_date,
        NEW.end_date,
        NEW.travelers_count,
        NEW.total_budget,
        NEW.travel_style
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_content_hash ON travel_plans;

CREATE TRIGGER trigger_update_content_hash
    BEFORE INSERT OR UPDATE ON travel_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_content_hash();

-- 为现有数据生成内容哈希
UPDATE travel_plans 
SET content_hash = generate_content_hash(
    destination,
    start_date,
    end_date,
    travelers_count,
    total_budget,
    travel_style
)
WHERE content_hash IS NULL;

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_travel_plans_content_hash ON travel_plans(content_hash);
CREATE INDEX IF NOT EXISTS idx_travel_plans_user_destination ON travel_plans(user_id, destination);
CREATE INDEX IF NOT EXISTS idx_travel_plans_date_range ON travel_plans(user_id, start_date, end_date);

-- 测试数据去重（清理现有重复数据）
-- 查找重复的记录
WITH duplicate_records AS (
    SELECT 
        user_id,
        destination,
        start_date,
        end_date,
        COUNT(*) as record_count,
        MIN(id) as keep_id,
        array_agg(id) as all_ids
    FROM travel_plans
    WHERE user_id IS NOT NULL 
        AND destination IS NOT NULL
        AND start_date IS NOT NULL
        AND end_date IS NOT NULL
    GROUP BY user_id, destination, start_date, end_date
    HAVING COUNT(*) > 1
)
SELECT 
    user_id,
    destination,
    start_date,
    end_date,
    record_count,
    keep_id,
    all_ids
FROM duplicate_records
ORDER BY record_count DESC;

-- 如果需要清理重复数据，可以执行以下语句（谨慎操作！）
/*
DELETE FROM travel_plans 
WHERE id IN (
    SELECT id_to_delete
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY user_id, destination, start_date, end_date 
                ORDER BY created_at
            ) as rn
        FROM travel_plans
        WHERE user_id IS NOT NULL 
            AND destination IS NOT NULL
            AND start_date IS NOT NULL
            AND end_date IS NOT NULL
    ) ranked
    WHERE rn > 1
);
*/

COMMIT;