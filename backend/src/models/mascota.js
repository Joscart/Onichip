const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SensorSchema = new Schema({
  tipo: { type: String, required: true }, // 'gps', 'vitales', etc
  valores: { type: Schema.Types.Mixed, required: true }, // Puede ser objeto o array
  fecha: { type: Date, default: Date.now }
});

const DeviceSchema = new Schema({
  deviceId: { type: String, required: true, unique: true },
  nombre: { type: String }, // Alias opcional
  propietario: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  bateria: {
    voltaje: Number,
    cargando: Boolean
  },
  sensores: [SensorSchema], // Array de sensores (gps, vitales, etc)
  especie: { type: String },
  raza: { type: String },
  edad: { type: Number }
}, {
  timestamps: true
});

module.exports = mongoose.model('Device', DeviceSchema);
