/**
 * ================================================
 * 🐕 MASCOTAS ROUTES - GESTIÓN DE MASCOTAS
 * ================================================
 * 
 * Rutas para operaciones CRUD de mascotas del sistema
 * Incluye gestión de mascotas, búsqueda por propietario y datos IoT
 * 
 * @author Onichip Team
 * @version 2.0
 */

const express = require('express');
const router = express.Router();
const mascotaController = require('../controllers/mascotas.controllers');

// ================================================
// 🐕 OPERACIONES CRUD DE MASCOTAS
// ================================================

// GET /api/mascotas - Obtener todas las mascotas
router.get('/mascotas', mascotaController.getMascotas);

// GET /api/mascotas/:id - Obtener mascota específica por ID
router.get('/mascotas/:id', mascotaController.getMascota);

// GET /api/mascotas/owner/:ownerId - Obtener mascotas por propietario
router.get('/mascotas/owner/:ownerId', mascotaController.getMascotasByOwner);

// POST /api/mascotas - Crear nueva mascota
router.post('/mascotas', mascotaController.addMascota);

// PUT /api/mascotas/:id - Actualizar mascota por ID
router.put('/mascotas/:id', mascotaController.editMascota);

// PUT /api/mascotas/dev/:deviceId - Actualizar mascota por ID de dispositivo
router.put('/mascotas/dev/:deviceId', mascotaController.editMascota);

// DELETE /api/mascotas/:id - Eliminar mascota
router.delete('/mascotas/:id', mascotaController.deleteMascota);

// ================================================
// 🔄 COMPATIBILIDAD CON DISPOSITIVOS IOT
// ================================================

// GET /api/device - Alias para obtener todas las mascotas (compatibilidad IoT)
router.get('/device', mascotaController.getMascotas);

// GET /api/device/:id - Alias para obtener mascota por ID (compatibilidad IoT)
router.get('/device/:id', mascotaController.getMascota);

// GET /api/device/owner/:ownerId - Alias para mascotas por propietario (compatibilidad IoT)
router.get('/device/owner/:ownerId', mascotaController.getMascotasByOwner);

// POST /api/device - Alias para crear mascota (compatibilidad IoT)
router.post('/device', mascotaController.addMascota);

// PUT /api/device/dev/:deviceId - Alias para actualizar por deviceId (compatibilidad IoT)
router.put('/device/dev/:deviceId', mascotaController.editMascota);

// DELETE /api/device/:id - Alias para eliminar mascota (compatibilidad IoT)
router.delete('/device/:id', mascotaController.deleteMascota);

// ================================================
// 🏠 RUTA DE BIENVENIDA
// ================================================

// GET /api/ - Ruta de prueba y bienvenida
router.get('/', (req, res) => {
    res.json({
        message: 'Bienvenido al sistema de mascotas IoT Onichip',
        version: '2.0',
        endpoints: {
            mascotas: '/api/mascotas',
            dispositivos: '/api/device',
            descripcion: 'Sistema de gestión de mascotas con dispositivos IoT'
        }
    });
});

module.exports = router;
