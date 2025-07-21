const mongoose = require('./src/database');
const Admin = require('./src/models/admin');
const bcrypt = require('bcrypt');

async function crearAdminDaniel() {
  try {
    console.log('🔧 Creando administrador Daniel...');
    
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    const admin = new Admin({
      email: 'daniel@onichip.com',
      password: hashedPassword,
      nombre: 'Daniel Administrador',
      rol: 'super_admin',
      permisos: {
        usuarios: true,
        mascotas: true,
        reportes: true,
        configuracion: true
      }
    });
    
    await admin.save();
    console.log('✅ Admin Daniel creado exitosamente!');
    console.log('📧 Email: daniel@onichip.com');
    console.log('🔑 Password: 123456');
    console.log('👑 Rol: super_admin');
    console.log('');
    console.log('🌐 Ahora puedes acceder en: http://localhost:4200/admin');
    process.exit(0);
  } catch (error) {
    if (error.code === 11000) {
      console.log('⚠️ El admin Daniel ya existe en la base de datos');
      console.log('📧 Email: daniel@onichip.com');
      console.log('🔑 Password: 123456');
      console.log('🌐 Accede en: http://localhost:4200/admin');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(0);
  }
}

setTimeout(crearAdminDaniel, 2000);
