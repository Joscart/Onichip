const Admin = require('../models/admin');
const Usuario = require('../models/usuario');
const Mascota = require('../models/mascota');
const bcrypt = require('bcryptjs');

const adminController = {};

// 🔐 Login de administrador
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

// 📊 Dashboard - Estadísticas generales
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

// 🐕 Actualizar mascota
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
adminController.getReportes = async (req, res) => {
    try {
        const reportes = await Promise.all([
            // Usuarios por mes
            Usuario.aggregate([
                {
                    $group: {
                        _id: { 
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': -1, '_id.month': -1 } },
                { $limit: 12 }
            ]),

            // Mascotas por edad
            Mascota.aggregate([
                {
                    $group: {
                        _id: {
                            $switch: {
                                branches: [
                                    { case: { $lt: ['$edad', 1] }, then: 'Cachorro' },
                                    { case: { $lt: ['$edad', 3] }, then: 'Joven' },
                                    { case: { $lt: ['$edad', 7] }, then: 'Adulto' },
                                    { case: { $gte: ['$edad', 7] }, then: 'Senior' }
                                ],
                                default: 'Desconocido'
                            }
                        },
                        count: { $sum: 1 }
                    }
                }
            ]),

            // Top 5 razas más populares
            Mascota.aggregate([
                { $group: { _id: '$raza', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ])
        ]);

        res.json({
            usuariosPorMes: reportes[0],
            mascotasPorEdad: reportes[1],
            razasPopulares: reportes[2]
        });
    } catch (error) {
        console.error('Error getting reportes:', error);
        res.status(500).json({ message: 'Error al generar reportes' });
    }
};

module.exports = adminController;