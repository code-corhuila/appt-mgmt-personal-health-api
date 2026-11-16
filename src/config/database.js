const mongoose = require('mongoose');

async function connectDatabase() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGODB_URI is required');
    }

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
}

async function closeDatabase() {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
}

function getDatabaseStatus() {
    return {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    }[mongoose.connection.readyState] || 'unknown';
}

module.exports = { connectDatabase, closeDatabase, getDatabaseStatus };
