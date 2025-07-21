const http = require('http');

async function testAPI() {
    try {
        console.log('🔍 Probando API de admin...');
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/admin/usuarios',
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
                    
                    console.log('📊 Respuesta de la API:');
                    console.log('Total usuarios:', response.totalUsuarios);
                    console.log('Usuarios encontrados:', response.usuarios.length);
                    
                    console.log('\n👥 Datos de usuarios:');
                    response.usuarios.forEach((usuario, index) => {
                        console.log(`${index + 1}. ${usuario.nombre} (${usuario.email})`);
                        console.log(`   - ID: ${usuario._id}`);
                        console.log(`   - Mascotas: ${usuario.cantidadMascotas !== undefined ? usuario.cantidadMascotas : 'NO DEFINIDO'}`);
                        console.log(`   - Registro: ${usuario.fechaRegistro || usuario.createdAt || 'NO FECHA'}`);
                        console.log('');
                    });
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

testAPI();
