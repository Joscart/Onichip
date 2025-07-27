/**
 * ================================================
 * 🛡️ ADMIN CONTROLLER - PANEL DE ADMINISTRACIÓN
 * ================================================
 * 
 * Controlador para todas las funciones del panel de administración
 * Incluye autenticación, CRUD de usuarios/mascotas, reportes y estadísticas
 * 
 * @author Onichip Team
 * @version 2.0
 */

const Admin = require('../models/admin');
const Usuario = require('../models/usuario');
const Mascota = require('../models/mascota');
const { Ubicacion, Geofence, WifiLocationCache } = require('../models/ubicacion');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const reportesController = require('./reportes.controllers');

const adminController = {};

/**
 * 🔐 Autenticación de administrador
 * 
 * @description Autentica un administrador con dominio @onichip.com
 * @route POST /api/admin/login
 * @access Public
 * 
 * @input {Object} req.body - Credenciales de login
 * @input {string} req.body.email - Email del administrador (debe terminar en @onichip.com)
 * @input {string} req.body.password - Contraseña del administrador
 * 
 * @output {Object} 200 - Login exitoso con datos del admin
 * @output {Object} 403 - Acceso denegado (dominio incorrecto)
 * @output {Object} 404 - Administrador no encontrado
 * @output {Object} 401 - Contraseña incorrecta
 * @output {Object} 500 - Error interno del servidor
 */
adminController.loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('🔐 Admin login attempt:', email);

        // Verificar dominio @onichip.com
        if (!email.endsWith('@onichip.com')) {
            return res.status(403).json({ message: 'Acceso denegado. Solo administradores de Onichip.' });
        }

        const admin = await Admin.findOne({ email, activo: true });
        if (!admin) {
            return res.status(401).json({ message: 'Administrador no encontrado o inactivo.' });
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Contraseña incorrecta.' });
        }

        // Actualizar último acceso
        admin.ultimoAcceso = new Date();
        await admin.save();

        console.log('✅ Admin login exitoso:', email);
        res.json({ 
            admin: {
                id: admin._id,
                email: admin.email,
                nombre: admin.nombre,
                rol: admin.rol,
                permisos: admin.permisos
            }
        });
    } catch (error) {
        console.error('Error en login admin:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

/**
 * 📊 Obtener estadísticas del dashboard
 * 
 * @description Obtiene estadísticas generales para el dashboard de administración
 * @route GET /api/admin/dashboard
 * @access Admin only
 * 
 * @input None - No requiere parámetros
 * 
 * @output {Object} 200 - Estadísticas del dashboard
 * @output {number} response.totalUsuarios - Total de usuarios registrados
 * @output {number} response.totalMascotas - Total de mascotas registradas
 * @output {number} response.nuevosUsuarios30d - Usuarios registrados en últimos 30 días
 * @output {number} response.nuevasMascotas30d - Mascotas registradas en últimos 30 días
 * @output {Array} response.mascotasPorEspecie - Distribución de mascotas por especie
 * @output {Object} 500 - Error interno del servidor
 */
adminController.getDashboardStats = async (req, res) => {
    try {
        const stats = await Promise.all([
            Usuario.countDocuments(),
            Mascota.countDocuments(),
            Usuario.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30*24*60*60*1000) } }),
            Mascota.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30*24*60*60*1000) } }),
            Mascota.aggregate([
                { $group: { _id: '$especie', count: { $sum: 1 } } }
            ])
        ]);

        res.json({
            totalUsuarios: stats[0],
            totalMascotas: stats[1],
            nuevosUsuarios30d: stats[2],
            nuevasMascotas30d: stats[3],
            mascotasPorEspecie: stats[4],
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        res.status(500).json({ message: 'Error al obtener estadísticas' });
    }
};

// 👥 Gestión de usuarios - Obtener todos
adminController.getAllUsuarios = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        console.log(`🔍 Búsqueda recibida: "${search}"`);
        
        let usuarios = [];
        let total = 0;
        
        if (search && search.trim()) {
            const searchTerm = search.trim();
            console.log(`📝 Término limpio: "${searchTerm}"`);
            console.log(`🔢 Es hexadecimal: ${/^[0-9a-fA-F]+$/i.test(searchTerm)}`);
            
            // Si el término de búsqueda parece ser un ID (hexadecimal)
            if (/^[0-9a-fA-F]+$/i.test(searchTerm)) {
                console.log(`🔍 Búsqueda por ID detectada: "${searchTerm}"`);
                
                // Primero obtener todos los usuarios para filtrar por ID
                const allUsers = await Usuario.find({});
                console.log(`📄 Total usuarios en BD: ${allUsers.length}`);
                
                // Filtrar por ID (tanto completo como parcial)
                const filteredUsers = allUsers.filter(user => {
                    const userId = user._id.toString().toLowerCase();
                    const searchLower = searchTerm.toLowerCase();
                    
                    const match = userId.includes(searchLower);
                    console.log(`   ${user.nombre}: ${userId} incluye ${searchLower} ? ${match}`);
                    
                    // Búsqueda exacta por ID completo o parcial
                    return match;
                });
                
                console.log(`✅ Usuarios filtrados: ${filteredUsers.length}`);
                
                total = filteredUsers.length;
                usuarios = filteredUsers
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice((page - 1) * limit, page * limit);
                
            } else {
                console.log(`📝 Búsqueda por texto: "${searchTerm}"`);
                // Búsqueda normal por nombre y email
                const query = {
                    $or: [
                        { nombre: { $regex: searchTerm, $options: 'i' } },
                        { email: { $regex: searchTerm, $options: 'i' } }
                    ]
                };
                
                usuarios = await Usuario.find(query)
                    .limit(limit * 1)
                    .skip((page - 1) * limit)
                    .sort({ createdAt: -1 });
                    
                total = await Usuario.countDocuments(query);
            }
        } else {
            console.log(`📝 Sin búsqueda, obteniendo todos`);
            // Sin búsqueda, obtener todos
            usuarios = await Usuario.find({})
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .sort({ createdAt: -1 });
                
            total = await Usuario.countDocuments({});
        }

        // Agregar el conteo de mascotas para cada usuario
        const usuariosConMascotas = await Promise.all(
            usuarios.map(async (usuario) => {
                const cantidadMascotas = await Mascota.countDocuments({ 
                    propietario: usuario._id 
                });
                return {
                    ...usuario.toObject(),
                    cantidadMascotas
                };
            })
        );

        console.log(`📊 Enviando ${usuariosConMascotas.length} usuarios`);
        res.json({
            usuarios: usuariosConMascotas,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalUsuarios: total
        });
    } catch (error) {
        console.error('Error getting usuarios:', error);
        res.status(500).json({ message: 'Error al obtener usuarios' });
    }
};

// 👥 Crear usuario desde admin
adminController.createUsuario = async (req, res) => {
    try {
        const { nombre, email, password, telefono } = req.body;

        // Verificar si el usuario ya existe
        const existingUser = await Usuario.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Ya existe un usuario con este email' });
        }

        // Encriptar contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const nuevoUsuario = new Usuario({
            nombre,
            email,
            password: hashedPassword,
            telefono
        });

        await nuevoUsuario.save();
        console.log('✅ Usuario creado por admin:', email);

        res.status(201).json({ 
            message: 'Usuario creado exitosamente',
            usuario: {
                id: nuevoUsuario._id,
                nombre: nuevoUsuario.nombre,
                email: nuevoUsuario.email
            }
        });
    } catch (error) {
        console.error('Error creating usuario:', error);
        res.status(500).json({ message: 'Error al crear usuario' });
    }
};

// 👥 Actualizar usuario
adminController.updateUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };

        // Si se incluye password, encriptarla
        if (updateData.password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(updateData.password, salt);
        }

        const usuario = await Usuario.findByIdAndUpdate(id, updateData, { new: true });
        if (!usuario) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        console.log('✅ Usuario actualizado por admin:', usuario.email);
        res.json({ message: 'Usuario actualizado exitosamente', usuario });
    } catch (error) {
        console.error('Error updating usuario:', error);
        res.status(500).json({ message: 'Error al actualizar usuario' });
    }
};

// 👥 Eliminar usuario
adminController.deleteUsuario = async (req, res) => {
    try {
        const { id } = req.params;

        // Primero eliminar todas las mascotas del usuario
        await Mascota.deleteMany({ propietario: id });
        
        // Luego eliminar el usuario
        const usuario = await Usuario.findByIdAndDelete(id);
        if (!usuario) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        console.log('🗑️ Usuario eliminado por admin:', usuario.email);
        res.json({ message: 'Usuario y sus mascotas eliminados exitosamente' });
    } catch (error) {
        console.error('Error deleting usuario:', error);
        res.status(500).json({ message: 'Error al eliminar usuario' });
    }
};

// 🐕 Gestión de mascotas - Obtener todas
adminController.getAllMascotas = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        console.log(`🔍 Búsqueda de mascotas recibida: "${search}"`);
        
        let mascotas = [];
        let total = 0;
        
        if (search && search.trim()) {
            const searchTerm = search.trim();
            console.log(`📝 Buscando mascotas por: "${searchTerm}"`);
            
            // Buscar por nombre de mascota, especie, raza O nombre de usuario del propietario
            const usuarios = await Usuario.find({
                nombre: { $regex: searchTerm, $options: 'i' }
            }).select('_id');
            
            const usuarioIds = usuarios.map(u => u._id);
            console.log(`👥 Usuarios encontrados con nombre "${searchTerm}": ${usuarioIds.length}`);
            
            const query = {
                $or: [
                    { nombre: { $regex: searchTerm, $options: 'i' } },
                    { especie: { $regex: searchTerm, $options: 'i' } },
                    { raza: { $regex: searchTerm, $options: 'i' } },
                    { propietario: { $in: usuarioIds } } // Búsqueda por propietario
                ]
            };
            
            mascotas = await Mascota.find(query)
                .populate('propietario', 'nombre email')
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .sort({ createdAt: -1 });
                
            total = await Mascota.countDocuments(query);
            console.log(`🐕 Mascotas encontradas: ${total}`);
            
        } else {
            // Sin búsqueda, obtener todas
            mascotas = await Mascota.find({})
                .populate('propietario', 'nombre email')
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .sort({ createdAt: -1 });
                
            total = await Mascota.countDocuments({});
            console.log(`📋 Todas las mascotas: ${total}`);
        }

        res.json({
            mascotas,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalMascotas: total
        });
    } catch (error) {
        console.error('Error getting mascotas:', error);
        res.status(500).json({ message: 'Error al obtener mascotas' });
    }
};

/**
 * 🐕 Crear nueva mascota
 * 
 * @description Crea una nueva mascota en el sistema
 * @route POST /api/admin/mascotas
 * @access Admin only
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
adminController.createMascota = async (req, res) => {
    try {
        const { nombre, especie, raza, edad, propietario } = req.body;
        
        // Validar campos requeridos
        if (!nombre || !especie || !propietario) {
            return res.status(400).json({ 
                message: 'Los campos nombre, especie y propietario son requeridos' 
            });
        }

        // Verificar que el propietario existe
        const usuarioExiste = await Usuario.findById(propietario);
        if (!usuarioExiste) {
            return res.status(400).json({ 
                message: 'El propietario especificado no existe' 
            });
        }

        // Crear la mascota
        const nuevaMascota = new Mascota({
            nombre,
            especie,
            raza: raza || '',
            edad: edad || 0,
            propietario,
            createdAt: new Date()
        });

        const mascotaGuardada = await nuevaMascota.save();
        
        // Poblar los datos del propietario para la respuesta
        await mascotaGuardada.populate('propietario', 'nombre email');

        console.log('✅ Mascota creada:', mascotaGuardada.nombre);
        res.status(201).json({
            message: 'Mascota creada exitosamente',
            mascota: mascotaGuardada
        });
    } catch (error) {
        console.error('❌ Error al crear mascota:', error);
        res.status(500).json({ message: 'Error al crear mascota' });
    }
};

/**
 * 🐕 Actualizar mascota existente
 * 
 * @description Actualiza los datos de una mascota existente
 * @route PUT /api/admin/mascotas/:id
 * @access Admin only
 * 
 * @input {string} req.params.id - ID de la mascota a actualizar
 * @input {Object} req.body - Datos actualizados de la mascota
 * 
 * @output {Object} 200 - Mascota actualizada exitosamente
 * @output {Object} 404 - Mascota no encontrada
 * @output {Object} 500 - Error interno del servidor
 */
adminController.updateMascota = async (req, res) => {
    try {
        const { id } = req.params;
        const mascota = await Mascota.findByIdAndUpdate(id, req.body, { new: true });
        
        if (!mascota) {
            return res.status(404).json({ message: 'Mascota no encontrada' });
        }

        console.log('✅ Mascota actualizada por admin:', mascota.nombre);
        res.json({ message: 'Mascota actualizada exitosamente', mascota });
    } catch (error) {
        console.error('Error updating mascota:', error);
        res.status(500).json({ message: 'Error al actualizar mascota' });
    }
};

// 🐕 Eliminar mascota
adminController.deleteMascota = async (req, res) => {
    try {
        const { id } = req.params;
        const mascota = await Mascota.findByIdAndDelete(id);
        
        if (!mascota) {
            return res.status(404).json({ message: 'Mascota no encontrada' });
        }

        console.log('🗑️ Mascota eliminada por admin:', mascota.nombre);
        res.json({ message: 'Mascota eliminada exitosamente' });
    } catch (error) {
        console.error('Error deleting mascota:', error);
        res.status(500).json({ message: 'Error al eliminar mascota' });
    }
};

// 🚨 Obtener alertas del sistema
adminController.getAlertas = async (req, res) => {
    try {
        const alertas = [];

        // Usuarios sin mascotas
        const usuariosSinMascotas = await Usuario.countDocuments({
            mascotas: { $size: 0 }
        });

        if (usuariosSinMascotas > 0) {
            alertas.push({
                tipo: 'warning',
                titulo: 'Usuarios sin mascotas',
                mensaje: `${usuariosSinMascotas} usuarios no tienen mascotas registradas`,
                icono: '👥'
            });
        }

        // Mascotas sin signos vitales recientes
        const mascotasSinSignos = await Mascota.countDocuments({
            $or: [
                { signosVitales: { $size: 0 } },
                { updatedAt: { $lt: new Date(Date.now() - 7*24*60*60*1000) } }
            ]
        });

        if (mascotasSinSignos > 0) {
            alertas.push({
                tipo: 'error',
                titulo: 'Mascotas sin monitoreo',
                mensaje: `${mascotasSinSignos} mascotas sin signos vitales en 7 días`,
                icono: '🐕'
            });
        }

        // Usuarios registrados recientemente
        const nuevosUsuarios = await Usuario.countDocuments({
            createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) }
        });

        if (nuevosUsuarios > 0) {
            alertas.push({
                tipo: 'success',
                titulo: 'Nuevos registros',
                mensaje: `${nuevosUsuarios} usuarios se registraron en las últimas 24h`,
                icono: '🎉'
            });
        }

        res.json(alertas);
    } catch (error) {
        console.error('Error getting alertas:', error);
        res.status(500).json({ message: 'Error al obtener alertas' });
    }
};

// 📈 Reportes avanzados
/**
 * 📊 Obtener lista de reportes disponibles
 * Delegado al controlador de reportes
 */
adminController.getReportes = reportesController.getReportes;

// 📱 Funciones para datos IoT - ULTRA-OPTIMIZADO
adminController.getDatosIoT = async (req, res) => {
    try {
        const { page = 1, limit = 10, mascotaId, fechaInicio, fechaFin } = req.query; // Reducido a 10
        
        let query = {};
        
        if (mascotaId) {
            query.mascota = mascotaId;
        }
        
        if (fechaInicio || fechaFin) {
            query.timestamp = {};
            if (fechaInicio) query.timestamp.$gte = new Date(fechaInicio);
            if (fechaFin) query.timestamp.$lte = new Date(fechaFin);
        }
        
        console.log('⚡ Consultando datos IoT ultra-optimizado...');
        
        // Usar Promise.all para consultas paralelas
        const [datos, total] = await Promise.all([
            DatosIoT.find(query)
                .sort({ timestamp: -1 })
                .limit(Math.min(limit * 1, 20)) // Limitar máximo a 20 registros (reducido de 50)
                .skip((page - 1) * limit)
                .lean(), // usar lean() para mejor rendimiento
            DatosIoT.countDocuments(query)
        ]);
            
        // Obtener información de mascotas por separado de forma optimizada
        const mascotaIds = [...new Set(datos.map(d => d.mascota).filter(id => id))];
        const mascotas = await Mascota.find({ _id: { $in: mascotaIds } })
            .select('nombre especie raza')
            .lean();
        
        const mascotasMap = {};
        mascotas.forEach(m => {
            mascotasMap[m._id.toString()] = { 
                nombre: m.nombre, 
                especie: m.especie, 
                raza: m.raza 
            };
        });
        
        // Agregar información de mascota a cada dato de forma eficiente
        const datosConMascota = datos.map(dato => ({
            ...dato,
            mascota: mascotasMap[dato.mascota?.toString()] || null
        }));
        
        res.json({
            datos: datosConMascota,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total,
            optimizado: true,
            ultraOptimizado: true
        });
        
    } catch (error) {
        console.error('Error getting datos IoT:', error);
        res.status(500).json({ message: 'Error al obtener datos IoT' });
    }
};

// 📊 Dashboard con gráficos avanzados - OPTIMIZADO
adminController.getDashboardCharts = async (req, res) => {
    try {
        console.log('⚡ Generando gráficos de dashboard optimizado...');
        
        // Usar Promise.all para ejecutar consultas en paralelo
        const [especiesData, actividadData, temperaturaData, alertasActivas, dispositivosActivos] = await Promise.all([
            // 1. Gráfico de pastel: Distribución de especies (optimizado)
            Mascota.aggregate([
                { $group: { _id: '$especie', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 } // Limitar resultados
            ]),
            
            // 2. Gráfico de barras: Actividad de mascotas (últimos 3 días en lugar de 7)
            (() => {
                const fechaInicio = new Date();
                fechaInicio.setDate(fechaInicio.getDate() - 3); // Reducido de 7 a 3 días
                
                return DatosIoT.aggregate([
                    { $match: { timestamp: { $gte: fechaInicio } } },
                    {
                        $group: {
                            _id: {
                                fecha: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                                actividad: "$signosVitales.actividad"
                            },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { "_id.fecha": 1 } },
                    { $limit: 50 } // Limitar resultados
                ]);
            })(),
            
            // 3. Gráfico de líneas: Temperatura promedio (últimas 12h en lugar de 24h)
            (() => {
                const hace12h = new Date();
                hace12h.setHours(hace12h.getHours() - 12); // Reducido de 24h a 12h
                
                return DatosIoT.aggregate([
                    { 
                        $match: { 
                            timestamp: { $gte: hace12h },
                            'signosVitales.temperatura': { $exists: true, $ne: null }
                        }
                    },
                    {
                        $group: {
                            _id: {
                                hora: { $hour: "$timestamp" }
                            },
                            temperaturaPromedio: { $avg: "$signosVitales.temperatura" },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { "_id.hora": 1 } },
                    { $limit: 24 } // Máximo 24 horas
                ]);
            })(),
            
            // 4. Alertas activas (optimizado)
            DatosIoT.aggregate([
                { $unwind: "$alertas" },
                { $match: { "alertas.resuelto": false } },
                { $group: { _id: "$alertas.tipo", count: { $sum: 1 } } },
                { $limit: 10 }
            ]),
            
            // 5. Dispositivos activos (últimas 12h)
            (() => {
                const hace12h = new Date();
                hace12h.setHours(hace12h.getHours() - 12);
                
                return DatosIoT.aggregate([
                    { $match: { timestamp: { $gte: hace12h } } },
                    { $group: { _id: "$dispositivo.id" } },
                    { $count: "total" }
                ]);
            })()
        ]);

        console.log('📊 Procesando datos para gráficos...');

        res.json({
            graficos: {
                especies: {
                    tipo: 'doughnut',
                    titulo: 'Distribución por Especies',
                    datos: especiesData.map(item => ({
                        label: item._id || 'Sin especificar',
                        value: item.count
                    }))
                },
                actividad: {
                    tipo: 'bar',
                    titulo: 'Actividad por Día (Últimos 3 días)',
                    datos: actividadData
                },
                temperatura: {
                    tipo: 'line',
                    titulo: 'Temperatura Promedio (Últimas 12h)',
                    datos: temperaturaData.map(item => ({
                        hora: item._id.hora,
                        temperatura: item.temperaturaPromedio ? parseFloat(item.temperaturaPromedio.toFixed(1)) : 0,
                        cantidad: item.count
                    }))
                }
            },
            estadisticas: {
                alertasActivas: alertasActivas.reduce((sum, item) => sum + item.count, 0),
                dispositivosActivos: dispositivosActivos[0]?.total || 0,
                ultimaActualizacion: new Date(),
                optimizado: true
            }
        });
        
        console.log('✅ Gráficos generados exitosamente en tiempo optimizado');
        
    } catch (error) {
        console.error('Error getting dashboard charts:', error);
        res.status(500).json({ message: 'Error al generar gráficos del dashboard' });
    }
};

// 📄 Generar reporte Excel con datos reales de la base de datos
/**
 * 📊 Generar reporte Excel con datos reales
 * Delegado al controlador de reportes
 */
adminController.generateExcelReport = reportesController.generateExcelReport;

// 🎲 Generar datos IoT de ejemplo (para testing) - OPTIMIZADO
adminController.generateSampleIoTData = async (req, res) => {
    try {
        console.log('⚡ Iniciando generación rápida de datos IoT...');
        const mascotas = await Mascota.find().limit(5); // Limitar a 5 mascotas para ser más rápido
        
        if (mascotas.length === 0) {
            return res.status(400).json({ message: 'No hay mascotas registradas para generar datos' });
        }
        
        const sampleData = [];
        const actividades = ['descanso', 'caminando', 'corriendo', 'jugando'];
        
        // Generar datos solo para los últimos 3 días (en lugar de 7)
        for (let i = 0; i < 3; i++) {
            const fecha = new Date();
            fecha.setDate(fecha.getDate() - i);
            
            for (const mascota of mascotas) {
                // Generar solo 1-2 registros por mascota por día (en lugar de 2-4)
                const registrosPorDia = Math.floor(Math.random() * 2) + 1;
                
                for (let j = 0; j < registrosPorDia; j++) {
                    const horaAleatoria = Math.floor(Math.random() * 24);
                    const timestamp = new Date(fecha);
                    timestamp.setHours(horaAleatoria, Math.floor(Math.random() * 60));
                    
                    sampleData.push({
                        mascota: mascota._id,
                        dispositivo: {
                            id: `ONI-${mascota._id.toString().slice(-6).toUpperCase()}`,
                            tipo: 'chip',
                            version: '1.2'
                        },
                        ubicacion: {
                            latitud: -12.0464 + (Math.random() - 0.5) * 0.1,
                            longitud: -77.0428 + (Math.random() - 0.5) * 0.1,
                            precision: Math.floor(Math.random() * 5) + 3
                        },
                        signosVitales: {
                            temperatura: 37 + (Math.random() - 0.5) * 1.5,
                            frecuenciaCardiaca: 90 + Math.floor(Math.random() * 30),
                            frecuenciaRespiratoria: 18 + Math.floor(Math.random() * 8),
                            actividad: actividades[Math.floor(Math.random() * actividades.length)]
                        },
                        ambiente: {
                            temperaturaAmbiente: 22 + Math.floor(Math.random() * 10),
                            humedad: 55 + Math.floor(Math.random() * 25),
                            calidad_aire: ['excelente', 'buena'][Math.floor(Math.random() * 2)]
                        },
                        bateria: {
                            nivel: 75 + Math.floor(Math.random() * 25),
                            estimadoHoras: 22 + Math.floor(Math.random() * 8)
                        },
                        timestamp
                    });
                }
            }
        }
        
        // Insertar datos en lotes más pequeños para mejor rendimiento
        console.log(`⏳ Insertando ${sampleData.length} registros...`);
        const batchSize = 10;
        for (let i = 0; i < sampleData.length; i += batchSize) {
            const batch = sampleData.slice(i, i + batchSize);
            await DatosIoT.insertMany(batch);
        }
        
        console.log('✅ Datos generados exitosamente');
        res.json({ 
            message: `Se generaron ${sampleData.length} registros IoT de ejemplo`,
            registros: sampleData.length,
            mascotas: mascotas.length,
            dias: 3,
            tiempo: 'optimizado'
        });
        
    } catch (error) {
        console.error('Error generating sample IoT data:', error);
        res.status(500).json({ message: 'Error al generar datos de ejemplo' });
    }
};

// 📊 Estadísticas generales - OPTIMIZADO
adminController.getEstadisticasGenerales = async (req, res) => {
    try {
        console.log('⚡ Generando estadísticas optimizadas...');
        
        // Usar Promise.all para obtener estadísticas en paralelo
        const [totalUsuarios, totalMascotas, totalDatosIoT, usuariosActivos, mascotasConDatos] = await Promise.all([
            Usuario.countDocuments(),
            Mascota.countDocuments(),
            DatosIoT.countDocuments(),
            Usuario.countDocuments({ 
                ultimoAcceso: { 
                    $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Última semana
                } 
            }),
            DatosIoT.distinct('mascota').then(ids => ids.length)
        ]);
        
        // Estadísticas rápidas de IoT de las últimas 24 horas
        const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const datosRecientes = await DatosIoT.countDocuments({
            timestamp: { $gte: ayer }
        });
        
        // Dispositivos activos (con datos en las últimas 4 horas)
        const hace4Horas = new Date(Date.now() - 4 * 60 * 60 * 1000);
        const dispositivosActivos = await DatosIoT.distinct('dispositivo.id', {
            timestamp: { $gte: hace4Horas }
        });
        
        res.json({
            totalUsuarios,
            totalMascotas,
            totalDatosIoT,
            usuariosActivos,
            mascotasConDatos,
            datosRecientes24h: datosRecientes,
            dispositivosActivos: dispositivosActivos.length,
            optimizado: true,
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ message: 'Error al obtener estadísticas' });
    }
};

// Método para obtener estadísticas GPS para admin
const estadisticasGPS = async (req, res) => {
    try {
        const ahora = new Date();
        const hace24Horas = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
        const hace7Dias = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Obtener estadísticas básicas
        const totalUsuarios = await Usuario.countDocuments();
        const totalMascotas = await Mascota.countDocuments();
        const totalUbicaciones = await Ubicacion.countDocuments();
        
        // Dispositivos activos (con ubicaciones en las últimas 24 horas)
        const dispositivosActivos = await Ubicacion.distinct('deviceId', {
            timestamp: { $gte: hace24Horas }
        });

        // Ubicaciones recientes por hora
        const ubicacionesPorHora = await Ubicacion.aggregate([
            {
                $match: { timestamp: { $gte: hace24Horas } }
            },
            {
                $group: {
                    _id: { $hour: "$timestamp" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        // Mascotas con ubicaciones recientes
        const mascotasConUbicacion = await Ubicacion.distinct('deviceId', {
            timestamp: { $gte: hace24Horas }
        });

        // Alertas simuladas (geofence violations)
        const alertasSimuladas = Math.floor(Math.random() * 15) + 5;

        // Estadísticas de precisión GPS
        const ubicacionesRecientes = await Ubicacion.find({
            timestamp: { $gte: hace24Horas }
        }).select('accuracy timestamp').lean();

        const promedioAccuracy = ubicacionesRecientes.length > 0 
            ? ubicacionesRecientes.reduce((sum, u) => sum + (u.accuracy || 10), 0) / ubicacionesRecientes.length
            : 10;

        // Estados de dispositivos simulados
        const estadosDispositivos = {
            online: Math.floor(dispositivosActivos.length * 0.8),
            offline: Math.floor(dispositivosActivos.length * 0.15),
            bateria_baja: Math.floor(dispositivosActivos.length * 0.05)
        };

        // Zonas seguras activas
        const zonasSeguras = await Geofence.countDocuments({ activo: true });

        res.json({
            resumen: {
                totalDispositivos: totalMascotas,
                dispositivosActivos: dispositivosActivos.length,
                ubicacionesTotales: totalUbicaciones,
                ubicaciones24h: ubicacionesRecientes.length,
                alertasActivas: alertasSimuladas,
                zonasSeguras: zonasSeguras,
                precisionPromedio: Math.round(promedioAccuracy * 100) / 100
            },
            dispositivos: {
                estados: estadosDispositivos,
                actividad: ubicacionesPorHora.map(item => ({
                    hora: item._id,
                    ubicaciones: item.count
                }))
            },
            alertas: {
                total: alertasSimuladas,
                tipos: {
                    geofence: Math.floor(alertasSimuladas * 0.6),
                    bateria: Math.floor(alertasSimuladas * 0.2),
                    inactividad: Math.floor(alertasSimuladas * 0.2)
                }
            },
            rendimiento: {
                precisionGPS: {
                    excelente: Math.floor(ubicacionesRecientes.length * 0.7),
                    buena: Math.floor(ubicacionesRecientes.length * 0.2),
                    regular: Math.floor(ubicacionesRecientes.length * 0.1)
                },
                cobertura: Math.min(95 + Math.random() * 5, 100)
            },
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Error obteniendo estadísticas GPS:', error);
        res.status(500).json({ message: 'Error al obtener estadísticas GPS' });
    }
};

// Exportar todos los métodos incluyendo el nuevo endpoint GPS
adminController.estadisticasGPS = estadisticasGPS;

// ================================================
// 📊 NUEVOS ENDPOINTS - REPORTES Y DASHBOARD AVANZADO
// ================================================

// 📈 Estadísticas del dashboard avanzado
adminController.dashboardStats = async (req, res) => {
    try {
        console.log('📊 Obteniendo estadísticas del dashboard avanzado...');

        const [mascotas, ubicaciones] = await Promise.all([
            Mascota.find({}),
            Ubicacion.find({}).sort({ timestamp: -1 }).limit(1000)
        ]);

        // Distribución de mascotas por tipo (para gráfico de pastel)
        const distribucionMascotas = mascotas.reduce((acc, mascota) => {
            const tipo = mascota.tipo || 'Otro';
            if (tipo.toLowerCase().includes('perro')) acc.perros++;
            else if (tipo.toLowerCase().includes('gato')) acc.gatos++;
            else acc.otros++;
            return acc;
        }, { perros: 0, gatos: 0, otros: 0 });

        // Actividad por mes (para gráfico de barras)
        const ahora = new Date();
        const mesesActividad = Array.from({ length: 6 }, (_, i) => {
            const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
            const siguienteMes = new Date(ahora.getFullYear(), ahora.getMonth() - i + 1, 1);
            
            return ubicaciones.filter(u => {
                const fechaUbicacion = new Date(u.timestamp);
                return fechaUbicacion >= fecha && fechaUbicacion < siguienteMes;
            }).length;
        }).reverse();

        // Dispositivos activos por hora (para gráfico de líneas)
        const horasActividad = Array.from({ length: 6 }, (_, i) => {
            const horaInicio = i * 4; // 0, 4, 8, 12, 16, 20
            return ubicaciones.filter(u => {
                const hora = new Date(u.timestamp).getHours();
                return hora >= horaInicio && hora < horaInicio + 4;
            }).length;
        });

        res.json({
            ...distribucionMascotas,
            actividadMensual: mesesActividad,
            dispositivosActivos: horasActividad,
            timestamp: new Date()
        });

    } catch (error) {
        console.error('❌ Error obteniendo estadísticas del dashboard:', error);
        res.status(500).json({ message: 'Error al obtener estadísticas del dashboard' });
    }
};

/**
 * 📋 Generar reporte personalizado
 * Delegado al controlador de reportes
 */
adminController.generateReport = reportesController.generateReport;

        // Respuesta inmediata con datos optimizados
// 📄 Exportar reporte a PDF con datos reales de la base de datos
/**
 * 📄 Exportar reporte a PDF
 * Delegado al controlador de reportes
 */
adminController.exportPDF = reportesController.exportPDF;
// ================================================
// 🔧 FUNCIONES AUXILIARES PARA REPORTES
// ================================================

async function generarReporteDispositivos(mascotaId) {
    const filtro = mascotaId ? { _id: mascotaId } : {};
    const mascotas = await Mascota.find(filtro).populate('propietario', 'nombre email');
    
    const dispositivos = mascotas.map(mascota => ({
        id: mascota._id,
        serial: mascota.chip || 'N/A',
        modelo: 'OnichipGPS v1.0',
        estado: mascota.ubicacionActual ? 'Activo' : 'Inactivo',
        bateria: mascota.ubicacionActual?.battery || 'N/A',
        ultimaConexion: mascota.ubicacionActual?.timestamp || 'Nunca',
        ubicacion: mascota.ubicacionActual ? 
            `${mascota.ubicacionActual.latitude}, ${mascota.ubicacionActual.longitude}` : 'N/A',
        mascota: mascota.nombre,
        usuario: mascota.propietario?.nombre || 'Sin usuario'
    }));

    return {
        dispositivos,
        total: dispositivos.length
    };
}

async function generarReporteUbicaciones(fechaStart, fechaEnd, mascotaId) {
    const filtro = {
        timestamp: { $gte: fechaStart, $lte: fechaEnd }
    };
    
    if (mascotaId) {
        const mascota = await Mascota.findById(mascotaId);
        if (mascota && mascota.chip) {
            filtro.deviceId = mascota.chip;
        }
    }

    const ubicaciones = await Ubicacion.find(filtro).sort({ timestamp: -1 });
    
    const ubicacionesFormateadas = await Promise.all(
        ubicaciones.map(async (ubicacion) => {
            const mascota = await Mascota.findOne({ chip: ubicacion.deviceId });
            return {
                timestamp: ubicacion.timestamp,
                mascota: mascota?.nombre || 'Desconocida',
                latitude: ubicacion.latitude,
                longitude: ubicacion.longitude,
                accuracy: ubicacion.accuracy,
                speed: ubicacion.speed || 0,
                method: ubicacion.method || 'GPS',
                battery: ubicacion.battery || 'N/A'
            };
        })
    );

    return {
        ubicaciones: ubicacionesFormateadas,
        total: ubicacionesFormateadas.length
    };
}

async function generarReporteAlertas(fechaStart, fechaEnd) {
    // Simulamos alertas por ahora, pero podrías tener un modelo de Alertas
    const alertas = [
        {
            timestamp: new Date(),
            tipo: 'Batería baja',
            prioridad: 'Alta',
            mensaje: 'Batería del dispositivo por debajo del 15%',
            dispositivo: 'CHIP001',
            estado: 'Activa'
        },
        {
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
            tipo: 'Geofence',
            prioridad: 'Media',
            mensaje: 'Mascota salió de zona segura',
            dispositivo: 'CHIP002',
            estado: 'Resuelta'
        }
    ];

    const alertasFiltradas = alertas.filter(alerta => {
        const fechaAlerta = new Date(alerta.timestamp);
        return fechaAlerta >= fechaStart && fechaAlerta <= fechaEnd;
    });

    return {
        alertas: alertasFiltradas,
        total: alertasFiltradas.length
    };
}

async function generarReporteEstadisticas(fechaStart, fechaEnd) {
    const [mascotas, ubicaciones, usuarios] = await Promise.all([
        Mascota.find({}),
        Ubicacion.find({
            timestamp: { $gte: fechaStart, $lte: fechaEnd }
        }),
        Usuario.find({})
    ]);

    const dispositivosActivos = mascotas.filter(m => m.ubicacionActual).length;

    return {
        estadisticas: {
            totalDispositivos: mascotas.length,
            dispositivosActivos,
            totalMascotas: mascotas.length,
            ubicacionesRegistradas: ubicaciones.length,
            alertasGeneradas: 5, // Simulado
            usuariosRegistrados: usuarios.length
        },
        total: 6 // Número de métricas
    };
}

// Función de reporte general para cualquier tipo
async function generarReporteGeneral(fechaStart, fechaEnd, mascotaId) {
    try {
        // Obtener datos básicos
        const filtroMascota = mascotaId ? { _id: mascotaId } : {};
        const mascotas = await Mascota.find(filtroMascota)
            .populate('propietario', 'nombre email')
            .limit(100); // Limitar para evitar sobrecarga

        // Generar datos de muestra si no hay datos reales
        const reporteData = mascotas.map((mascota, index) => ({
            id: mascota._id,
            nombre: mascota.nombre,
            especie: mascota.especie,
            chip: mascota.chip || `CHIP-${Date.now()}-${index}`,
            propietario: mascota.propietario?.nombre || 'Usuario Demo',
            email: mascota.propietario?.email || 'demo@onichip.com',
            estado: Math.random() > 0.3 ? 'Activo' : 'Inactivo',
            ubicacion: `${(-34.5 + Math.random() * 0.1).toFixed(6)}, ${(-58.4 + Math.random() * 0.1).toFixed(6)}`,
            bateria: `${Math.floor(Math.random() * 100)}%`,
            ultimaConexion: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString()
        }));

        // Si no hay mascotas, generar datos de ejemplo
        if (reporteData.length === 0) {
            const ejemplos = ['Toby', 'Luna', 'Max', 'Bella', 'Rocky'].map((nombre, index) => ({
                id: `demo-${index}`,
                nombre,
                especie: index % 2 === 0 ? 'Perro' : 'Gato',
                chip: `CHIP-DEMO-${index + 1000}`,
                propietario: `Usuario Demo ${index + 1}`,
                email: `demo${index + 1}@onichip.com`,
                estado: 'Demo',
                ubicacion: `${(-34.5 + Math.random() * 0.1).toFixed(6)}, ${(-58.4 + Math.random() * 0.1).toFixed(6)}`,
                bateria: `${Math.floor(Math.random() * 100)}%`,
                ultimaConexion: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString()
            }));
            
            return {
                data: ejemplos,
                total: ejemplos.length,
                tipo: 'demo'
            };
        }

        return {
            data: reporteData,
            total: reporteData.length,
            tipo: 'real'
        };
    } catch (error) {
        console.error('Error en reporte general:', error);
        // Retornar datos de ejemplo en caso de error
        return {
            data: [{
                id: 'error-demo',
                nombre: 'Datos de Ejemplo',
                especie: 'Demo',
                chip: 'CHIP-ERROR-001',
                propietario: 'Sistema Demo',
                email: 'demo@onichip.com',
                estado: 'Demo',
                ubicacion: '-34.603722, -58.381592',
                bateria: '85%',
                ultimaConexion: new Date().toISOString()
            }],
            total: 1,
            tipo: 'error-demo'
        };
    }
}

module.exports = adminController;