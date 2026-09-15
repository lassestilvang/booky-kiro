-- Create collection permissions table (Pro feature)
CREATE TABLE IF NOT EXISTS collection_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(collection_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_collection_permissions_collection ON collection_permissions(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_permissions_user ON collection_permissions(user_id);
