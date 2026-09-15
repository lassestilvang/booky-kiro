-- Create bookmarks (raindrops) table
CREATE TABLE IF NOT EXISTS bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    url TEXT NOT NULL,
    excerpt TEXT,
    content_snapshot_path TEXT,
    content_indexed BOOLEAN DEFAULT FALSE,
    type VARCHAR(20) CHECK (type IN ('article', 'video', 'image', 'file', 'document')),
    domain VARCHAR(255),
    cover_url TEXT,
    is_duplicate BOOLEAN DEFAULT FALSE,
    is_broken BOOLEAN DEFAULT FALSE,
    custom_order INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_bookmarks_owner ON bookmarks(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_collection ON bookmarks(collection_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_domain ON bookmarks(domain);
CREATE INDEX IF NOT EXISTS idx_bookmarks_url_hash ON bookmarks(md5(url));
CREATE INDEX IF NOT EXISTS idx_bookmarks_type ON bookmarks(type);
CREATE INDEX IF NOT EXISTS idx_bookmarks_is_duplicate ON bookmarks(is_duplicate) WHERE is_duplicate = TRUE;
CREATE INDEX IF NOT EXISTS idx_bookmarks_is_broken ON bookmarks(is_broken) WHERE is_broken = TRUE;
