const mongoose = require('mongoose');

async function checkMascotas() {
    try {
        console.log('🔍 Conectando a MongoDB...');
        await mongoose.connect('mongodb+srv://danielyug:leinad2003@cluster0.mqsi2ll.mongodb.net/onichipdb');
        console.log('✅ Conectado');
        
        const Usuario = mongoose.model('Usuario', new mongoose.Schema({
            nombre: String,
            email: String,
            password: String,
            telefono: String,
            fechaRegistro: { type: Date, default: Date.now }
        }));
        
        const Mascota = mongoose.model('Mascota', new mongoose.Schema({
            nombre: String,
            especie: String,
            raza: String,
            edad: Number,
            propietario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
            fechaRegistro: { type: Date, default: Date.now }
        }));
        
        console.log('\n👥 USUARIOS:');
        const usuarios = await Usuario.find({}).lean();
        usuarios.forEach(u => {
            console.log(`ID: ${u._id}, Nombre: ${u.nombre}, Email: ${u.email}`);
        });
        
        console.log('\n🐕 MASCOTAS:');
        const mascotas = await Mascota.find({}).lean();
        mascotas.forEach(m => {
            console.log(`ID: ${m._id}, Nombre: ${m.nombre}, Propietario: ${m.propietario}, Tipo: ${typeof m.propietario}`);
        });
        
        console.log('\n🔗 VERIFICANDO RELACIONES:');
        for (const usuario of usuarios) {
            const count = await Mascota.countDocuments({ propietario: usuario._id });
            console.log(`${usuario.nombre}: ${count} mascotas`);
        }
        
        mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

checkMascotas();
