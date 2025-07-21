const mongoose = require('mongoose');

const AdminSchema = mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        validate: {
            validator: function(email) {
                return email.endsWith('@onichip.com');
            },
            message: 'Solo administradores con dominio @onichip.com pueden acceder'
        }
    },
    password: {
        type: String,
        required: true
    },
    nombre: {
        type: String,
        required: true
    },
    rol: {
        type: String,
        enum: ['super_admin', 'admin', 'moderador'],
        default: 'admin'
    },
    permisos: {
        usuarios: { type: Boolean, default: true },
        mascotas: { type: Boolean, default: true },
        reportes: { type: Boolean, default: true },
        configuracion: { type: Boolean, default: false }
    },
    ultimoAcceso: {
        type: Date,
        default: Date.now
    },
    activo: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Admin', AdminSchema);