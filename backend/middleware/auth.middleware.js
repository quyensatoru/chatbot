export default function authMiddleware(req, res, next) {
    try {
        const [_, token]  = req.headers['authorization']?.replace(" ");
        
        if(!token) throw new Error('No token provided');


    } catch (err) {
        console.error("error: " + err.message);
        return res.status(401).json({ success: false, error: 'Unauthorized' }); 
    }
    next();
}
