const Mascota = require('../models/mascota');
const DatosIoT = require('../models/datosiot');

const deviceController = {};

// 📱 Endpoint para recibir datos del ESP32 (PUT /api/dev/:deviceId)
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

module.exports = deviceController;
