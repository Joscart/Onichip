const mongoose = require('mongoose');
const Usuario = require('./src/models/usuario');
const Mascota = require('./src/models/mascota');

async function updateMascotas() {
    try {
        // Conectar a la base de datos
        await mongoose.connect('mongodb+srv://danielyug:leinad2003@cluster0.mqsi2ll.mongodb.net/onichipdb');
        console.log('✅ Conectado a MongoDB');

        // Obtener todas las mascotas
        const mascotas = await Mascota.find({});
        console.log(`📋 Encontradas ${mascotas.length} mascotas para actualizar`);

        for (const mascota of mascotas) {
            // Si el propietario es un string, buscar el usuario por nombre
            if (typeof mascota.propietario === 'string') {
                const usuario = await Usuario.findOne({ nombre: mascota.propietario });
                
                if (usuario) {
                    // Actualizar la mascota con el ObjectId del usuario
                    await Mascota.findByIdAndUpdate(mascota._id, {
                        propietario: usuario._id
                    });
                    console.log(`✅ Mascota "${mascota.nombre}" actualizada para usuario "${usuario.nombre}"`);
                    
                    // Agregar la mascota al array del usuario si no está ya
                    if (!usuario.mascotas.includes(mascota._id)) {
                        usuario.mascotas.push(mascota._id);
                        await usuario.save();
                        console.log(`📝 Mascota agregada al array del usuario "${usuario.nombre}"`);
                    }
                } else {
                    console.log(`❌ Usuario no encontrado para mascota "${mascota.nombre}" con propietario "${mascota.propietario}"`);
                }
            }
        }

        console.log('🎉 Actualización completada');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

updateMascotas();
