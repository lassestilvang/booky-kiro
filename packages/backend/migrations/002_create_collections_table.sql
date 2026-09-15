-- Create collections table
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    icon VARCHAR(100),
    is_public BOOLEAN DEFAULT FALSE,
    share_slug VARCHAR(50) UNIQUE,
    parent_id UUID REFERENCES collections(id) ON DELETE SET NULL,
    sort_order INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_collections_owner ON collections(owner_id);
CREATE INDEX IF NOT EXISTS idx_collections_parent ON collections(parent_id);
CREATE INDEX IF NOT EXISTS idx_collections_share_slug ON collections(share_slug) WHERE share_slug IS NOT NULL;
