
import jwt from '../services/jwt.js';

const SECRET_KEY = process.env.JWT_SECRET || 'dev_secret_key_change_in_prod';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // Format: "Bearer <token>"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Přístup odepřen: Chybí autentizační token.' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Přístup odepřen: Neplatný token.' });
    }
    req.user = user;
    next();
  });
};

export const requireAdmin = (req, res, next) => {
    authenticateToken(req, res, () => {
        if (req.user && req.user.role === 'admin') {
            next();
        } else {
            res.status(403).json({ error: 'Přístup odepřen: Vyžadována práva administrátora.' });
        }
    });
};
