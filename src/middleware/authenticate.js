const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

async function authenticate(req, res, next) {
    const authorization = req.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'UNAUTHENTICATED',
            mensaje: 'Se requiere un token Bearer'
        });
    }

    let claims;
    try {
        claims = jwt.verify(authorization.slice('Bearer '.length), process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({
            error: 'INVALID_TOKEN',
            mensaje: 'El token es inválido o expiró'
        });
    }

    if (typeof claims.userId !== 'string' || !mongoose.isValidObjectId(claims.userId)) {
        return res.status(401).json({
            error: 'INVALID_TOKEN',
            mensaje: 'El token no identifica un usuario válido'
        });
    }

    try {
        const user = await User.findById(claims.userId);
        if (!user) {
            return res.status(401).json({
                error: 'INVALID_TOKEN',
                mensaje: 'El usuario de la sesión ya no existe'
            });
        }
        req.user = user;
        return next();
    } catch (error) {
        return next(error);
    }
}

module.exports = authenticate;
