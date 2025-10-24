Write-Host "🧪 Testing Chat Message Approval Notifications" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

$BASE_URL = "https://ajws-school-ba8ae5e3f955.herokuapp.com/api"

Write-Host ""
Write-Host "1. Logging in as Principal..." -ForegroundColor Yellow

$principalBody = @{
    phone_number = "1234567891"
    password = "password123"
} | ConvertTo-Json

try {
    $principalResponse = Invoke-RestMethod -Uri "$BASE_URL/auth/login" -Method POST -Body $principalBody -ContentType "application/json"
    $principalToken = $principalResponse.data.token
    Write-Host "✅ Principal logged in: $($principalResponse.data.user.full_name)" -ForegroundColor Green
    Write-Host "Token: $principalToken" -ForegroundColor Gray
} catch {
    Write-Host "❌ Principal login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. Getting pending messages..." -ForegroundColor Yellow

try {
    $headers = @{
        "Authorization" = "Bearer $principalToken"
    }
    $pendingResponse = Invoke-RestMethod -Uri "$BASE_URL/chat/messages/pending" -Method GET -Headers $headers
    $messages = $pendingResponse.data.messages
    Write-Host "Found $($messages.Count) pending messages" -ForegroundColor Green
    
    if ($messages.Count -eq 0) {
        Write-Host "❌ No pending messages found" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "Available messages to approve:" -ForegroundColor Yellow
    for ($i = 0; $i -lt $messages.Count; $i++) {
        $msg = $messages[$i]
        Write-Host "$($i + 1). ID: $($msg.id)" -ForegroundColor White
        Write-Host "   Content: `"$($msg.content)`"" -ForegroundColor White
        Write-Host "   From: $($msg.sender.full_name)" -ForegroundColor White
        Write-Host "   Thread: $($msg.thread.title)" -ForegroundColor White
    }
    
    $messageToApprove = $messages[0]
    $messageId = $messageToApprove.id
    $threadId = $messageToApprove.thread_id
    
} catch {
    Write-Host "❌ Failed to get pending messages: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "3. Approving message: `"$($messageToApprove.content)`"" -ForegroundColor Yellow
Write-Host "   Message ID: $messageId" -ForegroundColor Gray

try {
    $approveResponse = Invoke-RestMethod -Uri "$BASE_URL/chat/messages/$messageId/approve" -Method POST -Headers $headers -ContentType "application/json"
    Write-Host "✅ Message approved successfully!" -ForegroundColor Green
    Write-Host "Response: $($approveResponse | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to approve message: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "4. Logging in as Parent..." -ForegroundColor Yellow

$parentBody = @{
    phone_number = "9923149457"
    password = "Temp@1234"
} | ConvertTo-Json

try {
    $parentResponse = Invoke-RestMethod -Uri "$BASE_URL/auth/login" -Method POST -Body $parentBody -ContentType "application/json"
    $parentToken = $parentResponse.data.token
    Write-Host "✅ Parent logged in: $($parentResponse.data.user.full_name)" -ForegroundColor Green
} catch {
    Write-Host "❌ Parent login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "5. Checking if parent can see approved message..." -ForegroundColor Yellow

try {
    $parentHeaders = @{
        "Authorization" = "Bearer $parentToken"
    }
    $threadResponse = Invoke-RestMethod -Uri "$BASE_URL/chat/messages?thread_id=$threadId" -Method GET -Headers $parentHeaders
    $threadMessages = $threadResponse.data.messages
    Write-Host "Parent can see $($threadMessages.Count) messages in thread" -ForegroundColor Green
    
    $approvedMessage = $threadMessages | Where-Object { $_.id -eq $messageId }
    if ($approvedMessage) {
        Write-Host "✅ Parent can see the approved message!" -ForegroundColor Green
        Write-Host "   Content: `"$($approvedMessage.content)`"" -ForegroundColor White
        Write-Host "   Status: $($approvedMessage.approval_status)" -ForegroundColor White
        if ($approvedMessage.approver) {
            Write-Host "   Approved by: $($approvedMessage.approver.full_name)" -ForegroundColor White
        }
    } else {
        Write-Host "❌ Parent cannot see the approved message" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Failed to get thread messages: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎯 NOTIFICATION TEST COMPLETE!" -ForegroundColor Cyan
Write-Host "📋 Check the server logs for notification activity:" -ForegroundColor Yellow
Write-Host "   - '💬 sendChatMessageApprovalNotifications called'" -ForegroundColor White
Write-Host "   - '📨 Sending message approval notification to parent'" -ForegroundColor White
Write-Host "   - '📡 Broadcasting approved message'" -ForegroundColor White
Write-Host "   - '✅ Message approval notification result'" -ForegroundColor White
Write-Host ""
Write-Host "📱 If notifications are working, parent should have received:" -ForegroundColor Yellow
Write-Host "   - WebSocket notification (if connected)" -ForegroundColor White
Write-Host "   - Firebase push notification" -ForegroundColor White
Write-Host "   - In-app notification record" -ForegroundColor White
