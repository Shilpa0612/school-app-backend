# WebSocket Connection Troubleshooting Guide

## Issue Description

You're experiencing a WebSocket connection error when trying to connect to `ws://localhost:3000` with a JWT token.

## Error Analysis

Based on the error logs, the main issue is **JWT token authentication failure** with "invalid signature" errors.

## Root Causes & Solutions

### 1. **JWT Secret Mismatch** ⭐ (Most Likely Cause)

**Problem**: The JWT token is signed with a different secret than what the server expects.

**Solution**:

1. Check your `.env` file for the `JWT_SECRET` value
2. Ensure the client is using the same JWT_SECRET to sign tokens
3. Verify the token is being generated correctly

**Steps to fix**:

```bash
# Check your .env file
cat .env | grep JWT_SECRET

# Make sure your client application uses the same secret
```

### 2. **Token Expiration**

**Problem**: The JWT token has expired.

**Solution**:

- Generate a fresh token by logging in again
- Check the token's expiration time in the payload

### 3. **Token Format Issues**

**Problem**: The token is malformed or corrupted.

**Solution**:

- Ensure the token is properly URL-encoded in the WebSocket URL
- Verify the token structure matches the expected format

### 4. **Server Not Running**

**Problem**: The WebSocket server is not active.

**Solution**:

```bash
# Check if server is running
netstat -ano | findstr :3000

# Start the server if needed
npm start
```

## Testing Steps

### Step 1: Verify Server Status

```bash
# Check if server is running on port 3000
curl http://localhost:3000/health
```

### Step 2: Test WebSocket Connection

```bash
# Run the test script
node test_websocket.js
```

### Step 3: Check JWT Token

Decode your JWT token at [jwt.io](https://jwt.io) to verify:

- Payload structure
- Expiration time
- Signature validity

## Common JWT Token Issues

### 1. **Wrong Secret**

```javascript
// ❌ Wrong - using different secrets
const token = jwt.sign(payload, "wrong_secret");
const decoded = jwt.verify(token, "correct_secret"); // This will fail

// ✅ Correct - using same secret
const token = jwt.sign(payload, process.env.JWT_SECRET);
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

### 2. **Token Structure Mismatch**

```javascript
// ❌ Wrong - missing required fields
const payload = { userId: "123" };

// ✅ Correct - includes all required fields
const payload = {
  userId: "123",
  role: "principal",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
};
```

### 3. **URL Encoding Issues**

```javascript
// ❌ Wrong - token not URL-encoded
const ws = new WebSocket(`ws://localhost:3000?token=${token}`);

// ✅ Correct - token properly encoded
const ws = new WebSocket(
  `ws://localhost:3000?token=${encodeURIComponent(token)}`
);
```

## Debugging Tools

### 1. **WebSocket Test Script**

Use the provided `test_websocket.js` script to test your connection.

### 2. **Browser Developer Tools**

- Open Network tab
- Look for WebSocket connection attempts
- Check for any error messages

### 3. **Server Logs**

Check the server logs for detailed error information:

```bash
# View recent logs
tail -f combined.log
```

## Environment Configuration

### Required Environment Variables

Make sure your `.env` file contains:

```env
JWT_SECRET=your_actual_jwt_secret_here
PORT=3000
NODE_ENV=development
```

### Verify Configuration

```bash
# Check if environment variables are loaded
node -e "console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set')"
```

## Client-Side Implementation

### Correct WebSocket Connection

```javascript
// Get token from your authentication system
const token = getAuthToken(); // Your auth function

// Connect to WebSocket
const ws = new WebSocket(
  `ws://localhost:3000?token=${encodeURIComponent(token)}`
);

ws.onopen = () => {
  console.log("Connected to WebSocket");
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

ws.onclose = (event) => {
  console.log("WebSocket closed:", event.code, event.reason);
};
```

## Server-Side Verification

### WebSocket Authentication Flow

1. Client connects with JWT token in URL
2. Server extracts token from query parameters
3. Server verifies token using `JWT_SECRET`
4. If valid, connection is established
5. If invalid, connection is closed with error code 1008

### Debug Server Authentication

Add logging to `websocketService.js`:

```javascript
// In handleConnection method
console.log("Token received:", token ? "Yes" : "No");
console.log("JWT_SECRET set:", process.env.JWT_SECRET ? "Yes" : "No");
```

## Quick Fix Checklist

- [ ] Server is running on port 3000
- [ ] JWT_SECRET is set in .env file
- [ ] Client uses same JWT_SECRET to sign tokens
- [ ] Token is not expired
- [ ] Token is properly URL-encoded
- [ ] Token payload contains required fields (userId, role, etc.)

## Next Steps

1. **Run the test script**: `node test_websocket.js`
2. **Check your .env file** for JWT_SECRET
3. **Verify token generation** in your client application
4. **Test with a fresh login** to get a new token
5. **Check server logs** for detailed error messages

## Support

If the issue persists:

1. Share the output of `test_websocket.js`
2. Provide your JWT token (decoded, not the actual token)
3. Share relevant server logs
4. Describe your client-side implementation
