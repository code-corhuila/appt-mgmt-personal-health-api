const express = require('express');
const helmet = require('helmet');
const authRouter = require('./routes/auth');
const { getDatabaseStatus } = require('./config/database');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '16kb' }));

app.get('/health/live', (req, res) => res.json({ status: 'alive' }));

app.get('/health/ready', (req, res) => {
    const database = getDatabaseStatus();
    const ready = database === 'connected';
    return res.status(ready ? 200 : 503).json({
        status: ready ? 'ready' : 'degraded',
        database
    });
});

app.use('/api/auth', authRouter);

app.use((req, res) => res.status(404).json({
    error: 'NOT_FOUND',
    mensaje: 'Ruta no encontrada'
}));

app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({
            error: 'INVALID_JSON',
            mensaje: 'El cuerpo debe contener JSON válido'
        });
    }
    if (error.type === 'entity.too.large') {
        return res.status(413).json({
            error: 'PAYLOAD_TOO_LARGE',
            mensaje: 'El cuerpo excede 16kb'
        });
    }
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            error: 'VALIDATION_ERROR',
            mensaje: 'Los datos del perfil no son válidos'
        });
    }
    console.error('Unhandled personal health API error:', error.message);
    return res.status(500).json({
        error: 'INTERNAL_ERROR',
        mensaje: 'Error inesperado del servidor'
    });
});

module.exports = app;
