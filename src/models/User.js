const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        maxlength: 254
    },
    telefono: {
        type: String,
        default: '',
        trim: true,
        maxlength: 30
    },
    contrasena: {
        type: String,
        required: true,
        select: false
    },
    fcmToken: {
        type: String,
        default: null,
        select: false
    },
    fechaCreacion: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('PersonalHealthUser', userSchema, 'users');
