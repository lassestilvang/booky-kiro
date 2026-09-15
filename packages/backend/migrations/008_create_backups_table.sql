-- Create backups table (Pro feature)
CREATE TABLE IF NOT EXISTS backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    size_bytes BIGINT,
    auto_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_backups_owner ON backups(owner_id);
CREATE INDEX IF NOT EXISTS idx_backups_created ON backups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backups_auto_generated ON backups(auto_generated);
