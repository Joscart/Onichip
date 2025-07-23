const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MascotaSchema = new Schema({
  deviceId: { type: String, required: true, unique: true },
  nombre: { type: String, required: true },
  propietario: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  
  // 🗺️ DATOS GPS Y UBICACIÓN
  ubicacionActual: {
    latitud: { type: Number },
    longitud: { type: Number },
    precision: { type: Number, default: 5 },
    timestamp: { type: Date },
    metodo: { type: String, enum: ['GPS', 'WiFi', 'Cell'], default: 'GPS' }
  },
  
  // 📱 INFORMACIÓN DEL DISPOSITIVO
  dispositivo: {
    id: { type: String, required: true },
    tipo: { type: String, enum: ['collar', 'chip', 'sensor'], default: 'chip' },
    version: { type: String, default: '1.0' },
    ultimaConexion: { type: Date },
    estadoBateria: {
      nivel: { type: Number, min: 0, max: 100 },
      cargando: { type: Boolean, default: false },
      ultimaActualizacion: { type: Date }
    }
  },
  
  // 🐕 INFORMACIÓN DE LA MASCOTA
  especie: { type: String, required: true },
  raza: { type: String },
  edad: { type: Number, min: 0 },
  peso: { type: Number, min: 0 },
  color: { type: String },
  
  // 🏥 INFORMACIÓN MÉDICA
  veterinario: {
    nombre: String,
    telefono: String,
    direccion: String
  },
  
  // 📝 CONFIGURACIÓN
  configuracion: {
    frecuenciaReporte: { type: Number, default: 30 }, // segundos
    alertasActivas: { type: Boolean, default: true },
    compartirUbicacion: { type: Boolean, default: true }
  },
  
  // 📊 ESTADÍSTICAS
  estadisticas: {
    totalDistancia: { type: Number, default: 0 }, // km
    tiempoActividad: { type: Number, default: 0 }, // minutos
    zonasVisitadas: { type: Number, default: 0 },
    ultimaActividad: Date
  },
  
  activo: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Índices para optimización
MascotaSchema.index({ propietario: 1, activo: 1 });
MascotaSchema.index({ deviceId: 1 });
MascotaSchema.index({ 'dispositivo.id': 1 });

module.exports = mongoose.model('Mascota', MascotaSchema);
