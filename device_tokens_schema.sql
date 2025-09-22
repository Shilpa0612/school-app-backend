-- Device Tokens Schema for Push Notifications
-- This schema stores device tokens for push notifications

-- Create user_device_tokens table
CREATE TABLE IF NOT EXISTS user_device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_token TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    device_info JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_user_id ON user_device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_device_token ON user_device_tokens(device_token);
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_platform ON user_device_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_is_active ON user_device_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_last_used ON user_device_tokens(last_used);
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_user_active ON user_device_tokens(user_id, is_active) WHERE is_active = TRUE;

-- Create unique constraint to prevent duplicate tokens per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_device_tokens_unique ON user_device_tokens(user_id, device_token);

-- Add RLS (Row Level Security) policies
ALTER TABLE user_device_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own device tokens
CREATE POLICY "Users can manage their own device tokens" ON user_device_tokens
    FOR ALL USING (user_id = auth.uid());

-- Policy: System can manage all device tokens (for push notifications)
CREATE POLICY "System can manage all device tokens" ON user_device_tokens
    FOR ALL USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_device_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_user_device_tokens_updated_at
    BEFORE UPDATE ON user_device_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_user_device_tokens_updated_at();

-- Create function to clean up old inactive tokens
CREATE OR REPLACE FUNCTION cleanup_old_device_tokens(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_device_tokens 
    WHERE is_active = FALSE 
    AND last_used < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create view for active device tokens summary
CREATE OR REPLACE VIEW device_tokens_summary AS
SELECT 
    user_id,
    platform,
    COUNT(*) as total_tokens,
    COUNT(*) FILTER (WHERE is_active = TRUE) as active_tokens,
    MAX(last_used) as last_used_at,
    MIN(created_at) as first_created_at
FROM user_device_tokens
GROUP BY user_id, platform;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_device_tokens TO authenticated;
GRANT SELECT ON device_tokens_summary TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_device_tokens TO authenticated;

-- Insert sample data for testing (optional - remove in production)
-- Note: These are fake tokens for testing purposes
INSERT INTO user_device_tokens (user_id, device_token, platform, device_info) VALUES
(
    (SELECT id FROM users WHERE role = 'parent' LIMIT 1),
    'fake_android_token_12345',
    'android',
    '{"model": "Samsung Galaxy S21", "os_version": "Android 12", "app_version": "1.0.0"}'
),
(
    (SELECT id FROM users WHERE role = 'parent' LIMIT 1),
    'fake_ios_token_67890',
    'ios',
    '{"model": "iPhone 13", "os_version": "iOS 15", "app_version": "1.0.0"}'
);

COMMENT ON TABLE user_device_tokens IS 'Stores device tokens for push notifications';
COMMENT ON COLUMN user_device_tokens.device_token IS 'FCM/APNS device token for push notifications';
COMMENT ON COLUMN user_device_tokens.platform IS 'Device platform: android, ios, web';
COMMENT ON COLUMN user_device_tokens.device_info IS 'Additional device information in JSON format';
COMMENT ON COLUMN user_device_tokens.is_active IS 'Whether the device token is currently active';
COMMENT ON COLUMN user_device_tokens.last_used IS 'Last time this token was used for notifications';
