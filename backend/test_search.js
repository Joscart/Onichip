const http = require('http');

async function testSearch(searchTerm) {
    try {
        console.log(`🔍 Probando búsqueda con: "${searchTerm}"`);
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: `/api/admin/usuarios?search=${encodeURIComponent(searchTerm)}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    
                    console.log(`📊 Resultados para "${searchTerm}":`);
                    console.log(`   Total usuarios encontrados: ${response.usuarios.length}`);
                    
                    response.usuarios.forEach((usuario, index) => {
                        console.log(`   ${index + 1}. ${usuario.nombre} (${usuario.email})`);
                        console.log(`      ID: ${usuario._id}`);
                        console.log(`      Mascotas: ${usuario.cantidadMascotas}`);
                    });
                    console.log('');
                } catch (error) {
                    console.error('❌ Error parsing JSON:', error);
                    console.log('Raw response:', data);
                }
            });
        });

        req.on('error', (error) => {
            console.error('❌ Error en request:', error);
        });

        req.end();
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Probar diferentes tipos de búsqueda
async function runTests() {
    console.log('🧪 Iniciando pruebas de búsqueda...\n');
    
    await testSearch('daniel');           // Por nombre
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testSearch('687CCCB8');         // Por ID corto
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testSearch('687cccb880fea7822c3c24ef'); // Por ID completo
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testSearch('gmail.com');        // Por email parcial
    
    console.log('✅ Pruebas completadas');
}

runTests();
