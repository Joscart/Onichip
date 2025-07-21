const bcrypt = require('bcryptjs');
const Usuario = require('../models/usuario');

console.log('🔧 Controladores de recuperación cargados');

// Endpoint de prueba simple
const testConexion = async (req, res) => {
  try {
    console.log('🔍 Test de conexión iniciado');
    res.status(200).json({ 
      message: 'Servidor funcionando correctamente',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en test:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

// Validar email y permitir cambio de contraseña
const validarEmail = async (req, res) => {
  console.log('📧 Validando email:', req.body);
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'El correo electrónico es requerido' });
    }

    // Buscar usuario por email en la base de datos
    console.log('🔍 Buscando usuario en MongoDB...');
    const usuario = await Usuario.findOne({ email });

    if (!usuario) {
      console.log('❌ Usuario no encontrado');
      return res.status(404).json({ message: 'No existe una cuenta con este correo electrónico' });
    }

    console.log('✅ Usuario encontrado:', usuario.email);
    // Si el usuario existe, devolver éxito (sin exponer datos sensibles)
    res.status(200).json({ 
      message: 'Correo electrónico válido',
      emailValido: true,
      usuarioId: usuario._id 
    });

  } catch (error) {
    console.error('Error al validar email:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Actualizar contraseña
const actualizarContrasena = async (req, res) => {
  try {
    const { email, nuevaContrasena } = req.body;

    if (!email || !nuevaContrasena) {
      return res.status(400).json({ message: 'Email y nueva contraseña son requeridos' });
    }

    if (nuevaContrasena.length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Buscar usuario por email
    const usuario = await Usuario.findOne({ email });

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Encriptar nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(nuevaContrasena, salt);

    // Actualizar contraseña en la base de datos
    await Usuario.findByIdAndUpdate(usuario._id, { 
      password: hashedPassword 
    });

    res.status(200).json({ 
      message: 'Contraseña actualizada exitosamente',
      success: true 
    });

  } catch (error) {
    console.error('Error al actualizar contraseña:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

module.exports = {
  testConexion,
  validarEmail,
  actualizarContrasena
};