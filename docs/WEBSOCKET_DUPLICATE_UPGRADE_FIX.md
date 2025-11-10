# WebSocket Duplicate Upgrade Error Fix

## Problem Description

The application was experiencing a critical error where the WebSocket server would crash with:

```
Error: server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration
```

This error occurred because the application was creating **two separate WebSocket servers** on the same HTTP server instance, both trying to handle the upgrade event.

## Root Cause Analysis

### Original Implementation Issues

1. **Two WebSocket Servers**: The code was creating two separate `WebSocketServer` instances:
   - One for general chat (`websocketService.initialize()`)
   - One for notifications (`websocketService.initializeNotificationServer()`)

2. **Same HTTP Server**: Both servers were attached to the same HTTP server instance

3. **Upgrade Event Conflict**: When a WebSocket connection was established, both servers tried to handle the `upgrade` event, causing the duplicate call error

### Code Locations

- **`src/index.js`**: Lines 88-90 - Called both initialization methods
- **`src/services/websocketService.js`**: Lines 21-58 - Two separate server creation methods

## Solution Implemented

### 1. **Single WebSocket Server with Path-Based Routing**

Instead of creating two separate servers, we now use a single WebSocket server that routes connections based on the request path.

```javascript
// Before (❌ Problematic)
this.wss = new WebSocketServer({ server }); // General chat
this.notificationWss = new WebSocketServer({
  server,
  path: "/notifications/ws",
}); // Notifications

// After (✅ Fixed)
this.wss = new WebSocketServer({ server }); // Single server
// Route based on path in connection handler
```

### 2. **Path-Based Connection Routing**

```javascript
this.wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Route based on path
  if (pathname === "/notifications/ws") {
    this.handleNotificationConnection(ws, req);
  } else {
    this.handleConnection(ws, req);
  }
});
```

### 3. **Error Prevention Measures**

- **Multiple Initialization Prevention**: Added check to prevent re-initialization
- **Error Handling**: Added try-catch blocks around connection handling
- **Server Error Handling**: Added error event listener for the WebSocket server

## Files Modified

### 1. `src/services/websocketService.js`

**Changes Made:**

- ✅ Combined two WebSocket servers into one
- ✅ Added path-based routing logic
- ✅ Added multiple initialization prevention
- ✅ Added comprehensive error handling
- ✅ Kept `initializeNotificationServer()` for backward compatibility (now no-op)

**Key Methods Updated:**

- `initialize()` - Now handles both chat and notification routing
- `initializeNotificationServer()` - Now a no-op method for compatibility

### 2. `src/index.js`

**Changes Made:**

- ✅ Removed duplicate `initializeNotificationServer()` call
- ✅ Added comment explaining the change

## WebSocket Endpoints

After the fix, the application supports:

1. **General Chat WebSocket**: `ws://localhost:3000/`
   - Handles chat messages, real-time communication
   - Used by chat features, general messaging

2. **Notification WebSocket**: `ws://localhost:3000/notifications/ws`
   - Handles real-time notifications
   - Used by notification streaming features

## Testing the Fix

### 1. **Manual Testing**

```bash
# Start the server
npm start

# Test general chat WebSocket
wscat -c ws://localhost:3000

# Test notification WebSocket
wscat -c ws://localhost:3000/notifications/ws
```

### 2. **Automated Testing**

```bash
# Run the test script
node test_websocket_fix.js
```

### 3. **Expected Behavior**

- ✅ No "server.handleUpgrade() was called more than once" errors
- ✅ Both WebSocket endpoints work correctly
- ✅ Multiple simultaneous connections work
- ✅ Server remains stable under load

## Benefits of the Fix

### 1. **Eliminates Crash**

- ✅ No more duplicate upgrade errors
- ✅ Server remains stable
- ✅ No more Heroku crashes

### 2. **Improved Performance**

- ✅ Single WebSocket server instance
- ✅ Reduced memory usage
- ✅ Better resource management

### 3. **Maintainability**

- ✅ Single point of WebSocket management
- ✅ Easier to debug and monitor
- ✅ Cleaner code structure

### 4. **Backward Compatibility**

- ✅ Existing API calls still work
- ✅ No breaking changes for clients
- ✅ Same endpoint URLs

## Deployment Notes

### 1. **Zero Downtime Deployment**

- The fix is backward compatible
- No database changes required
- No client-side changes needed

### 2. **Monitoring**

- Watch for WebSocket connection logs
- Monitor server stability
- Check for any remaining upgrade errors

### 3. **Rollback Plan**

- If issues occur, revert to previous version
- The fix is isolated to WebSocket service only

## Verification Checklist

- [ ] Server starts without WebSocket errors
- [ ] General chat WebSocket connects successfully
- [ ] Notification WebSocket connects successfully
- [ ] Multiple connections work simultaneously
- [ ] No "duplicate upgrade" errors in logs
- [ ] Server remains stable under load
- [ ] All existing WebSocket features work

## Related Files

- `src/services/websocketService.js` - Main WebSocket service
- `src/index.js` - Server initialization
- `test_websocket_fix.js` - Test script
- `src/routes/notificationStream.js` - Notification WebSocket usage
- `src/routes/chat.js` - Chat WebSocket usage

## Conclusion

This fix resolves the critical WebSocket server crash issue by consolidating two separate WebSocket servers into a single, path-routed server. The solution maintains all existing functionality while eliminating the duplicate upgrade error that was causing server crashes.
