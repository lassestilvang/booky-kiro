-- Create OAuth clients table
CREATE TABLE IF NOT EXISTS oauth_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR(255) UNIQUE NOT NULL,
    client_secret_hash VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    redirect_uris TEXT[] NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id);
