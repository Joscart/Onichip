const { Geofence } = require('../models/ubicacion');
const Mascota = require('../models/mascota');

const geofenceController = {};

// 🗺️ CREAR NUEVO GEOFENCE
geofenceController.createGeofence = async (req, res) => {
    try {
        const { 
            mascotaId, 
            name, 
            description, 
            geometry, 
            color, 
            icon,
            alertSettings 
        } = req.body;

        console.log(`🗺️ Creando geofence: ${name} para mascota: ${mascotaId}`);

        // Verificar que la mascota existe y pertenece al usuario
        const mascota = await Mascota.findById(mascotaId).populate('propietario');
        if (!mascota) {
            return res.status(404).json({ error: 'Mascota no encontrada' });
        }

        // Validar geometría
        if (!geometry || !geometry.type) {
            return res.status(400).json({ error: 'Geometría de geofence inválida' });
        }

        if (geometry.type === 'Circle') {
            if (!geometry.center || !geometry.radius) {
                return res.status(400).json({ 
                    error: 'Geofence circular requiere center y radius' 
                });
            }
        }

        if (geometry.type === 'Polygon') {
            if (!geometry.coordinates || !Array.isArray(geometry.coordinates[0])) {
                return res.status(400).json({ 
                    error: 'Geofence poligonal requiere coordinates válidas' 
                });
            }
        }

        const geofence = new Geofence({
            usuario: mascota.propietario._id,
            mascota: mascotaId,
            name,
            description,
            geometry,
            color: color || '#007bff',
            icon: icon || '📍',
            alertSettings: {
                onEnter: alertSettings?.onEnter !== false,
                onExit: alertSettings?.onExit !== false,
                onApproaching: alertSettings?.onApproaching || false,
                approachingDistance: alertSettings?.approachingDistance || 50,
                cooldownMinutes: alertSettings?.cooldownMinutes || 5
            }
        });

        await geofence.save();

        console.log(`✅ Geofence creado: ${name} (${geofence._id})`);

        res.status(201).json({
            success: true,
            message: 'Geofence creado exitosamente',
            geofence: {
                id: geofence._id,
                name: geofence.name,
                description: geofence.description,
                geometry: geofence.geometry,
                color: geofence.color,
                icon: geofence.icon,
                alertSettings: geofence.alertSettings,
                createdAt: geofence.createdAt
            }
        });

    } catch (error) {
        console.error('Error creando geofence:', error);
        res.status(500).json({ 
            error: 'Error creando geofence',
            details: error.message 
        });
    }
};

// 📋 OBTENER GEOFENCES DE UNA MASCOTA
geofenceController.getMascotaGeofences = async (req, res) => {
    try {
        const { mascotaId } = req.params;

        const geofences = await Geofence.find({ 
            mascota: mascotaId,
            active: true 
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            count: geofences.length,
            geofences: geofences.map(gf => ({
                id: gf._id,
                name: gf.name,
                description: gf.description,
                geometry: gf.geometry,
                color: gf.color,
                icon: gf.icon,
                alertSettings: gf.alertSettings,
                stats: gf.stats,
                createdAt: gf.createdAt,
                updatedAt: gf.updatedAt
            }))
        });

    } catch (error) {
        console.error('Error obteniendo geofences:', error);
        res.status(500).json({ 
            error: 'Error obteniendo geofences',
            details: error.message 
        });
    }
};

// 👥 OBTENER GEOFENCES DE UN USUARIO
geofenceController.getUserGeofences = async (req, res) => {
    try {
        const { usuarioId } = req.params;

        const geofences = await Geofence.find({ 
            usuario: usuarioId,
            active: true 
        })
        .populate('mascota', 'nombre especie')
        .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: geofences.length,
            geofences: geofences.map(gf => ({
                id: gf._id,
                name: gf.name,
                description: gf.description,
                mascota: {
                    id: gf.mascota._id,
                    nombre: gf.mascota.nombre,
                    especie: gf.mascota.especie
                },
                geometry: gf.geometry,
                color: gf.color,
                icon: gf.icon,
                alertSettings: gf.alertSettings,
                stats: gf.stats,
                createdAt: gf.createdAt
            }))
        });

    } catch (error) {
        console.error('Error obteniendo geofences del usuario:', error);
        res.status(500).json({ 
            error: 'Error obteniendo geofences del usuario',
            details: error.message 
        });
    }
};

// ✏️ ACTUALIZAR GEOFENCE
geofenceController.updateGeofence = async (req, res) => {
    try {
        const { geofenceId } = req.params;
        const updates = req.body;

        const geofence = await Geofence.findById(geofenceId);
        if (!geofence) {
            return res.status(404).json({ error: 'Geofence no encontrado' });
        }

        // Actualizar campos permitidos
        const allowedUpdates = ['name', 'description', 'color', 'icon', 'alertSettings', 'geometry'];
        const updateData = {};
        
        allowedUpdates.forEach(field => {
            if (updates[field] !== undefined) {
                updateData[field] = updates[field];
            }
        });

        const updatedGeofence = await Geofence.findByIdAndUpdate(
            geofenceId,
            updateData,
            { new: true, runValidators: true }
        );

        console.log(`✏️ Geofence actualizado: ${updatedGeofence.name}`);

        res.json({
            success: true,
            message: 'Geofence actualizado exitosamente',
            geofence: {
                id: updatedGeofence._id,
                name: updatedGeofence.name,
                description: updatedGeofence.description,
                geometry: updatedGeofence.geometry,
                color: updatedGeofence.color,
                icon: updatedGeofence.icon,
                alertSettings: updatedGeofence.alertSettings,
                updatedAt: updatedGeofence.updatedAt
            }
        });

    } catch (error) {
        console.error('Error actualizando geofence:', error);
        res.status(500).json({ 
            error: 'Error actualizando geofence',
            details: error.message 
        });
    }
};

// 🗑️ ELIMINAR GEOFENCE
geofenceController.deleteGeofence = async (req, res) => {
    try {
        const { geofenceId } = req.params;

        const geofence = await Geofence.findById(geofenceId);
        if (!geofence) {
            return res.status(404).json({ error: 'Geofence no encontrado' });
        }

        // Soft delete - marcar como inactivo
        geofence.active = false;
        await geofence.save();

        console.log(`🗑️ Geofence eliminado: ${geofence.name}`);

        res.json({
            success: true,
            message: 'Geofence eliminado exitosamente'
        });

    } catch (error) {
        console.error('Error eliminando geofence:', error);
        res.status(500).json({ 
            error: 'Error eliminando geofence',
            details: error.message 
        });
    }
};

// 📊 ESTADÍSTICAS DE GEOFENCE
geofenceController.getGeofenceStats = async (req, res) => {
    try {
        const { geofenceId } = req.params;
        const { days = 30 } = req.query;

        const geofence = await Geofence.findById(geofenceId);
        if (!geofence) {
            return res.status(404).json({ error: 'Geofence no encontrado' });
        }

        const since = new Date();
        since.setDate(since.getDate() - parseInt(days));

        // Obtener alertas recientes del geofence
        const { Ubicacion } = require('../models/ubicacion');
        const recentAlerts = await Ubicacion.find({
            mascota: geofence.mascota,
            'geofenceAlerts.geofenceId': geofenceId,
            timestamp: { $gte: since }
        })
        .select('geofenceAlerts timestamp')
        .sort({ timestamp: -1 })
        .limit(100);

        // Procesar estadísticas
        const stats = {
            totalEnters: 0,
            totalExits: 0,
            averageTimeInside: 0,
            recentActivity: []
        };

        recentAlerts.forEach(ubicacion => {
            ubicacion.geofenceAlerts.forEach(alert => {
                if (alert.geofenceId.toString() === geofenceId) {
                    if (alert.type === 'entered') stats.totalEnters++;
                    if (alert.type === 'exited') stats.totalExits++;
                    
                    stats.recentActivity.push({
                        type: alert.type,
                        timestamp: ubicacion.timestamp
                    });
                }
            });
        });

        res.json({
            success: true,
            geofence: {
                id: geofence._id,
                name: geofence.name
            },
            period: `${days} días`,
            stats: {
                ...stats,
                totalEvents: stats.totalEnters + stats.totalExits,
                recentActivity: stats.recentActivity.slice(0, 20)
            }
        });

    } catch (error) {
        console.error('Error obteniendo estadísticas de geofence:', error);
        res.status(500).json({ 
            error: 'Error obteniendo estadísticas',
            details: error.message 
        });
    }
};

module.exports = geofenceController;
