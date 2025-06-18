export const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    
    // Check if it's an AJAX request
    if (req.xhr || req.headers.accept && req.headers.accept.indexOf('json') > -1) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    res.redirect('/auth/login');
};

export const isNotAuthenticated = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return next();
    }
    res.redirect('/');
}; 