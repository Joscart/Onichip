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
        const mascota = new Mascota(req.body);
        await mascota.save();
        res.json({ message: 'Mascota agregada exitosamente', mascota });
    } catch (err) {
        res.status(400).json({ message: 'Error al agregar mascota', error: err.message });
    }
};

// PUT actualizar mascota por deviceId (acepta JSON del firmware)
mascotaController.editMascota = async (req, res) => {
    const { deviceId } = req.params;
    try {
        const updated = await Mascota.findOneAndUpdate(
            { deviceId },
            { $set: req.body },
            { new: true, upsert: false }
        );
        if (!updated) return res.status(404).json({ message: 'Mascota no encontrada' });
        res.json({ message: 'Mascota actualizada exitosamente', mascota: updated });
    } catch (err) {
        res.status(400).json({ message: 'Error al actualizar mascota', error: err.message });
    }
};

// DELETE eliminar mascota por ID
mascotaController.deleteMascota = async (req, res) => {
    await Mascota.findByIdAndDelete(req.params.id);
    res.json('Mascota eliminada exitosamente');
};

module.exports = mascotaController;
