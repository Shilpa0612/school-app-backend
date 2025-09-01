import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, _next) => {
    logger.error('Error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        code: err.code,
        details: err.details,
        hint: err.hint,
        body: req.body,
        query: req.query,
        params: req.params,
        user: req.user?.id
    });

    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            status: 'error',
            message: 'Validation Error',
            details: 'Request validation failed',
            errors: err.errors,
            suggestion: 'Please check your request data and try again'
        });
    }

    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            status: 'error',
            message: 'Unauthorized',
            details: 'Authentication required or invalid credentials',
            suggestion: 'Please provide valid authentication credentials'
        });
    }

    // Handle database-specific errors
    if (err.code) {
        switch (err.code) {
            case '23505': // Unique constraint violation
                return res.status(400).json({
                    status: 'error',
                    message: 'Duplicate entry',
                    details: 'The operation would create a duplicate record',
                    error_code: err.code,
                    suggestion: 'Please check for existing records and modify your request'
                });
            case '23503': // Foreign key constraint violation
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid reference',
                    details: 'One or more referenced records do not exist',
                    error_code: err.code,
                    suggestion: 'Please verify that all referenced IDs are valid and exist'
                });
            case '23514': // Check constraint violation
                return res.status(400).json({
                    status: 'error',
                    message: 'Data constraint violation',
                    details: err.message || 'Data does not meet the required constraints',
                    error_code: err.code,
                    suggestion: 'Please check your data values and ensure they meet the requirements'
                });
            case '22P02': // Invalid UUID format
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid ID format',
                    details: 'One or more IDs are not in valid UUID format',
                    error_code: err.code,
                    suggestion: 'Please ensure all IDs are valid UUIDs'
                });
            case 'PGRST116': // Supabase: No rows returned
                return res.status(404).json({
                    status: 'error',
                    message: 'Resource not found',
                    details: 'The requested resource could not be found',
                    error_code: err.code,
                    suggestion: 'Please verify the resource ID and try again'
                });
        }
    }

    // Default error with enhanced details
    const statusCode = err.statusCode || 500;
    const isProduction = process.env.NODE_ENV === 'production';
    
    const response = {
        status: 'error',
        message: isProduction ? 'Internal Server Error' : err.message,
        details: isProduction 
            ? 'An unexpected error occurred. Please contact support if this persists.'
            : err.message,
        error_code: err.code || 'UNKNOWN_ERROR',
        error_type: err.name || 'UnknownError',
        suggestion: 'Please try again. If the error persists, contact technical support.',
        timestamp: new Date().toISOString(),
        endpoint: `${req.method} ${req.path}`,
        // Include additional debug info only in development
        ...(process.env.NODE_ENV !== 'production' && { 
            stack: err.stack,
            request_id: req.headers['x-request-id'] || 'unknown'
        })
    };

    return res.status(statusCode).json(response);
}; 