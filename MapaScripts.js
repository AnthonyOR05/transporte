// Inicializar mapa
const map = L.map('map').setView([25.6751, -100.3185], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Cargar rutas con validación
async function loadRoutes() {
    try {
        const response = await fetch('./rutas.json');
        if (!response.ok) throw new Error('Error al cargar rutas');
        const data = await response.json();
        
        if (!Array.isArray(data)) {
            console.error("El archivo JSON no contiene un array:", data);
            return [];
        }
        
        return data;
    } catch (error) {
        console.error("Error:", error);
        return [];
    }
}

// Dibujar ruta
function drawRoute(route) {
    // Limpiar mapa usando capas en lugar de iterar
    const layersToRemove = [];
    map.eachLayer(layer => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
            layersToRemove.push(layer);
        }
    });
    layersToRemove.forEach(layer => map.removeLayer(layer));

    // Mostrar info con mejor formato
    document.getElementById('route-info').innerHTML = `
        <h2>${route.nombre}</h2>
        <h3>Paradas:</h3>
        <ol>${route.paradas.map(p => `<li><strong>${p.nombre}</strong></li>`).join('')}</ol>
    `;

    // Dibujar marcadores con mejor popup
    route.paradas.forEach(parada => {
        L.marker([parada.lat, parada.lng])
            .addTo(map)
            .bindPopup(`
                <b>${parada.nombre}</b><br>
                <small>Parte de: ${route.nombre}</small>
            `);
    });

    // Dibujar línea con mejor estilo
    const puntos = route.paradas.map(p => [p.lat, p.lng]);
    L.polyline(puntos, { 
        color: '#0066cc',
        weight: 4,
        opacity: 0.8,
        dashArray: '5, 5'
    }).addTo(map);
    
    // Ajustar vista con padding
    if (route.paradas.length > 0) {
        map.fitBounds(puntos, { padding: [50, 50] });
    }
}

// Búsqueda
document.getElementById('btn-search').addEventListener('click', async () => {
    const query = document.getElementById('search').value.trim().toLowerCase();
    
    if (!query) {
        alert('Ingrese un término de búsqueda');
        return;
    }

    try {
        const rutas = await loadRoutes();
        console.log("Rutas disponibles:", rutas);
        
        const found = rutas.find(r => 
            r.nombre.toLowerCase().includes(query) || 
            r.paradas.some(p => p.nombre.toLowerCase().includes(query))
        );

        if (found) {
            console.log("Ruta encontrada:", found);
            drawRoute(found);
        } else {
            alert(`No se encontró "${query}" en nombres de ruta o paradas`);
        }
    } catch (error) {
        console.error("Error en búsqueda:", error);
        alert('Error al buscar rutas. Ver consola para detalles.');
    }
});

// Carga inicial
loadRoutes().then(rutas => {
    if (rutas.length > 0) {
        drawRoute(rutas[0]); // Mostrar primera ruta al cargar
    }
});