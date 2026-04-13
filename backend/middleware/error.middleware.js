export default function errorMiddleware(err, req, res, next) {
    console.error("error: " + err.message);
    
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';

    return res.status(status).json({
        success: false,
        error: message,
        timestamp: new Date(),
    });
}