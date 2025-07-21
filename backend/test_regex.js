// Prueba simple para entender el problema
const searchTerm = '687CCCB8';

console.log('🔍 Probando detección de ID...');
console.log(`Término de búsqueda: "${searchTerm}"`);
console.log(`Longitud: ${searchTerm.length}`);
console.log(`Es hexadecimal?: ${/^[0-9a-fA-F]+$/i.test(searchTerm)}`);
console.log(`Regex test: ${/^[0-9a-fA-F]+$/i.test(searchTerm)}`);

// Probar otros casos
const testCases = ['687CCCB8', '687cccb8', 'daniel', '123abc', 'ABC123'];
testCases.forEach(test => {
    const isHex = /^[0-9a-fA-F]+$/i.test(test);
    console.log(`"${test}" es hexadecimal: ${isHex}`);
});

console.log('\n✅ Prueba completada');
