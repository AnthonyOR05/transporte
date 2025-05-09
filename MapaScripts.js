// Declaración global del mapa
let map;

// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    setupEventListeners();
    loadInitialData();
});

// Inicialización del mapa
function initializeMap() {
    // Verificar si el contenedor existe
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('Error: No se encontró el contenedor del mapa');
        return;
    }
    
    // Inicializar el mapa
    map = L.map('map').setView([32.53093, -117.01761], 13);
    
    // Añadir capa base de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
    }).addTo(map);
    
    // Forzar redimensionamiento después de un breve retraso
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
}

// Configuración de event listeners
function setupEventListeners() {
    // Búsqueda principal
    document.getElementById('btn-search').addEventListener('click', searchRoutes);
    document.getElementById('search').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchRoutes();
    });
    
    // Búsqueda en el menú lateral
    const sidebarSearchBtn = document.getElementById('sidebar-search-btn');
    if (sidebarSearchBtn) {
        sidebarSearchBtn.addEventListener('click', filterRoutes);
        document.getElementById('sidebar-search').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') filterRoutes();
        });
    }
    
    // Botón de geolocalización
    const locationBtn = document.getElementById('btn-location');
    if (locationBtn) {
        locationBtn.addEventListener('click', locateUser);
    }
    
    // Menú toggle para móviles
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }
    
    const closeBtn = document.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeSidebar);
    }
}

// Carga inicial de datos
function loadInitialData() {
   loadRoutes()
    .then(rutas => {
        if (rutas.length > 0) {
            loadRoutesIntoSidebar(rutas);
            clearMap(); // Limpia el mapa por si acaso
            const colors = generateColors(rutas.length);
            rutas.forEach((ruta, index) => {
                drawRoute(ruta, colors[index]);
            });
            updateRouteInfo(rutas[0]); // Mostrar la info de la primera ruta
        } else {
            console.warn('No se encontraron rutas');
        }
    })
}

// Función para cargar rutas desde el JSON
async function loadRoutes() {
    try {
        const response = await fetch('./rutas.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (!Array.isArray(data)) {
            throw new Error("El formato del JSON no es válido");
        }
        
        return data;
    } catch (error) {
        console.error("Error cargando rutas:", error);
        return [];
    }
}

// Función para dibujar una ruta en el mapa
function drawRoute(route, color = '#0066cc') {
    if (!map) {
        console.error('El mapa no está inicializado');
        return;
    }

    // NO limpiar el mapa aquí (se hace una vez desde searchRoutes)
    if (!route.paradas || !Array.isArray(route.paradas) || route.paradas.length === 0) {
        console.error('La ruta no tiene paradas válidas');
        return;
    }

    const puntos = [];

    route.paradas.forEach(parada => {
        if (isValidCoordinate(parada.lat, parada.lng)) {
            const marker = L.marker([parada.lat, parada.lng], {
                icon: L.divIcon({
                    className: 'bus-marker',
                    html: '<i class="fas fa-bus"></i>',
                    iconSize: [24, 24]
                })
            }).addTo(map);

            marker.bindPopup(`
                <div class="popup-content">
                    <h4>${parada.nombre}</h4>
                    <p><strong>Ruta:</strong> ${route.nombre}</p>
                </div>
            `);

            puntos.push([parada.lat, parada.lng]);
        }
    });

    if (puntos.length > 1) {
        L.polyline(puntos, {
            color: color,
            weight: 4,
            opacity: 0.8
        }).addTo(map);
    }

    // Solo ajustar vista a la primera ruta encontrada
    if (puntos.length > 0 && color === '#0066cc') {
        map.fitBounds(puntos, { padding: [50, 50], maxZoom: 15 });
    }

    updateRouteInfo(route);
    setTimeout(() => map.invalidateSize(), 0);
}
function generateColors(count) {
    const colors = [];
    for (let i = 0; i < count; i++) {
        const hue = Math.floor((360 / count) * i);
        colors.push(`hsl(${hue}, 80%, 50%)`);
    }
    return colors;
}


// Función para limpiar el mapa
function clearMap() {
    if (!map) return;
    
    map.eachLayer(layer => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });
}

// Función de búsqueda principal
function searchRoutes() {
    const query = document.getElementById('search').value.trim().toLowerCase();

    if (!query) {
        alert('Por favor ingrese un término de búsqueda');
        return;
    }

    loadRoutes()
        .then(rutas => {
            // Buscar TODAS las rutas que contienen el nombre de parada o ruta
            const foundRoutes = rutas.filter(r =>
                r.nombre.toLowerCase().includes(query) ||
                r.paradas.some(p => p.nombre.toLowerCase().includes(query))
            );

            if (foundRoutes.length > 0) {
                clearMap(); // Limpiar mapa solo una vez
                foundRoutes.forEach(ruta => {
                drawRoute(ruta, getRandomColor());
            });

                highlightRouteInSidebar(foundRoutes[0].nombre);
            } else {
                alert(`No se encontró "${query}" en nombres de ruta o paradas`);
            }
        })
        .catch(error => {
            console.error("Error en búsqueda:", error);
            alert('Error al buscar rutas. Ver consola para detalles.');
        });
}
//
function getRandomColor() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 80%, 50%)`;
}


// Función para cargar rutas en el menú lateral
function loadRoutesIntoSidebar(rutas) {
    const routesList = document.querySelector('.routes-list');
    const totalRoutes = document.getElementById('total-routes');
    const lastUpdate = document.getElementById('last-update');
    
    if (!routesList) return;
    
    // Limpiar lista
    routesList.innerHTML = '';
    
    // Actualizar contador y fecha
    totalRoutes.textContent = rutas.length;
    lastUpdate.textContent = new Date().toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Agregar cada ruta al menú
    rutas.forEach((ruta, index) => {
        const routeItem = document.createElement('div');
        routeItem.className = 'route-item';
        routeItem.innerHTML = `
            <i class="fas fa-bus"></i>
            <span>${ruta.nombre}</span>
        `;
        
        routeItem.addEventListener('click', () => {
    // Remover clase active de todos los items
    document.querySelectorAll('.route-item').forEach(item => {
        item.classList.remove('active');
    });

    // Agregar clase active al item seleccionado
    routeItem.classList.add('active');

    // Limpiar el mapa antes de dibujar la nueva ruta
    clearMap();
    drawRoute(ruta);

    // Cerrar menú en móviles
    if (window.innerWidth <= 768) {
        closeSidebar();
    }
});

        
        // Seleccionar la primera ruta por defecto
        if (index === 0) {
            routeItem.classList.add('active');
        }
        
        routesList.appendChild(routeItem);
    });
}

// Función para resaltar una ruta en el menú lateral
function highlightRouteInSidebar(routeName) {
    const routeItems = document.querySelectorAll('.route-item');
    
    routeItems.forEach(item => {
        if (item.textContent.trim() === routeName) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            item.classList.remove('active');
        }
    });
}

// Función para filtrar rutas desde el menú lateral
function filterRoutes() {
    const query = document.getElementById('sidebar-search').value.toLowerCase();
    const routeItems = document.querySelectorAll('.route-item');
    
    routeItems.forEach(item => {
        const routeName = item.textContent.toLowerCase();
        if (routeName.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Función para geolocalización
function locateUser() {
    if (!navigator.geolocation) {
        alert('La geolocalización no es soportada por tu navegador');
        return;
    }
    
    const btn = document.getElementById('btn-location');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Localizando...';
    btn.disabled = true;
    
    navigator.geolocation.getCurrentPosition(
        position => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 15);
            
            L.marker([latitude, longitude], {
                icon: L.divIcon({
                    className: 'user-marker',
                    html: '<i class="fas fa-user"></i>',
                    iconSize: [24, 24]
                })
            })
            .addTo(map)
            .bindPopup('Tu ubicación actual')
            .openPopup();
            
            btn.innerHTML = originalText;
            btn.disabled = false;
        },
        error => {
            alert(`Error al obtener ubicación: ${error.message}`);
            btn.innerHTML = originalText;
            btn.disabled = false;
        },
        { timeout: 10000 }
    );
}

// Función para actualizar la información de la ruta
function updateRouteInfo(route) {
    const routeContent = document.querySelector('.route-content');
    if (!routeContent) return;
    
    routeContent.innerHTML = `
        <div class="route-header">
            <h3>${route.nombre}</h3>
            <span class="badge">${route.paradas.length} paradas</span>
        </div>
        <div class="route-stops">
            <h4><i class="fas fa-map-marker-alt"></i> Paradas:</h4>
            <ul>
                ${route.paradas.map(p => `
                    <li>
                        <i class="fas fa-circle"></i>
                        <span>${p.nombre}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
}

// Funciones para el menú lateral
function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('open');
    setTimeout(() => map.invalidateSize(), 300);
}

function closeSidebar() {
    document.querySelector('.sidebar').classList.remove('open');
    setTimeout(() => map.invalidateSize(), 300);
}

// Función para validar coordenadas
function isValidCoordinate(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) && 
           lat >= -90 && lat <= 90 && 
           lng >= -180 && lng <= 180;
}
