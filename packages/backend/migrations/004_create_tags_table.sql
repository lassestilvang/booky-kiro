-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    normalized_name VARCHAR(100) NOT NULL,
    color VARCHAR(7),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(owner_id, normalized_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tags_owner ON tags(owner_id);
CREATE INDEX IF NOT EXISTS idx_tags_normalized ON tags(normalized_name);
