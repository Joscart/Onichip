const mongoose = require('mongoose');

const SensorSchema = new mongoose.Schema({
  tipo: { type: String, required: true },
  valores: { type: [Number], required: true }
});


const { v4: uuidv4 } = require('uuid');

const DeviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true, default: uuidv4 },
  bateria: {
    voltaje: { type: Number, required: true },
    cargando: { type: Boolean, required: true }
  },
  sensores: [SensorSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

// _id is created by default by Mongoose
module.exports = mongoose.model('Device', DeviceSchema, 'device');
