-- Create bookmark-tag junction table
CREATE TABLE IF NOT EXISTS bookmark_tags (
    bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (bookmark_id, tag_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookmark_tags_bookmark ON bookmark_tags(bookmark_id);
CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag ON bookmark_tags(tag_id);
