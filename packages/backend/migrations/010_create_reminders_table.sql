-- Create reminders table (Pro feature)
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    remind_at TIMESTAMP NOT NULL,
    notification_channels JSONB DEFAULT '["in_app"]',
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reminders_bookmark ON reminders(bookmark_id);
CREATE INDEX IF NOT EXISTS idx_reminders_owner ON reminders(owner_id);
CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at) WHERE NOT completed;
CREATE INDEX IF NOT EXISTS idx_reminders_completed ON reminders(completed);
