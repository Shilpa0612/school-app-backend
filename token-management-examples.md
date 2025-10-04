# Device Token Management - API Examples

## Problem Solved
Previously, users could have multiple active device tokens, which caused:
- Duplicate notifications
- Inconsistent delivery
- Database bloat
- Confusion in debugging

## New Solution
Now the system ensures **only one active token per user per platform**:
- When a new token is registered, all old tokens for that user/platform are deactivated
- Duplicate cleanup endpoints available
- Token statistics for monitoring

## API Endpoints

### 1. Register Device Token (Updated)
**POST** `/api/device-tokens/register`

**Behavior**: 
- Deactivates all existing tokens for the user/platform
- Registers new token as active
- If same token exists, reactivates it

**Example**:
```bash
curl -X POST http://localhost:3000/api/device-tokens/register \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_token": "new_fcm_token_here",
    "platform": "android",
    "device_info": {
      "model": "Samsung Galaxy S21",
      "os_version": "Android 12"
    }
  }'
```

### 2. Get Token Statistics
**GET** `/api/device-tokens/stats`

**Response**:
```json
{
  "status": "success",
  "data": {
    "total": 5,
    "active": 1,
    "inactive": 4,
    "byPlatform": {
      "android": {
        "total": 4,
        "active": 1,
        "inactive": 3
      },
      "ios": {
        "total": 1,
        "active": 0,
        "inactive": 1
      }
    }
  }
}
```

### 3. Clean Up Duplicates
**POST** `/api/device-tokens/cleanup-duplicates`

**Behavior**: 
- Keeps only the most recent active token per platform
- Deactivates older duplicates

**Response**:
```json
{
  "status": "success",
  "message": "Duplicate tokens cleaned up successfully",
  "data": {
    "cleaned": 3
  }
}
```

### 4. View All Tokens
**GET** `/api/device-tokens/my-tokens`

**Response**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid-here",
      "device_token": "fcm_token_here",
      "platform": "android",
      "device_info": {...},
      "is_active": true,
      "last_used": "2025-01-27T10:30:00Z",
      "created_at": "2025-01-27T10:30:00Z"
    }
  ]
}
```

## Testing Steps

### 1. Check Current State
```bash
# Get token statistics
curl -X GET http://localhost:3000/api/device-tokens/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# View all tokens
curl -X GET http://localhost:3000/api/device-tokens/my-tokens \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2. Clean Up Existing Duplicates
```bash
# Clean up duplicates
curl -X POST http://localhost:3000/api/device-tokens/cleanup-duplicates \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Register New Token (Auto-cleans old ones)
```bash
# Register new token (automatically deactivates old ones)
curl -X POST http://localhost:3000/api/device-tokens/register \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_token": "your_real_fcm_token",
    "platform": "android",
    "device_info": {
      "model": "Your Device Model",
      "os_version": "Android 12"
    }
  }'
```

### 4. Test Notification
```bash
# Send test notification
curl -X POST http://localhost:3000/api/device-tokens/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Token Management Test",
    "message": "This should only appear once per device"
  }'
```

## Benefits

1. **No More Duplicates**: Only one active token per user per platform
2. **Automatic Cleanup**: New registrations automatically deactivate old tokens
3. **Better Debugging**: Clear statistics and token visibility
4. **Consistent Delivery**: Notifications go to the right device
5. **Database Efficiency**: Reduced storage and query complexity

## Migration

For existing users with multiple tokens:
1. Call `/api/device-tokens/cleanup-duplicates` to clean up existing duplicates
2. Have users re-register their tokens (this will happen naturally when they use the app)
3. Monitor with `/api/device-tokens/stats` to ensure cleanup is working

## Monitoring

Use the stats endpoint to monitor:
- Total tokens per user
- Active vs inactive tokens
- Platform distribution
- Cleanup effectiveness
