const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UsuarioSchema = new Schema({
    nombre: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    mascotas: [{ type: Schema.Types.ObjectId, ref: 'Mascota' }], // Relación con mascotas
    fechaRegistro: { type: Date, default: Date.now }
}, {
    timestamps: true // Esto agrega createdAt y updatedAt automáticamente
});

module.exports = mongoose.model('Usuario', UsuarioSchema);
