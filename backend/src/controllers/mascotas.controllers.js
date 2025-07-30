/**
 * ================================================
 * 🐕 MASCOTAS CONTROLLER - GESTIÓN DE MASCOTAS
 * ================================================
 * 
 * Controlador para operaciones CRUD de mascotas del sistema
 * Incluye gestión de mascotas, búsqueda por propietario y datos IoT
 * 
 * @author Onichip Team
 * @version 2.0
 */

const Mascota = require('../models/mascota');
const { broadcastMascotaUpdate } = require('../websocket');
const mascotaController = {};

/**
 * 🐕 Obtener todas las mascotas
 * 
 * @description Obtiene lista de todas las mascotas con datos del propietario
 * @route GET /api/mascotas
 * @access Public
 * 
 * @input None - No requiere parámetros
 * 
 * @output {Array} 200 - Lista de mascotas con propietario poblado
 * @output {Object} 500 - Error interno del servidor
 */
mascotaController.getMascotas = async (req, res) => {
    try {
        const mascotas = await Mascota.find().populate('propietario', 'nombre email');
        console.log(`✅ ${mascotas.length} mascotas obtenidas exitosamente`);
        res.json(mascotas);
    } catch (error) {
        console.error('❌ Error al obtener mascotas:', error);
        res.status(500).json({ message: 'Error al obtener mascotas' });
    }
};

/**
 * 🐾 Obtener mascota por ID
 * 
 * @description Obtiene una mascota específica con datos del propietario
 * @route GET /api/mascotas/:id
 * @access Public
 * 
 * @input {string} req.params.id - ID de la mascota a buscar
 * 
 * @output {Object} 200 - Mascota encontrada con propietario poblado
 * @output {Object} 404 - Mascota no encontrada
 * @output {Object} 500 - Error interno del servidor
 */
mascotaController.getMascota = async (req, res) => {
    try {
        const mascota = await Mascota.findById(req.params.id).populate('propietario', 'nombre email');
        
        if (!mascota) {
            return res.status(404).json({ message: 'Mascota no encontrada' });
        }
        
        console.log(`✅ Mascota obtenida: ${mascota.nombre}`);
        res.json(mascota);
    } catch (error) {
        console.error('❌ Error al obtener mascota:', error);
        res.status(500).json({ message: 'Error al obtener mascota' });
    }
};

/**
 * 👤 Obtener mascotas por propietario
 * 
 * @description Obtiene todas las mascotas de un propietario específico
 * @route GET /api/mascotas/owner/:ownerId
 * @access Public
 * 
 * @input {string} req.params.ownerId - ID del propietario
 * 
 * @output {Array} 200 - Lista de mascotas del propietario
 * @output {Object} 500 - Error interno del servidor
 */
mascotaController.getMascotasByOwner = async (req, res) => {
    try {
        const ownerId = req.params.ownerId;
        const mascotas = await Mascota.find({ propietario: ownerId }).populate('propietario', 'nombre email');
        
        console.log(`✅ ${mascotas.length} mascotas encontradas para propietario ${ownerId}`);
        res.json(mascotas);
    } catch (error) {
        console.error('❌ Error al obtener mascotas por propietario:', error);
        res.status(500).json({ message: 'Error al obtener mascotas por propietario' });
    }
};

/**
 * ➕ Crear nueva mascota
 * 
 * @description Registra una nueva mascota en el sistema (acepta JSON del firmware o formulario)
 * @route POST /api/mascotas
 * @access Public
 * 
 * @input {Object} req.body - Datos de la mascota
 * @input {string} req.body.nombre - Nombre de la mascota
 * @input {string} req.body.especie - Especie (Perro, Gato, etc.)
 * @input {string} req.body.raza - Raza de la mascota (opcional)
 * @input {number} req.body.edad - Edad de la mascota
 * @input {string} req.body.propietario - ID del propietario
 * 
 * @output {Object} 201 - Mascota creada exitosamente
 * @output {Object} 400 - Error de validación
 * @output {Object} 500 - Error interno del servidor
 */
mascotaController.addMascota = async (req, res) => {
    try {
        console.log('📝 Datos recibidos para nueva mascota:', JSON.stringify(req.body, null, 2));
        
        // Validar campos requeridos
        const { nombre, especie, propietario, deviceId } = req.body;
        if (!nombre || !especie || !propietario || !deviceId) {
            const missing = [];
            if (!nombre) missing.push('nombre');
            if (!especie) missing.push('especie');
            if (!propietario) missing.push('propietario');
            if (!deviceId) missing.push('deviceId');
            
            console.log('❌ Campos faltantes:', missing);
            return res.status(400).json({ 
                message: `Campos requeridos faltantes: ${missing.join(', ')}`,
                missing: missing
            });
        }
        
        const mascota = new Mascota(req.body);
        await mascota.save();
        console.log('✅ Mascota creada exitosamente:', mascota.nombre, 'ID:', mascota._id);
        // Emitir evento WebSocket
        broadcastMascotaUpdate({ action: 'create', mascota });
        res.json({ message: 'Mascota agregada exitosamente', mascota });
    } catch (err) {
        console.error('❌ Error al crear mascota:', err);
        
        // Manejo específico de errores de validación
        if (err.name === 'ValidationError') {
            const errors = Object.keys(err.errors).map(key => ({
                field: key,
                message: err.errors[key].message
            }));
            return res.status(400).json({ 
                message: 'Error de validación', 
                errors: errors,
                details: err.message 
            });
        }
        
        // Error de duplicado (deviceId único)
        if (err.code === 11000) {
            return res.status(400).json({ 
                message: 'El deviceId ya existe. Debe ser único.',
                error: 'DUPLICATE_DEVICE_ID'
            });
        }
        
        res.status(400).json({ message: 'Error al agregar mascota', error: err.message });
    }
};

// PUT actualizar mascota por deviceId (acepta JSON del firmware)
mascotaController.editMascota = async (req, res) => {
    const { deviceId } = req.params;
    console.log('🔄 Intentando actualizar mascota con deviceId:', deviceId);
    console.log('📝 Datos a actualizar:', JSON.stringify(req.body, null, 2));
    
    try {
        // Primero verificar si existe la mascota
        const existingMascota = await Mascota.findOne({ deviceId });
        console.log('🔍 Mascota encontrada:', existingMascota ? `Sí (${existingMascota.nombre})` : 'No encontrada');
        
        if (!existingMascota) {
            console.log('❌ No se pudo actualizar - mascota no encontrada con deviceId:', deviceId);
            return res.status(404).json({ message: 'Mascota no encontrada con el deviceId proporcionado' });
        }
        
        // Si se está actualizando el deviceId, verificar que no exista otro con el mismo ID
        if (req.body.deviceId && req.body.deviceId !== deviceId) {
            const duplicateMascota = await Mascota.findOne({ deviceId: req.body.deviceId });
            if (duplicateMascota) {
                console.log('❌ DeviceId duplicado:', req.body.deviceId);
                return res.status(400).json({ 
                    message: `El deviceId "${req.body.deviceId}" ya existe. Debe ser único.`,
                    error: 'DUPLICATE_DEVICE_ID'
                });
            }
        }
        
        const updated = await Mascota.findOneAndUpdate(
            { deviceId },
            { $set: req.body },
            { new: true, upsert: false }
        );
        console.log('✅ Mascota actualizada exitosamente:', updated.nombre);
        // Emitir evento WebSocket
        broadcastMascotaUpdate({ action: 'update', mascota: updated });
        res.json({ message: 'Mascota actualizada exitosamente', mascota: updated });
    } catch (err) {
        console.error('❌ Error al actualizar mascota:', err);
        
        // Error de duplicado (deviceId único)
        if (err.code === 11000) {
            return res.status(400).json({ 
                message: 'El nuevo deviceId ya existe. Debe ser único.',
                error: 'DUPLICATE_DEVICE_ID'
            });
        }
        
        res.status(400).json({ message: 'Error al actualizar mascota', error: err.message });
    }
};

// DELETE eliminar mascota por ID
mascotaController.deleteMascota = async (req, res) => {
    const deleted = await Mascota.findByIdAndDelete(req.params.id);
    // Emitir evento WebSocket
    if (deleted) {
        broadcastMascotaUpdate({ action: 'delete', mascota: deleted });
    }
    res.json('Mascota eliminada exitosamente');
};

module.exports = mascotaController;
