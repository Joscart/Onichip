/**
 * ================================================
 * 📱 DEVICE CONTROLLER - GESTIÓN DE DISPOSITIVOS IOT
 * ================================================
 * 
 * Controlador para dispositivos ESP32 y chips IoT
 * Maneja datos de sensores, ubicación y telemetría
 * 
 * @author Onichip Team
 * @version 2.0
 */

const mongoose = require('mongoose');
const Mascota = require('../models/mascota');
const DatosIoT = require('../models/datosiot');
const { Ubicacion } = require('../models/ubicacion');

const deviceController = {};

/**
 * � Actualizar datos del dispositivo ESP32
 * 
 * @description Recibe y procesa datos telémétricos del chip IoT
 * @route PUT /api/dev/:deviceId
 * @access Device (ESP32)
 * 
 * @input {string} req.params.deviceId - ID único del dispositivo
 * @input {Object} req.body - Datos del dispositivo
 * @input {Object} req.body.bateria - Datos de batería
 * @input {Object} req.body.sensores - Datos de sensores
 * 
 * @output {Object} 200 - Datos procesados exitosamente
 * @output {Object} 404 - Dispositivo no registrado
 * @output {Object} 500 - Error interno del servidor
 */
deviceController.updateDeviceData = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { bateria, sensores } = req.body;
        
        console.log(`📡 Datos recibidos del device ${deviceId}:`, JSON.stringify(req.body, null, 2));
        
        // Buscar la mascota por deviceId
        let mascota = await Mascota.findOne({ deviceId });
        
        if (!mascota) {
            console.log(`❌ Device ${deviceId} no encontrado`);
            return res.status(404).json({ 
                success: false, 
                message: `Device ${deviceId} no registrado` 
            });
        }
        
        // Actualizar datos de batería
        if (bateria) {
            mascota.bateria = {
                voltaje: bateria.voltaje || mascota.bateria?.voltaje,
                cargando: bateria.cargando !== undefined ? bateria.cargando : mascota.bateria?.cargando
            };
        }
        
        // Procesar sensores y crear registro IoT
        let datosIoT = {
            mascota: mascota._id,
            dispositivo: {
                id: deviceId,
                tipo: 'chip',
                version: '1.2'
            },
            ubicacion: {},
            signosVitales: {},
            ambiente: {},
            alertas: [],
            bateria: {
                nivel: bateria?.voltaje ? Math.min(100, Math.max(0, (bateria.voltaje - 3.0) / 1.2 * 100)) : 85,
                estimadoHoras: 24
            },
            timestamp: new Date(),
            sincronizado: true
        };
        
        // Procesar cada sensor
        if (sensores && Array.isArray(sensores)) {
            sensores.forEach(sensor => {
                const { tipo, valores } = sensor;
                
                switch (tipo) {
                    case 'gps':
                        if (Array.isArray(valores) && valores.length >= 2) {
                            datosIoT.ubicacion = {
                                latitud: parseFloat(valores[0]),
                                longitud: parseFloat(valores[1]),
                                precision: 5
                            };
                            
                            if (valores[2]) {
                                datosIoT.signosVitales.actividad = 
                                    valores[2] > 5 ? 'corriendo' :
                                    valores[2] > 1 ? 'caminando' : 'descanso';
                            }
                        }
                        break;
                        
                    case 'vitales':
                        if (Array.isArray(valores) && valores.length > 0) {
                            const vitalValue = parseInt(valores[0]);
                            
                            // Simular conversión de valor analógico a signos vitales realistas
                            datosIoT.signosVitales = {
                                temperatura: 36.5 + (vitalValue % 100) / 100 * 2, // 36.5-38.5°C
                                frecuenciaCardiaca: 80 + (vitalValue % 50), // 80-130 bpm
                                frecuenciaRespiratoria: 15 + (vitalValue % 15), // 15-30 rpm
                                actividad: datosIoT.signosVitales.actividad || 'descanso'
                            };
                        }
                        break;
                        
                    case 'ambiente':
                        if (Array.isArray(valores) && valores.length > 0) {
                            datosIoT.ambiente = {
                                temperaturaAmbiente: parseFloat(valores[0]) || 22,
                                humedad: parseFloat(valores[1]) || 60,
                                calidad_aire: 'buena'
                            };
                        }
                        break;
                }
                
                // Agregar sensor al array de la mascota
                mascota.sensores.push({
                    tipo,
                    valores,
                    fecha: new Date()
                });
            });
        }
        
        // Mantener solo los últimos 10 registros de sensores por tipo
        const sensorTypes = ['gps', 'vitales', 'ambiente'];
        sensorTypes.forEach(tipo => {
            const sensoresDelTipo = mascota.sensores.filter(s => s.tipo === tipo);
            if (sensoresDelTipo.length > 10) {
                mascota.sensores = mascota.sensores.filter(s => s.tipo !== tipo);
                mascota.sensores.push(...sensoresDelTipo.slice(-10));
            }
        });
        
        // Generar alertas si es necesario
        if (datosIoT.signosVitales.temperatura) {
            if (datosIoT.signosVitales.temperatura > 39) {
                datosIoT.alertas.push({
                    tipo: 'temperatura_alta',
                    mensaje: `Temperatura elevada: ${datosIoT.signosVitales.temperatura.toFixed(1)}°C`,
                    timestamp: new Date(),
                    resuelto: false
                });
            } else if (datosIoT.signosVitales.temperatura < 36) {
                datosIoT.alertas.push({
                    tipo: 'temperatura_baja',
                    mensaje: `Temperatura baja: ${datosIoT.signosVitales.temperatura.toFixed(1)}°C`,
                    timestamp: new Date(),
                    resuelto: false
                });
            }
        }
        
        if (datosIoT.bateria.nivel < 20) {
            datosIoT.alertas.push({
                tipo: 'bateria_baja',
                mensaje: `Batería baja: ${datosIoT.bateria.nivel}%`,
                timestamp: new Date(),
                resuelto: false
            });
        }
        
        // Guardar mascota actualizada
        await mascota.save();
        
        // Crear registro IoT solo si tenemos datos válidos
        if (datosIoT.ubicacion.latitud || datosIoT.signosVitales.temperatura) {
            const nuevoRegistroIoT = new DatosIoT(datosIoT);
            await nuevoRegistroIoT.save();
            console.log(`✅ Registro IoT creado para ${mascota.nombre || deviceId}`);
        }
        
        console.log(`✅ Datos actualizados para ${mascota.nombre || deviceId}`);
        
        res.json({
            success: true,
            message: 'Datos actualizados correctamente',
            device: {
                id: deviceId,
                nombre: mascota.nombre,
                lastUpdate: new Date(),
                batteryLevel: datosIoT.bateria.nivel
            }
        });
        
    } catch (error) {
        console.error(`❌ Error procesando datos del device ${req.params.deviceId}:`, error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// 📊 Obtener estado del dispositivo (GET /api/dev/:deviceId)
deviceController.getDeviceStatus = async (req, res) => {
    try {
        const { deviceId } = req.params;
        
        const mascota = await Mascota.findOne({ deviceId }).populate('propietario', 'nombre email');
        
        if (!mascota) {
            return res.status(404).json({
                success: false,
                message: `Device ${deviceId} no encontrado`
            });
        }
        
        // Obtener último registro IoT
        const ultimoRegistro = await DatosIoT.findOne({ 
            'dispositivo.id': deviceId 
        }).sort({ timestamp: -1 });
        
        res.json({
            success: true,
            device: {
                id: deviceId,
                nombre: mascota.nombre,
                especie: mascota.especie,
                propietario: mascota.propietario,
                bateria: mascota.bateria,
                ultimoRegistro: ultimoRegistro,
                sensoresRecientes: mascota.sensores.slice(-5) // Últimos 5 sensores
            }
        });
        
    } catch (error) {
        console.error(`❌ Error obteniendo estado del device ${req.params.deviceId}:`, error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// 📋 Registrar un nuevo dispositivo (POST /api/dev/register)
deviceController.registerDevice = async (req, res) => {
    try {
        const { deviceId, nombre, especie, raza, edad, propietarioId } = req.body;
        
        // Verificar si el device ya existe
        const existingDevice = await Mascota.findOne({ deviceId });
        if (existingDevice) {
            return res.status(400).json({
                success: false,
                message: `Device ${deviceId} ya está registrado`
            });
        }
        
        const nuevaMascota = new Mascota({
            deviceId,
            nombre: nombre || `Mascota-${deviceId}`,
            especie: especie || 'Perro',
            raza: raza || 'Mestizo',
            edad: edad || 1,
            propietario: propietarioId,
            bateria: {
                voltaje: 4.0,
                cargando: false
            },
            sensores: []
        });
        
        await nuevaMascota.save();
        
        console.log(`✅ Nuevo device registrado: ${deviceId}`);
        
        res.json({
            success: true,
            message: 'Dispositivo registrado correctamente',
            device: {
                id: deviceId,
                nombre: nuevaMascota.nombre,
                mascotaId: nuevaMascota._id
            }
        });
        
    } catch (error) {
        console.error('❌ Error registrando device:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// 📍 Endpoint específico para actualizar ubicación (PUT /api/device/:deviceId/location)
deviceController.updateDeviceLocation = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { location, battery, timestamp } = req.body;
        
        console.log(`📍 Ubicación recibida del device ${deviceId}:`, JSON.stringify(req.body, null, 2));
        
        // Buscar mascota por deviceId
        let mascota = await Mascota.findOne({ 
            $or: [
                { 'dispositivo.id': deviceId },
                { deviceId: deviceId }
            ]
        });
        
        // Si no existe la mascota, crear una de prueba
        if (!mascota) {
            console.log(`🔄 Creando mascota de prueba para dispositivo ${deviceId}`);
            
            try {
                mascota = new Mascota({
                    deviceId: deviceId,
                    nombre: `Mascota-${deviceId}`,
                    especie: 'perro',
                    raza: 'Dispositivo de Prueba',
                    edad: 1,
                    peso: 10,
                    propietario: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
                    dispositivo: {
                        id: deviceId,
                        tipo: 'collar',
                        version: '2.0',
                        ultimaConexion: new Date(),
                        estadoBateria: {
                            nivel: 50,
                            cargando: false,
                            ultimaActualizacion: new Date()
                        }
                    },
                    configuracion: {
                        frecuenciaReporte: 30,
                        alertasActivas: true,
                        compartirUbicacion: true
                    }
                });
                
                await mascota.save();
                console.log(`✅ Mascota de prueba creada: ${mascota.nombre} (ID: ${mascota._id})`);
            } catch (saveError) {
                console.error('❌ Error creando mascota de prueba:', saveError);
                return res.status(500).json({
                    error: 'Error creando dispositivo de prueba',
                    details: saveError.message
                });
            }
        }
        
        // Actualizar datos de batería siempre
        if (battery) {
            const nivelPorcentaje = Math.round(Math.min(100, Math.max(0, ((battery.level - 3.0) / (4.2 - 3.0)) * 100)));
            
            // Asegurar que el dispositivo tenga toda la información necesaria
            if (!mascota.dispositivo) {
                mascota.dispositivo = {};
            }
            
            // Preservar y actualizar campos del dispositivo
            mascota.dispositivo.id = deviceId;
            mascota.dispositivo.tipo = mascota.dispositivo.tipo || 'collar';
            mascota.dispositivo.version = mascota.dispositivo.version || '2.0';
            mascota.dispositivo.ultimaConexion = new Date();
            
            // Actualizar batería
            if (!mascota.dispositivo.estadoBateria) {
                mascota.dispositivo.estadoBateria = {};
            }
            mascota.dispositivo.estadoBateria.nivel = nivelPorcentaje;
            mascota.dispositivo.estadoBateria.cargando = battery.charging || false;
            mascota.dispositivo.estadoBateria.ultimaActualizacion = new Date();
            
            console.log(`🔋 Batería actualizada: ${nivelPorcentaje}% (${battery.level}V) - Cargando: ${battery.charging ? 'Sí' : 'No'}`);
        }
        
        // Solo procesar ubicación si está presente y es válida
        if (location && location.latitude && location.longitude) {
            console.log(`📍 Procesando ubicación GPS: ${location.latitude}, ${location.longitude}`);
            
            // Crear registro de ubicación en DatosIoT (compatible con sistema existente)
            const datosIoT = new DatosIoT({
                mascota: mascota._id,
                dispositivo: {
                    id: deviceId,
                    tipo: 'collar', // Usar enum válido
                    version: '2.0'
                },
                ubicacion: {
                    latitud: location.latitude,
                    longitud: location.longitude,
                    precision: location.accuracy || 10
                },
                signosVitales: {
                    frecuenciaCardiaca: 80, // Valor válido dentro del rango
                    temperatura: 38.5, // Temperatura normal para perros
                    actividad: (location.speed || 0) > 1 ? 'corriendo' : 'descanso' // Usar enum válido
                },
                ambiente: {
                    temperaturaAmbiente: 25,
                    humedad: 60,
                    calidad_aire: 'buena'
                },
                alertas: [],
                bateria: {
                    nivel: battery?.level ? Math.min(100, Math.max(0, (battery.level - 3.0) / 1.2 * 100)) : 85,
                    estimadoHoras: battery?.charging ? 999 : 24
                },
                timestamp: timestamp ? new Date(timestamp) : new Date(),
                sincronizado: true
            });
            
            await datosIoT.save();
            
            // También crear registro en tabla Ubicacion
            const nuevaUbicacion = new Ubicacion({
                mascota: mascota._id,
                dispositivo: {
                    id: deviceId,
                    tipo: 'collar',
                    version: '2.0'
                },
                location: {
                    type: 'Point',
                    coordinates: [location.longitude, location.latitude]
                },
                locationData: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    accuracy: location.accuracy || 10,
                    speed: location.speed || 0,
                    satellites: location.satellites || 0,
                    method: location.method || 'GPS'
                },
                battery: {
                    level: battery ? Math.round(Math.min(100, Math.max(0, ((battery.level - 3.0) / (4.2 - 3.0)) * 100))) : 85,
                    charging: battery ? battery.charging : false
                },
                timestamp: timestamp ? new Date(timestamp) : new Date(),
                synchronized: true
            });
            
            await nuevaUbicacion.save();
            
            // Actualizar ubicación actual de la mascota
            mascota.ubicacionActual = {
                latitud: location.latitude,
                longitud: location.longitude,
                precision: location.accuracy || 10,
                timestamp: timestamp ? new Date(timestamp) : new Date(),
                metodo: location.method || 'GPS'
            };
            
            console.log(`✅ Ubicación GPS guardada para ${mascota.nombre}`);
        } else {
            console.log(`⚠️ Sin datos de ubicación válidos, solo actualizando batería`);
        }
        
        await mascota.save();
        
        res.json({
            success: true,
            message: location ? 'Ubicación y batería actualizadas correctamente' : 'Batería actualizada (sin ubicación GPS)',
            device: {
                id: deviceId,
                nombre: mascota.nombre,
                battery: battery,
                location: location || null,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Error actualizando ubicación:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

module.exports = deviceController;
