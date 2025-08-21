import { logger } from './logger.js';

/**
 * Enhanced error handler utility for better error messages
 */
export class EnhancedErrorHandler {

    /**
     * Handle database errors and return user-friendly messages
     */
    static handleDatabaseError(error, context = '') {
        logger.error(`Database error in ${context}:`, error);

        // PostgreSQL error codes
        switch (error.code) {
            case '23505': // Unique constraint violation
                return this.handleUniqueConstraintError(error, context);
            case '23503': // Foreign key constraint violation
                return this.handleForeignKeyError(error, context);
            case '22P02': // Invalid UUID
                return this.handleInvalidUUIDError(error, context);
            case '23502': // Not null violation
                return this.handleNotNullError(error, context);
            case '23514': // Check constraint violation
                return this.handleCheckConstraintError(error, context);
            case 'PGRST116': // No rows returned (Supabase)
                return this.handleNoRowsError(error, context);
            case 'PGRST204': // Column not found (Supabase)
                return this.handleColumnNotFoundError(error, context);
            default:
                return this.handleGenericDatabaseError(error, context);
        }
    }

    /**
     * Handle unique constraint violations
     */
    static handleUniqueConstraintError(error, context) {
        const message = error.message.toLowerCase();

        if (message.includes('admission_number')) {
            return {
                status: 400,
                error: {
                    message: 'Admission number already exists',
                    details: 'This admission number is already registered in the system',
                    field: 'admission_number',
                    suggestion: 'Please use a different admission number'
                }
            };
        }

        if (message.includes('phone_number')) {
            return {
                status: 400,
                error: {
                    message: 'Phone number already exists',
                    details: 'This phone number is already registered',
                    field: 'phone_number',
                    suggestion: 'Please use a different phone number'
                }
            };
        }

        if (message.includes('email')) {
            return {
                status: 400,
                error: {
                    message: 'Email already exists',
                    details: 'This email address is already registered',
                    field: 'email',
                    suggestion: 'Please use a different email address'
                }
            };
        }

        if (message.includes('roll_number')) {
            return {
                status: 400,
                error: {
                    message: 'Roll number already exists in this class',
                    details: 'This roll number is already assigned to another student',
                    field: 'roll_number',
                    suggestion: 'Please use a different roll number for this class'
                }
            };
        }

        return {
            status: 400,
            error: {
                message: 'Duplicate entry found',
                details: 'A record with this information already exists',
                suggestion: 'Please check your input and try again'
            }
        };
    }

    /**
     * Handle foreign key constraint violations
     */
    static handleForeignKeyError(error, context) {
        const message = error.message.toLowerCase();

        if (message.includes('class_division_id')) {
            return {
                status: 400,
                error: {
                    message: 'Invalid class division',
                    details: 'The specified class division does not exist',
                    field: 'class_division_id',
                    suggestion: 'Please verify the class division ID'
                }
            };
        }

        if (message.includes('student_id')) {
            return {
                status: 400,
                error: {
                    message: 'Invalid student',
                    details: 'The specified student does not exist',
                    field: 'student_id',
                    suggestion: 'Please verify the student ID'
                }
            };
        }

        if (message.includes('parent_id')) {
            return {
                status: 400,
                error: {
                    message: 'Invalid parent',
                    details: 'The specified parent does not exist',
                    field: 'parent_id',
                    suggestion: 'Please verify the parent ID'
                }
            };
        }

        return {
            status: 400,
            error: {
                message: 'Invalid reference',
                details: 'One of the referenced records does not exist',
                suggestion: 'Please verify all referenced IDs'
            }
        };
    }

    /**
     * Handle invalid UUID errors
     */
    static handleInvalidUUIDError(error, context) {
        return {
            status: 400,
            error: {
                message: 'Invalid ID format',
                details: 'The provided ID is not in valid UUID format',
                suggestion: 'Please provide a valid UUID'
            }
        };
    }

    /**
     * Handle not null constraint violations
     */
    static handleNotNullError(error, context) {
        const fieldMatch = error.message.match(/null value in column "([^"]+)"/);
        const field = fieldMatch ? fieldMatch[1] : 'unknown field';

        return {
            status: 400,
            error: {
                message: 'Required field missing',
                details: `The field "${field}" is required but was not provided`,
                field: field,
                suggestion: 'Please provide a value for this required field'
            }
        };
    }

    /**
     * Handle check constraint violations
     */
    static handleCheckConstraintError(error, context) {
        return {
            status: 400,
            error: {
                message: 'Invalid data value',
                details: 'The provided data does not meet the required constraints',
                suggestion: 'Please check the data format and constraints'
            }
        };
    }

    /**
     * Handle no rows returned errors (Supabase)
     */
    static handleNoRowsError(error, context) {
        return {
            status: 404,
            error: {
                message: 'Record not found',
                details: 'The requested record does not exist',
                suggestion: 'Please verify the ID or search criteria'
            }
        };
    }

    /**
     * Handle column not found errors (Supabase)
     */
    static handleColumnNotFoundError(error, context) {
        const columnMatch = error.message.match(/column "([^"]+)" does not exist/);
        const column = columnMatch ? columnMatch[1] : 'unknown column';

        return {
            status: 500,
            error: {
                message: 'Database schema issue',
                details: `The column "${column}" does not exist in the database table`,
                field: column,
                suggestion: 'This is a database configuration issue. Please contact the administrator.'
            }
        };
    }

    /**
     * Handle generic database errors
     */
    static handleGenericDatabaseError(error, context) {
        return {
            status: 500,
            error: {
                message: 'Database error',
                details: 'An unexpected database error occurred',
                error_code: error.code || 'UNKNOWN_ERROR',
                suggestion: 'Please try again later or contact support'
            }
        };
    }

    /**
     * Handle validation errors
     */
    static handleValidationError(errors) {
        return {
            status: 400,
            error: {
                message: 'Validation failed',
                details: 'Some fields failed validation',
                errors: errors.map(error => ({
                    field: error.path,
                    message: error.msg,
                    value: error.value
                })),
                suggestion: 'Please correct the validation errors and try again'
            }
        };
    }

    /**
     * Handle authentication errors
     */
    static handleAuthError(error, context) {
        return {
            status: 401,
            error: {
                message: 'Authentication failed',
                details: 'Invalid or missing authentication credentials',
                suggestion: 'Please provide valid authentication credentials'
            }
        };
    }

    /**
     * Handle authorization errors
     */
    static handleAuthorizationError(error, context) {
        return {
            status: 403,
            error: {
                message: 'Access denied',
                details: 'You do not have permission to perform this action',
                suggestion: 'Please contact an administrator if you believe this is an error'
            }
        };
    }

    /**
     * Handle not found errors
     */
    static handleNotFoundError(resource, id) {
        return {
            status: 404,
            error: {
                message: `${resource} not found`,
                details: `No ${resource.toLowerCase()} found with the provided ID`,
                resource: resource,
                id: id,
                suggestion: 'Please verify the ID or search criteria'
            }
        };
    }

    /**
     * Handle unexpected errors
     */
    static handleUnexpectedError(error, context) {
        logger.error(`Unexpected error in ${context}:`, error);

        return {
            status: 500,
            error: {
                message: 'Unexpected error occurred',
                details: 'An unexpected error occurred while processing your request',
                error_code: error.code || 'UNKNOWN_ERROR',
                suggestion: 'Please contact support if this error persists'
            }
        };
    }

    /**
     * Send error response
     */
    static sendErrorResponse(res, errorInfo) {
        return res.status(errorInfo.status).json({
            status: 'error',
            ...errorInfo.error
        });
    }
}

/**
 * Convenience functions for common error scenarios
 */
export const ErrorResponses = {
    /**
     * Send validation error response
     */
    validationError: (res, errors) => {
        const errorInfo = EnhancedErrorHandler.handleValidationError(errors);
        return EnhancedErrorHandler.sendErrorResponse(res, errorInfo);
    },

    /**
     * Send database error response
     */
    databaseError: (res, error, context) => {
        const errorInfo = EnhancedErrorHandler.handleDatabaseError(error, context);
        return EnhancedErrorHandler.sendErrorResponse(res, errorInfo);
    },

    /**
     * Send not found error response
     */
    notFound: (res, resource, id) => {
        const errorInfo = EnhancedErrorHandler.handleNotFoundError(resource, id);
        return EnhancedErrorHandler.sendErrorResponse(res, errorInfo);
    },

    /**
     * Send authentication error response
     */
    authError: (res, error, context) => {
        const errorInfo = EnhancedErrorHandler.handleAuthError(error, context);
        return EnhancedErrorHandler.sendErrorResponse(res, errorInfo);
    },

    /**
     * Send authorization error response
     */
    authorizationError: (res, error, context) => {
        const errorInfo = EnhancedErrorHandler.handleAuthorizationError(error, context);
        return EnhancedErrorHandler.sendErrorResponse(res, errorInfo);
    },

    /**
     * Send unexpected error response
     */
    unexpectedError: (res, error, context) => {
        const errorInfo = EnhancedErrorHandler.handleUnexpectedError(error, context);
        return EnhancedErrorHandler.sendErrorResponse(res, errorInfo);
    }
};
