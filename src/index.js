import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

// Load environment variables FIRST
config();

// Create Express app
const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan('combined')); // Request logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// System Admin Route (must be before other routes)
app.use('/api/system', (await import('./routes/systemAdmin.js')).default);

// Regular Routes
app.use('/api/auth', (await import('./routes/auth.js')).default);
app.use('/api/users', (await import('./routes/users.js')).default);
app.use('/api/messages', (await import('./routes/messages.js')).default);
app.use('/api/homework', (await import('./routes/homework.js')).default);
app.use('/api/calendar', (await import('./routes/calendar.js')).default);
app.use('/api/leave-requests', (await import('./routes/leaveRequests.js')).default);
app.use('/api/parent-student', (await import('./routes/parentStudent.js')).default);
app.use('/api/academic', (await import('./routes/academic.js')).default);
app.use('/api/students', (await import('./routes/students.js')).default); // Add new students route
app.use('/api/parents', (await import('./routes/parents.js')).default); // Add new parents route
// app.use('/api/students-management', (await import('./routes/students-management.js')).default); // Removed - duplicate functionality
app.use('/api/birthdays', (await import('./routes/birthdays.js')).default); // Add birthday routes
app.use('/api/classwork', (await import('./routes/classwork.js')).default); // Add classwork routes
app.use('/api/alerts', (await import('./routes/alerts.js')).default); // Add alerts routes
app.use('/api/chat', (await import('./routes/chat.js')).default); // Add chat routes
app.use('/api/lists', (await import('./routes/lists.js')).default); // Add lists routes
app.use('/api/analytics', (await import('./routes/analytics.js')).default); // Add analytics routes
app.use('/api/activities', (await import('./routes/activities.js')).default); // Add activities routes
app.use('/api/feedback', (await import('./routes/feedback.js')).default); // Add feedback routes
app.use('/api/announcements', (await import('./routes/announcements.js')).default); // Add announcements routes
app.use('/api/timetable', (await import('./routes/timetable.js')).default); // Add timetable routes
app.use('/api/attendance', (await import('./routes/attendance.js')).default); // Add attendance routes
app.use('/api/stats', (await import('./routes/stats.js')).default); // Add statistics routes
app.use('/api/notifications', (await import('./routes/notifications.js')).default); // Add notifications routes
app.use('/api/notifications', (await import('./routes/notificationStream.js')).default); // Add notification streaming routes
app.use('/api/device-tokens', (await import('./routes/deviceTokens.js')).default); // Add device tokens routes

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Temporary debugging endpoint
app.get('/test-db', async (req, res) => {
    try {
        const { adminSupabase } = await import('./config/supabase.js');
        const { data, error } = await adminSupabase.from('users').select('count').limit(1);
        if (error) throw error;
        res.json({ status: 'success', message: 'Database connection working' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Error handling
app.use(errorHandler);

// Create HTTP server for WebSocket support
const server = createServer(app);

// Start server
const PORT = process.env.PORT || 3000;

// Initialize WebSocket service after server starts
server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`WebSocket server ready on ws://localhost:${PORT}`);

    // Initialize WebSocket service after server is listening
    (async () => {
        try {
            const { default: websocketService } = await import('./services/websocketService.js');
            websocketService.initialize(server);
            // Note: initializeNotificationServer is now handled by the main initialize method
            logger.info('WebSocket service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize WebSocket service:', error);
        }
    })();
}).on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use. Please kill the existing process or use a different port.`);
        process.exit(1);
    } else {
        logger.error('Server error:', error);
        process.exit(1);
    }
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);

    try {
        // Import and shutdown WebSocket service
        const { default: websocketService } = await import('./services/websocketService.js');
        websocketService.shutdown();
    } catch (error) {
        logger.error('Error shutting down WebSocket service:', error);
    }

    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown takes too long
    setTimeout(() => {
        logger.error('Graceful shutdown timeout, forcing exit');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT')); 