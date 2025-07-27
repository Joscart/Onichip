/**
 * ================================================
 * 👥 USUARIOS CONTROLLER - GESTIÓN DE USUARIOS
 * ================================================
 * 
 * Controlador para operaciones CRUD de usuarios del sistema
 * Incluye registro, autenticación y gestión de perfiles
 * 
 * @author Onichip Team
 * @version 2.0
 */

const Usuario = require('../models/usuario');
const bcrypt = require('bcryptjs');
const usuariosController = {};

/**
 * 👥 Obtener todos los usuarios
 * 
 * @description Obtiene lista de todos los usuarios registrados con sus mascotas
 * @route GET /api/usuarios
 * @access Public
 * 
 * @input None - No requiere parámetros
 * 
 * @output {Array} 200 - Lista de usuarios con mascotas pobladas
 * @output {Object} 500 - Error interno del servidor
 */
usuariosController.getUsuarios = async (req, res) => {
    try {
        const usuarios = await Usuario.find().populate('mascotas');
        console.log(`✅ ${usuarios.length} usuarios obtenidos exitosamente`);
        res.json(usuarios);
    } catch (error) {
        console.error('❌ Error al obtener usuarios:', error);
        res.status(500).json({ message: 'Error al obtener usuarios' });
    }
};

/**
 * 👤 Obtener usuario por ID
 * 
 * @description Obtiene un usuario específico con sus mascotas
 * @route GET /api/usuarios/:id
 * @access Public
 * 
 * @input {string} req.params.id - ID del usuario a buscar
 * 
 * @output {Object} 200 - Usuario encontrado con mascotas pobladas
 * @output {Object} 404 - Usuario no encontrado
 * @output {Object} 500 - Error interno del servidor
 */
usuariosController.getUsuario = async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.params.id).populate('mascotas');
        
        if (!usuario) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        
        console.log(`✅ Usuario obtenido: ${usuario.nombre}`);
        res.json(usuario);
    } catch (error) {
        console.error('❌ Error al obtener usuario:', error);
        res.status(500).json({ message: 'Error al obtener usuario' });
    }
};

/**
 * ➕ Crear nuevo usuario
 * 
 * @description Registra un nuevo usuario en el sistema con validaciones
 * @route POST /api/usuarios
 * @access Public
 * 
 * @input {Object} req.body - Datos del usuario
 * @input {string} req.body.nombre - Nombre completo del usuario
 * @input {string} req.body.email - Email único del usuario
 * @input {string} req.body.password - Contraseña (será encriptada)
 * 
 * @output {Object} 201 - Usuario creado exitosamente
 * @output {Object} 400 - Error de validación (duplicados, campos faltantes)
 * @output {Object} 500 - Error interno del servidor
 */
usuariosController.addUsuario = async (req, res) => {
    console.log('🔍 Iniciando validación de registro...');
    console.time('⏱️ Tiempo de validación');
    
    try {
        const { nombre, email, password } = req.body;
        console.log('📝 Datos recibidos:', { nombre, email, password: '***' });
        
        // Verificar duplicados en paralelo para mayor velocidad
        console.log('🔍 Verificando duplicados...');
        const startTime = Date.now();
        
        const [usuarioExistentePorNombre, usuarioExistentePorEmail] = await Promise.all([
            Usuario.findOne({ nombre }).lean().select('_id nombre'), // Solo traer campos necesarios
            Usuario.findOne({ email }).lean().select('_id email')
        ]);
        
        const queryTime = Date.now() - startTime;
        console.log(`⚡ Consultas completadas en ${queryTime}ms`);
        
        if (usuarioExistentePorNombre) {
            console.log('❌ Usuario duplicado encontrado:', usuarioExistentePorNombre.nombre);
            console.timeEnd('⏱️ Tiempo de validación');
            return res.status(400).json({ 
                message: 'Este usuario ya está en uso. Por favor, elige otro usuario.' 
            });
        }
        
        if (usuarioExistentePorEmail) {
            console.log('❌ Email duplicado encontrado:', usuarioExistentePorEmail.email);
            console.timeEnd('⏱️ Tiempo de validación');
            return res.status(400).json({ 
                message: 'Este email ya está registrado. Por favor, usa otro email.' 
            });
        }
        
        console.log('✅ No hay duplicados, creando usuario...');
        
        // Hashear la contraseña antes de guardar
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        console.log('🔒 Contraseña hasheada correctamente');
        
        const usuario = new Usuario({
            nombre,
            email,
            password: hashedPassword
        });
        
        await usuario.save();
        
        console.timeEnd('⏱️ Tiempo de validación');
        console.log('✅ Usuario registrado exitosamente:', nombre);
        
        res.json({ 
            message: 'Usuario registrado exitosamente',
            usuario: {
                id: usuario._id,
                nombre: usuario.nombre,
                email: usuario.email
            }
        });
    } catch (error) {
        console.timeEnd('⏱️ Tiempo de validación');
        console.error('💥 Error al registrar usuario:', error);
        
        // Manejar errores de duplicación de MongoDB (respaldo)
        if (error.code === 11000) {
            const duplicatedField = Object.keys(error.keyPattern)[0];
            console.log('🔒 Error de índice único detectado:', duplicatedField);
            if (duplicatedField === 'nombre') {
                return res.status(400).json({ 
                    message: 'Este usuario ya está en uso. Por favor, elige otro usuario.' 
                });
            } else if (duplicatedField === 'email') {
                return res.status(400).json({ 
                    message: 'Este email ya está registrado. Por favor, usa otro email.' 
                });
            }
        }
        
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};


// POST login usuario
usuariosController.loginUsuario = async (req, res) => {
    try {
        const { nombre, password } = req.body;
        console.log('🔐 Intento de login para usuario:', nombre);
        
        if (!nombre || !password) {
            return res.status(400).json({ message: 'Usuario y contraseña requeridos.' });
        }
        
        const usuario = await Usuario.findOne({ nombre }).lean();
        if (!usuario) {
            console.log('❌ Usuario no encontrado:', nombre);
            return res.status(401).json({ message: 'Usuario no encontrado.' });
        }
        
        // Comparar contraseña con bcrypt
        const passwordMatch = await bcrypt.compare(password, usuario.password);
        console.log('🔍 Password match:', passwordMatch);
        
        if (!passwordMatch) {
            console.log('❌ Contraseña incorrecta para:', nombre);
            return res.status(401).json({ message: 'Contraseña incorrecta.' });
        }
        
        console.log('✅ Login exitoso para usuario:', nombre);
        res.json({ 
            usuario: {
                id: usuario._id,
                nombre: usuario.nombre,
                email: usuario.email
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

// PUT actualizar usuario
usuariosController.editUsuario = async (req, res) => {
    const { id } = req.params;
    await Usuario.findByIdAndUpdate(id, { $set: req.body }, { new: true });
    res.json('Usuario actualizado exitosamente');
};

// DELETE eliminar usuario
usuariosController.deleteUsuario = async (req, res) => {
    await Usuario.findByIdAndDelete(req.params.id);
    res.json('Usuario eliminado exitosamente');
};

module.exports = usuariosController;
