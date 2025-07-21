const Usuario = require('../models/usuario');
const bcrypt = require('bcryptjs');
const usuariosController = {};

// GET todos los usuarios
usuariosController.getUsuarios = async (req, res) => {
    const usuarios = await Usuario.find().populate('mascotas');
    res.json(usuarios);
};

// GET usuario por ID
usuariosController.getUsuario = async (req, res) => {
    const usuario = await Usuario.findById(req.params.id).populate('mascotas');
    res.json(usuario);
};

// POST nuevo usuario
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
