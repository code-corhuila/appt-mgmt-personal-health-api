require('dotenv').config();
const app = require('./app');
const { connectDatabase, closeDatabase } = require('./config/database');

const port = Number(process.env.PORT || 3005);

async function start() {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is required and must match the Salud Activa authentication secret');
    }

    const server = app.listen(port, '0.0.0.0', () => {
        console.log(`Personal Health API listening on ${port}`);
    });
    connectDatabase().catch(error => {
        console.error('Personal Health MongoDB unavailable; API remains live but not ready:', error.message);
    });

    const shutdown = signal => {
        console.log(`Personal Health API received ${signal}`);
        server.close(error => {
            if (error) {
                console.error('HTTP server shutdown failed:', error.message);
                process.exitCode = 1;
            }
            closeDatabase().catch(closeError => {
                console.error('MongoDB shutdown failed:', closeError.message);
                process.exitCode = 1;
            });
        });
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
    start().catch(error => {
        console.error('Personal Health API startup failed:', error.message);
        process.exitCode = 1;
    });
}
