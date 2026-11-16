const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');

const router = express.Router();
const MAX_PASSWORD_BYTES = 72;

function serializeUser(user) {
    const id = String(user._id || user.id);
    return {
        id,
        _id: id,
        nombre: user.nombre,
        email: user.email,
        telefono: user.telefono || ''
    };
}

function issueToken(user) {
    return jwt.sign(
        { userId: String(user._id), email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
}

function validateCredentials(body) {
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const telefono = typeof body.telefono === 'string' ? body.telefono.trim() : '';
    const contrasena = typeof body.contrasena === 'string' ? body.contrasena : '';

    if (!nombre || !email || !contrasena) {
        return { error: 'nombre, email y contrasena son obligatorios' };
    }
    if (nombre.length > 120 || telefono.length > 30) {
        return { error: 'nombre o telefono excede la longitud permitida' };
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: 'email debe ser una dirección válida' };
    }
    if (Buffer.byteLength(contrasena, 'utf8') > MAX_PASSWORD_BYTES) {
        return { error: `contrasena no puede superar ${MAX_PASSWORD_BYTES} bytes` };
    }

    return { value: { nombre, email, telefono, contrasena } };
}

router.post('/register', async (req, res, next) => {
    const validated = validateCredentials(req.body || {});
    if (validated.error) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', mensaje: validated.error });
    }

    try {
        const { nombre, email, telefono, contrasena } = validated.value;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({
                error: 'EMAIL_ALREADY_REGISTERED',
                mensaje: 'El email ya está registrado'
            });
        }

        const hashedPassword = await bcrypt.hash(contrasena, 10);
        const user = await User.create({ nombre, email, telefono, contrasena: hashedPassword });
        return res.status(201).json({
            mensaje: 'OK',
            usuario: serializeUser(user),
            token: issueToken(user)
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                error: 'EMAIL_ALREADY_REGISTERED',
                mensaje: 'El email ya está registrado'
            });
        }
        return next(error);
    }
});

router.post('/login', async (req, res, next) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const contrasena = typeof req.body?.contrasena === 'string' ? req.body.contrasena : '';
    if (!email || !contrasena) {
        return res.status(400).json({
            error: 'VALIDATION_ERROR',
            mensaje: 'email y contrasena son obligatorios'
        });
    }
    if (Buffer.byteLength(contrasena, 'utf8') > MAX_PASSWORD_BYTES) {
        return res.status(400).json({
            error: 'VALIDATION_ERROR',
            mensaje: `contrasena no puede superar ${MAX_PASSWORD_BYTES} bytes`
        });
    }

    try {
        const user = await User.findOne({ email }).select('+contrasena');
        if (!user || !(await bcrypt.compare(contrasena, user.contrasena))) {
            return res.status(401).json({
                error: 'INVALID_CREDENTIALS',
                mensaje: 'Correo o contraseña incorrectos'
            });
        }

        return res.json({
            mensaje: 'OK',
            usuario: serializeUser(user),
            token: issueToken(user)
        });
    } catch (error) {
        return next(error);
    }
});

router.get('/profile', authenticate, (req, res) => res.json(serializeUser(req.user)));

router.put('/profile', authenticate, async (req, res, next) => {
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    const telefono = typeof req.body?.telefono === 'string' ? req.body.telefono.trim() : '';

    if (!nombre) {
        return res.status(400).json({
            error: 'VALIDATION_ERROR',
            mensaje: 'nombre es obligatorio'
        });
    }
    if (nombre.length > 120 || telefono.length > 30) {
        return res.status(400).json({
            error: 'VALIDATION_ERROR',
            mensaje: 'nombre o telefono excede la longitud permitida'
        });
    }

    try {
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $set: { nombre, telefono } },
            { new: true, runValidators: true }
        );
        if (!user) {
            return res.status(404).json({
                error: 'NOT_FOUND',
                mensaje: 'Usuario no encontrado'
            });
        }
        return res.json(serializeUser(user));
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
