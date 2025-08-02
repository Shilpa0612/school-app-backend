// Complete Offline Message Retrieval Implementation
// This shows how to get messages sent when the user was offline

class OfflineMessageManager {
    constructor(token, serverUrl) {
        this.token = token;
        this.serverUrl = serverUrl;
        this.lastCheckTime = this.getLastCheckTime();
    }

    /**
     * Get the last check time from local storage
     */
    getLastCheckTime() {
        const stored = localStorage.getItem('lastMessageCheck');
        return stored || '2024-01-01T00:00:00Z'; // Default to beginning of time
    }

    /**
     * Update the last check time
     */
    updateLastCheckTime(timestamp) {
        localStorage.setItem('lastMessageCheck', timestamp);
        this.lastCheckTime = timestamp;
    }

    /**
     * Fetch offline messages since last check
     */
    async fetchOfflineMessages() {
        try {
            console.log('Fetching offline messages since:', this.lastCheckTime);

            const response = await fetch(
                `${this.serverUrl}/api/chat/offline-messages?last_check_time=${this.lastCheckTime}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success') {
                console.log(`Found ${data.data.count} offline messages`);

                // Update last check time
                this.updateLastCheckTime(data.data.last_check_time);

                return data.data.messages;
            } else {
                throw new Error(data.message || 'Failed to fetch offline messages');
            }
        } catch (error) {
            console.error('Error fetching offline messages:', error);
            return [];
        }
    }

    /**
     * Get unread message count
     */
    async getUnreadCount() {
        try {
            const response = await fetch(
                `${this.serverUrl}/api/chat/unread-count`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success') {
                return data.data.unread_count;
            } else {
                throw new Error(data.message || 'Failed to get unread count');
            }
        } catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }

    /**
     * Mark messages as read for a thread
     */
    async markMessagesAsRead(threadId) {
        try {
            const response = await fetch(
                `${this.serverUrl}/api/chat/mark-read/${threadId}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success') {
                console.log(`Messages marked as read for thread: ${threadId}`);
                return true;
            } else {
                throw new Error(data.message || 'Failed to mark messages as read');
            }
        } catch (error) {
            console.error('Error marking messages as read:', error);
            return false;
        }
    }

    /**
     * Complete app startup flow for offline message sync
     */
    async initializeOfflineSync() {
        console.log('Starting offline message sync...');

        // Step 1: Get unread count for badge
        const unreadCount = await this.getUnreadCount();
        console.log(`Unread messages: ${unreadCount}`);

        // Update UI badge
        this.updateBadge(unreadCount);

        // Step 2: Fetch offline messages
        const offlineMessages = await this.fetchOfflineMessages();
        console.log(`Retrieved ${offlineMessages.length} offline messages`);

        // Step 3: Process offline messages
        this.processOfflineMessages(offlineMessages);

        // Step 4: Connect WebSocket for real-time
        this.connectWebSocket();

        return {
            unreadCount,
            offlineMessages
        };
    }

    /**
     * Process offline messages (update UI, play sounds, etc.)
     */
    processOfflineMessages(messages) {
        messages.forEach(message => {
            // Display message in UI
            this.displayMessage(message);

            // Play notification sound if app was closed
            if (this.wasAppClosed()) {
                this.playNotificationSound();
            }

            // Update thread list with new message
            this.updateThreadList(message);
        });
    }

    /**
     * Display a message in the UI
     */
    displayMessage(message) {
        // This would update your chat UI
        console.log('Displaying message:', {
            id: message.id,
            content: message.content,
            sender: message.sender?.full_name,
            threadId: message.thread_id,
            timestamp: message.created_at
        });

        // Example: Add to message list
        const messageElement = this.createMessageElement(message);
        document.getElementById('message-list').appendChild(messageElement);
    }

    /**
     * Create a message element for the UI
     */
    createMessageElement(message) {
        const div = document.createElement('div');
        div.className = 'message offline-message';
        div.innerHTML = `
            <div class="sender">${message.sender?.full_name || 'Unknown'}</div>
            <div class="content">${message.content}</div>
            <div class="time">${new Date(message.created_at).toLocaleTimeString()}</div>
        `;
        return div;
    }

    /**
     * Update badge with unread count
     */
    updateBadge(count) {
        const badge = document.getElementById('unread-badge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'block' : 'none';
        }
    }

    /**
     * Check if app was previously closed
     */
    wasAppClosed() {
        // Check if there's a significant gap between last check and now
        const lastCheck = new Date(this.lastCheckTime);
        const now = new Date();
        const timeDiff = now - lastCheck;

        // If more than 5 minutes, consider app was closed
        return timeDiff > 5 * 60 * 1000;
    }

    /**
     * Play notification sound
     */
    playNotificationSound() {
        // Play a notification sound for offline messages
        const audio = new Audio('/path/to/notification.mp3');
        audio.play().catch(e => console.log('Could not play sound:', e));
    }

    /**
     * Update thread list with new message
     */
    updateThreadList(message) {
        // Update the thread list to show new message preview
        const threadElement = document.querySelector(`[data-thread-id="${message.thread_id}"]`);
        if (threadElement) {
            const previewElement = threadElement.querySelector('.last-message');
            if (previewElement) {
                previewElement.textContent = message.content;
            }
        }
    }

    /**
     * Connect WebSocket for real-time updates
     */
    connectWebSocket() {
        // This would connect to your WebSocket service
        console.log('Connecting to WebSocket for real-time updates...');
        // Your WebSocket connection code here
    }
}

// React Native Example
class ReactNativeOfflineManager {
    constructor(token, serverUrl) {
        this.token = token;
        this.serverUrl = serverUrl;
        this.lastCheckTime = this.getLastCheckTime();
    }

    /**
     * Get last check time from AsyncStorage
     */
    async getLastCheckTime() {
        try {
            const stored = await AsyncStorage.getItem('lastMessageCheck');
            return stored || '2024-01-01T00:00:00Z';
        } catch (error) {
            console.error('Error getting last check time:', error);
            return '2024-01-01T00:00:00Z';
        }
    }

    /**
     * Update last check time in AsyncStorage
     */
    async updateLastCheckTime(timestamp) {
        try {
            await AsyncStorage.setItem('lastMessageCheck', timestamp);
            this.lastCheckTime = timestamp;
        } catch (error) {
            console.error('Error updating last check time:', error);
        }
    }

    /**
     * Fetch offline messages for React Native
     */
    async fetchOfflineMessages() {
        try {
            const response = await fetch(
                `${this.serverUrl}/api/chat/offline-messages?last_check_time=${this.lastCheckTime}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const data = await response.json();

            if (data.status === 'success') {
                // Update last check time
                await this.updateLastCheckTime(data.data.last_check_time);
                return data.data.messages;
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Error fetching offline messages:', error);
            return [];
        }
    }

    /**
     * Process offline messages in React Native
     */
    processOfflineMessages(messages, navigation) {
        messages.forEach(message => {
            // Update Redux store or state
            this.updateMessageStore(message);

            // Show local notification if app was in background
            if (this.wasAppInBackground()) {
                this.showLocalNotification(message);
            }

            // Navigate to chat if user taps notification
            this.handleNotificationTap(message, navigation);
        });
    }

    /**
     * Show local notification for offline message
     */
    showLocalNotification(message) {
        PushNotification.localNotification({
            title: message.sender?.full_name || 'New Message',
            message: message.content,
            data: {
                threadId: message.thread_id,
                messageId: message.id
            }
        });
    }

    /**
     * Handle notification tap
     */
    handleNotificationTap(message, navigation) {
        // Navigate to the specific chat thread
        navigation.navigate('Chat', {
            threadId: message.thread_id,
            threadTitle: message.sender?.full_name
        });
    }
}

// Usage Examples

// Web/JavaScript Usage
const offlineManager = new OfflineMessageManager('your-jwt-token', 'http://localhost:3000');

// App startup
document.addEventListener('DOMContentLoaded', async () => {
    const result = await offlineManager.initializeOfflineSync();
    console.log('Offline sync completed:', result);
});

// React Native Usage
const rnOfflineManager = new ReactNativeOfflineManager('your-jwt-token', 'http://localhost:3000');

// In your React Native app
useEffect(() => {
    const initializeOfflineSync = async () => {
        const messages = await rnOfflineManager.fetchOfflineMessages();
        rnOfflineManager.processOfflineMessages(messages, navigation);
    };

    initializeOfflineSync();
}, []);

// Manual offline message fetch
async function manuallyFetchOfflineMessages() {
    const messages = await offlineManager.fetchOfflineMessages();
    console.log('Manually fetched offline messages:', messages);
    return messages;
}

// Check for new messages periodically
setInterval(async () => {
    const unreadCount = await offlineManager.getUnreadCount();
    if (unreadCount > 0) {
        console.log(`You have ${unreadCount} unread messages`);
        // Optionally fetch them
        const messages = await offlineManager.fetchOfflineMessages();
        offlineManager.processOfflineMessages(messages);
    }
}, 30000); // Check every 30 seconds 