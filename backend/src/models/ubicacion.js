const mongoose = require('mongoose');

// 🗺️ MODELO PRINCIPAL: DATOS DE UBICACIÓN GPS
const UbicacionSchema = new mongoose.Schema({
    mascota: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mascota',
        required: true
    },
    dispositivo: {
        id: { type: String, required: true },
        tipo: { type: String, enum: ['collar', 'chip', 'sensor'], default: 'chip' },
        version: { type: String, default: '1.0' }
    },
    // 📍 DATOS GPS PRINCIPALES
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        }
    },
    // 📊 METADATOS DE UBICACIÓN
    locationData: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
        accuracy: { type: Number, default: 5 }, // metros
        speed: { type: Number, default: 0 }, // km/h
        satellites: { type: Number, default: 0 },
        method: { type: String, enum: ['GPS', 'WiFi', 'Cell'], default: 'GPS' },
        altitude: { type: Number }
    },
    // 🔋 ESTADO DEL DISPOSITIVO
    battery: {
        level: { type: Number, min: 0, max: 100, required: true },
        charging: { type: Boolean, default: false },
        estimatedHours: { type: Number }
    },
    // 🚨 ALERTAS DE GEOFENCING
    geofenceAlerts: [{
        type: { type: String, enum: ['entered', 'exited', 'approaching'] },
        geofenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Geofence' },
        geofenceName: String,
        timestamp: { type: Date, default: Date.now },
        acknowledged: { type: Boolean, default: false }
    }],
    // ⏰ TIMESTAMPS
    timestamp: { type: Date, default: Date.now },
    receivedAt: { type: Date, default: Date.now },
    synchronized: { type: Boolean, default: true }
}, {
    timestamps: true
});

// 🗺️ MODELO DE GEOFENCES (ZONAS DE REFERENCIA)
const GeofenceSchema = new mongoose.Schema({
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    mascota: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mascota',
        required: true
    },
    // 📝 INFORMACIÓN BÁSICA
    name: { type: String, required: true },
    description: { type: String },
    color: { type: String, default: '#007bff' },
    icon: { type: String, default: '📍' },
    
    // 🗺️ GEOMETRÍA DE LA ZONA
    geometry: {
        type: {
            type: String,
            enum: ['Polygon', 'Circle'],
            required: true
        },
        // Para Circle: center point + radius
        center: {
            latitude: Number,
            longitude: Number
        },
        radius: Number, // metros
        
        // Para Polygon: array de puntos
        coordinates: [[Number]] // [longitude, latitude] pairs
    },
    
    // ⚙️ CONFIGURACIÓN DE ALERTAS
    alertSettings: {
        onEnter: { type: Boolean, default: true },
        onExit: { type: Boolean, default: true },
        onApproaching: { type: Boolean, default: false },
        approachingDistance: { type: Number, default: 50 }, // metros
        cooldownMinutes: { type: Number, default: 5 } // evitar spam de alertas
    },
    
    // 📊 ESTADÍSTICAS
    stats: {
        totalEnters: { type: Number, default: 0 },
        totalExits: { type: Number, default: 0 },
        totalTimeInside: { type: Number, default: 0 }, // minutos
        lastEntered: Date,
        lastExited: Date
    },
    
    active: { type: Boolean, default: true }
}, {
    timestamps: true
});

// 📱 MODELO PARA CACHE DE UBICACIONES WIFI
const WifiLocationCacheSchema = new mongoose.Schema({
    wifiFingerprint: { type: String, required: true, unique: true }, // Hash de MACs de WiFi
    location: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
        accuracy: { type: Number, required: true }
    },
    source: { type: String, enum: ['google', 'mozilla', 'manual'], default: 'google' },
    confidence: { type: Number, min: 0, max: 1, default: 0.5 },
    expiresAt: { type: Date, default: () => new Date(+new Date() + 7*24*60*60*1000) } // 7 días
}, {
    timestamps: true
});

// 🔍 ÍNDICES PARA OPTIMIZACIÓN
UbicacionSchema.index({ location: '2dsphere' }); // Índice geoespacial
UbicacionSchema.index({ mascota: 1, timestamp: -1 });
UbicacionSchema.index({ timestamp: -1 });
UbicacionSchema.index({ 'dispositivo.id': 1, timestamp: -1 });

GeofenceSchema.index({ usuario: 1, active: 1 });
GeofenceSchema.index({ mascota: 1, active: 1 });
GeofenceSchema.index({ 'geometry.center': '2dsphere' });

WifiLocationCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = {
    Ubicacion: mongoose.model('Ubicacion', UbicacionSchema),
    Geofence: mongoose.model('Geofence', GeofenceSchema),
    WifiLocationCache: mongoose.model('WifiLocationCache', WifiLocationCacheSchema)
};
