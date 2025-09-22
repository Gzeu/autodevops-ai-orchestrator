import winston from 'winston';

export class ErrorHandler {
  static middleware(error, req, res, next) {
    // Log the error
    winston.error('API Error:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    });

    // Handle different types of errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message,
        details: error.details || []
      });
    }

    if (error.name === 'UnauthorizedError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File Too Large',
        message: 'Uploaded file exceeds size limit'
      });
    }

    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({
        error: 'Invalid JSON',
        message: 'Request body contains invalid JSON'
      });
    }

    // Default error response
    const statusCode = error.statusCode || error.status || 500;
    const message = process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : error.message;

    res.status(statusCode).json({
      error: 'Server Error',
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }

  static handleAsync(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  static createError(message, statusCode = 500, details = null) {
    const error = new Error(message);
    error.statusCode = statusCode;
    if (details) {
      error.details = details;
    }
    return error;
  }
}

// Global unhandled rejection and exception handlers
process.on('unhandledRejection', (reason, promise) => {
  winston.error('Unhandled Rejection:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
    timestamp: new Date().toISOString()
  });
});

process.on('uncaughtException', (error) => {
  winston.error('Uncaught Exception:', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  
  // Exit gracefully
  process.exit(1);
});