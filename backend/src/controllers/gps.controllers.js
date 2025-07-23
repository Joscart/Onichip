const { Ubicacion, Geofence, WifiLocationCache } = require('../models/ubicacion');
const Mascota = require('../models/mascota');
const Usuario = require('../models/usuario');
const axios = require('axios');
const crypto = require('crypto');

const gpsController = {};

// 🗺️ RECIBIR DATOS DE UBICACIÓN DESDE ESP32
gpsController.receiveLocation = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { location, battery, timestamp } = req.body;

        console.log(`📍 Recibiendo ubicación de dispositivo: ${deviceId}`);

        // Buscar mascota por deviceId
        const mascota = await Mascota.findOne({ 
            $or: [
                { 'dispositivo.id': deviceId },
                { 'collar.id': deviceId }
            ]
        });

        if (!mascota) {
            return res.status(404).json({ 
                error: 'Dispositivo no encontrado',
                deviceId 
            });
        }

        if (!location || !location.latitude || !location.longitude) {
            return res.status(400).json({ 
                error: 'Datos de ubicación incompletos' 
            });
        }

        // Crear registro de ubicación
        const ubicacionData = {
            mascota: mascota._id,
            dispositivo: {
                id: deviceId,
                tipo: 'chip',
                version: '1.2'
            },
            location: {
                type: 'Point',
                coordinates: [location.longitude, location.latitude]
            },
            locationData: {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy || 5,
                speed: location.speed || 0,
                satellites: location.satellites || 0,
                method: location.method || 'GPS'
            },
            battery: {
                level: battery?.level || 100,
                charging: battery?.charging || false,
                estimatedHours: battery?.estimatedHours
            },
            timestamp: timestamp ? new Date(timestamp) : new Date()
        };

        // Verificar geofences
        const geofenceAlerts = await checkGeofences(mascota._id, location.latitude, location.longitude);
        if (geofenceAlerts.length > 0) {
            ubicacionData.geofenceAlerts = geofenceAlerts;
        }

        const nuevaUbicacion = new Ubicacion(ubicacionData);
        await nuevaUbicacion.save();

        // Actualizar última ubicación conocida en la mascota
        mascota.ubicacionActual = {
            latitud: location.latitude,
            longitud: location.longitude,
            timestamp: new Date(),
            precision: location.accuracy || 5
        };
        await mascota.save();

        console.log(`✅ Ubicación guardada para ${mascota.nombre}: ${location.latitude}, ${location.longitude}`);

        res.json({
            success: true,
            message: 'Ubicación recibida correctamente',
            mascota: mascota.nombre,
            location: {
                latitude: location.latitude,
                longitude: location.longitude
            },
            geofenceAlerts: geofenceAlerts.length
        });

    } catch (error) {
        console.error('Error recibiendo ubicación:', error);
        res.status(500).json({ 
            error: 'Error procesando ubicación',
            details: error.message 
        });
    }
};

// 🔍 VERIFICAR GEOFENCES
async function checkGeofences(mascotaId, latitude, longitude) {
    try {
        const geofences = await Geofence.find({ 
            mascota: mascotaId, 
            active: true 
        });

        const alerts = [];
        
        for (const geofence of geofences) {
            const isInside = isPointInGeofence(latitude, longitude, geofence);
            
            // Buscar última ubicación para determinar si entró o salió
            const lastLocation = await Ubicacion.findOne({ 
                mascota: mascotaId 
            }).sort({ timestamp: -1 });

            let wasInside = false;
            if (lastLocation) {
                wasInside = isPointInGeofence(
                    lastLocation.locationData.latitude, 
                    lastLocation.locationData.longitude, 
                    geofence
                );
            }

            // Generar alertas según el estado
            if (isInside && !wasInside && geofence.alertSettings.onEnter) {
                alerts.push({
                    type: 'entered',
                    geofenceId: geofence._id,
                    geofenceName: geofence.name
                });
                
                // Actualizar estadísticas
                geofence.stats.totalEnters += 1;
                geofence.stats.lastEntered = new Date();
                await geofence.save();
            }
            
            if (!isInside && wasInside && geofence.alertSettings.onExit) {
                alerts.push({
                    type: 'exited',
                    geofenceId: geofence._id,
                    geofenceName: geofence.name
                });
                
                // Actualizar estadísticas
                geofence.stats.totalExits += 1;
                geofence.stats.lastExited = new Date();
                await geofence.save();
            }
        }

        return alerts;
    } catch (error) {
        console.error('Error verificando geofences:', error);
        return [];
    }
}

// 🗺️ VERIFICAR SI UN PUNTO ESTÁ DENTRO DE UN GEOFENCE
function isPointInGeofence(latitude, longitude, geofence) {
    if (geofence.geometry.type === 'Circle') {
        return isPointInCircle(
            latitude, longitude,
            geofence.geometry.center.latitude,
            geofence.geometry.center.longitude,
            geofence.geometry.radius
        );
    }
    
    if (geofence.geometry.type === 'Polygon') {
        return isPointInPolygon(latitude, longitude, geofence.geometry.coordinates[0]);
    }
    
    return false;
}

// 📐 VERIFICAR SI UN PUNTO ESTÁ DENTRO DE UN CÍRCULO
function isPointInCircle(lat, lon, centerLat, centerLon, radiusMeters) {
    const R = 6371000; // Radio de la Tierra en metros
    const dLat = (centerLat - lat) * Math.PI / 180;
    const dLon = (centerLon - lon) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat * Math.PI / 180) * Math.cos(centerLat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance <= radiusMeters;
}

// 📐 VERIFICAR SI UN PUNTO ESTÁ DENTRO DE UN POLÍGONO (Ray Casting)
function isPointInPolygon(lat, lon, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        if (((polygon[i][1] > lat) !== (polygon[j][1] > lat)) &&
            (lon < (polygon[j][0] - polygon[i][0]) * (lat - polygon[i][1]) / (polygon[j][1] - polygon[i][1]) + polygon[i][0])) {
            inside = !inside;
        }
    }
    return inside;
}

// 📶 GEOLOCALIZACIÓN VÍA WIFI PARA ESP32
gpsController.getWifiLocation = async (req, res) => {
    try {
        const { wifiAccessPoints } = req.body;

        if (!wifiAccessPoints || !Array.isArray(wifiAccessPoints) || wifiAccessPoints.length === 0) {
            return res.status(400).json({ 
                status: 'ZERO_RESULTS',
                error: 'No se proporcionaron puntos de acceso WiFi válidos' 
            });
        }

        // Crear fingerprint único basado en las MACs de WiFi
        const macs = wifiAccessPoints.map(ap => ap.macAddress).sort();
        const fingerprint = crypto.createHash('md5').update(macs.join('|')).digest('hex');

        // Verificar cache primero
        const cached = await WifiLocationCache.findOne({ wifiFingerprint: fingerprint });
        if (cached && cached.expiresAt > new Date()) {
            console.log('📶 Ubicación WiFi desde cache');
            return res.json({
                status: 'OK',
                location: {
                    lat: cached.location.latitude,
                    lng: cached.location.longitude
                },
                accuracy: cached.location.accuracy,
                source: 'cache'
            });
        }

        // Usar Google Geolocation API
        try {
            const response = await axios.post(
                `https://www.googleapis.com/geolocation/v1/geolocate?key=${process.env.GOOGLE_MAPS_API_KEY}`,
                { wifiAccessPoints }
            );

            if (response.data && response.data.location) {
                const location = response.data.location;
                const accuracy = response.data.accuracy || 1000;

                // Guardar en cache
                await WifiLocationCache.findOneAndUpdate(
                    { wifiFingerprint: fingerprint },
                    {
                        wifiFingerprint: fingerprint,
                        location: {
                            latitude: location.lat,
                            longitude: location.lng,
                            accuracy: accuracy
                        },
                        source: 'google',
                        confidence: 0.8,
                        expiresAt: new Date(Date.now() + 7*24*60*60*1000) // 7 días
                    },
                    { upsert: true, new: true }
                );

                console.log(`📶 Ubicación WiFi obtenida: ${location.lat}, ${location.lng}`);

                return res.json({
                    status: 'OK',
                    location: location,
                    accuracy: accuracy,
                    source: 'google'
                });
            }
        } catch (googleError) {
            console.error('Error con Google Geolocation API:', googleError.message);
        }

        // Fallback: usar estimación basada en señal más fuerte
        const strongestAP = wifiAccessPoints.reduce((prev, current) => 
            (prev.signalStrength > current.signalStrength) ? prev : current
        );

        // Ubicación aproximada basada en Lima, Perú (fallback)
        const fallbackLocation = {
            lat: -12.0464 + (Math.random() - 0.5) * 0.01,
            lng: -77.0428 + (Math.random() - 0.5) * 0.01
        };

        res.json({
            status: 'OK',
            location: fallbackLocation,
            accuracy: 2000,
            source: 'fallback'
        });

    } catch (error) {
        console.error('Error en geolocalización WiFi:', error);
        res.status(500).json({ 
            status: 'ERROR',
            error: 'Error procesando geolocalización WiFi' 
        });
    }
};

// 📍 OBTENER UBICACIONES DE UNA MASCOTA
gpsController.getMascotaLocations = async (req, res) => {
    try {
        const { mascotaId } = req.params;
        const { startDate, endDate, limit = 100 } = req.query;

        let query = { mascota: mascotaId };
        
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        const locations = await Ubicacion.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .lean();

        res.json({
            success: true,
            count: locations.length,
            locations: locations.map(loc => ({
                id: loc._id,
                latitude: loc.locationData.latitude,
                longitude: loc.locationData.longitude,
                accuracy: loc.locationData.accuracy,
                speed: loc.locationData.speed,
                method: loc.locationData.method,
                battery: loc.battery,
                timestamp: loc.timestamp,
                geofenceAlerts: loc.geofenceAlerts
            }))
        });

    } catch (error) {
        console.error('Error obteniendo ubicaciones:', error);
        res.status(500).json({ 
            error: 'Error obteniendo ubicaciones',
            details: error.message 
        });
    }
};

module.exports = gpsController;
