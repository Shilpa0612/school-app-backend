import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

// Load environment variables
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

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Error handling
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
}); 