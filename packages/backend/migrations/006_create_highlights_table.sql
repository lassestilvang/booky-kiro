-- Create highlights table (Pro feature)
CREATE TABLE IF NOT EXISTS highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text_selected TEXT NOT NULL,
    color VARCHAR(7) DEFAULT '#FFFF00',
    annotation_md TEXT,
    position_context JSONB,
    snapshot_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_highlights_bookmark ON highlights(bookmark_id);
CREATE INDEX IF NOT EXISTS idx_highlights_owner ON highlights(owner_id);
