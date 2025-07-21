const mongoose = require('./src/database');
const Admin = require('./src/models/admin');
const bcrypt = require('bcrypt');

async function crearAdmin() {
  try {
    console.log('🔧 Creando administrador de prueba...');
    
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const admin = new Admin({
      email: 'admin@onichip.com',
      password: hashedPassword,
      nombre: 'Administrador Principal',
      rol: 'super_admin',
      permisos: {
        usuarios: true,
        mascotas: true,
        reportes: true,
        configuracion: true
      }
    });
    
    await admin.save();
    console.log('✅ Admin creado exitosamente!');
    console.log('📧 Email: admin@onichip.com');
    console.log('🔑 Password: admin123');
    console.log('👑 Rol: super_admin');
    console.log('');
    console.log('🌐 Ahora puedes acceder en: http://localhost:4200/admin');
    process.exit(0);
  } catch (error) {
    if (error.code === 11000) {
      console.log('⚠️ El admin ya existe en la base de datos');
      console.log('📧 Email: admin@onichip.com');
      console.log('🔑 Password: admin123');
      console.log('🌐 Accede en: http://localhost:4200/admin');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(0);
  }
}

setTimeout(crearAdmin, 2000);
