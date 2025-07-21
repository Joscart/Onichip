const mongoose = require('mongoose');

async function debugSearch() {
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
        
        console.log('\n👥 USUARIOS Y SUS IDs:');
        const usuarios = await Usuario.find({});
        usuarios.forEach(u => {
            const id = u._id.toString();
            console.log(`Nombre: ${u.nombre}`);
            console.log(`ID completo: ${id}`);
            console.log(`ID primeros 8: ${id.substring(0, 8)}`);
            console.log(`Contiene "687CCCB8": ${id.toUpperCase().includes('687CCCB8')}`);
            console.log(`Contiene "687cccb8": ${id.toLowerCase().includes('687cccb8')}`);
            console.log('---');
        });
        
        // Probar búsqueda manual
        console.log('\n🔍 PRUEBA MANUAL DE BÚSQUEDA:');
        const searchTerm = '687CCCB8';
        const filteredUsers = usuarios.filter(user => {
            const userId = user._id.toString().toLowerCase();
            const searchLower = searchTerm.toLowerCase();
            
            console.log(`Comparando: ${userId} incluye ${searchLower} ? ${userId.includes(searchLower)}`);
            return userId.includes(searchLower);
        });
        
        console.log(`\nResultados encontrados: ${filteredUsers.length}`);
        filteredUsers.forEach(u => {
            console.log(`- ${u.nombre} (${u._id})`);
        });
        
        mongoose.disconnect();
        console.log('\n✅ Completado');
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

debugSearch();
