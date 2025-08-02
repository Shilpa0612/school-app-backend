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
app.use('/api/birthdays', (await import('./routes/birthdays.js')).default); // Add birthday routes
app.use('/api/classwork', (await import('./routes/classwork.js')).default); // Add classwork routes
app.use('/api/alerts', (await import('./routes/alerts.js')).default); // Add alerts routes
app.use('/api/chat', (await import('./routes/chat.js')).default); // Add chat routes
app.use('/api/lists', (await import('./routes/lists.js')).default); // Add lists routes
app.use('/api/analytics', (await import('./routes/analytics.js')).default); // Add analytics routes
app.use('/api/activities', (await import('./routes/activities.js')).default); // Add activities routes
app.use('/api/feedback', (await import('./routes/feedback.js')).default); // Add feedback routes

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
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
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
}); 