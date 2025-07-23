const mongoose = require('mongoose');

const DatosIoTSchema = new mongoose.Schema({
    mascota: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mascota', // Ahora referencia al modelo Mascota
        required: true
    },
    dispositivo: {
        id: { type: String, required: true },
        tipo: { type: String, enum: ['collar', 'chip', 'sensor'], default: 'chip' },
        version: { type: String, default: '1.0' }
    },
    ubicacion: {
        latitud: { type: Number, required: true },
        longitud: { type: Number, required: true },
        precision: { type: Number, default: 5 }, // metros
        direccion: { type: String }
    },
    signosVitales: {
        temperatura: { type: Number, min: 35, max: 42 }, // °C
        frecuenciaCardiaca: { type: Number, min: 60, max: 200 }, // bpm
        frecuenciaRespiratoria: { type: Number, min: 10, max: 40 }, // rpm
        actividad: { type: String, enum: ['descanso', 'caminando', 'corriendo', 'jugando'], default: 'descanso' }
    },
    ambiente: {
        temperaturaAmbiente: { type: Number },
        humedad: { type: Number, min: 0, max: 100 },
        calidad_aire: { type: String, enum: ['excelente', 'buena', 'regular', 'mala'], default: 'buena' }
    },
    alertas: [{
        tipo: { type: String, enum: ['temperatura_alta', 'temperatura_baja', 'frecuencia_anormal', 'zona_peligrosa', 'bateria_baja'] },
        mensaje: String,
        timestamp: { type: Date, default: Date.now },
        resuelto: { type: Boolean, default: false }
    }],
    bateria: {
        nivel: { type: Number, min: 0, max: 100, default: 100 },
        estimadoHoras: { type: Number, default: 24 }
    },
    timestamp: { type: Date, default: Date.now },
    sincronizado: { type: Boolean, default: true }
}, {
    timestamps: true
});

// Índices para optimizar consultas
DatosIoTSchema.index({ mascota: 1, timestamp: -1 });
DatosIoTSchema.index({ timestamp: -1 });
DatosIoTSchema.index({ 'dispositivo.id': 1 });

module.exports = mongoose.model('DatosIoT', DatosIoTSchema);
