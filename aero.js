const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {
            satellite: {
                type: 'raster',
                tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                maxzoom: 19
            },
            drawnLine: {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            }
        },
        layers: [
            {
                id: 'satellite-layer',
                type: 'raster',
                source: 'satellite',
                layout: { visibility: 'visible' }
            },
            {
                id: 'drawn-line',
                type: 'line',
                source: 'drawnLine',
                paint: {
                    'line-color': '#ff0000',
                    'line-width': 3
                }
            }
        ]
    },
    center: [13.4050, 52.5200],  // Starting position (Berlin)
    zoom: 12,
    pitch: 45,
    bearing: 0
});

let generalAltitude = 10;
let drawnLine = [];
let waypoints = [];
const markers = [];
let isDrawing = false;  // Tracks whether drawing is allowed
let locked = false;  // If drawing is locked after completion
let highlightedWaypoint = null;  // Track highlighted waypoint for altitude change

document.getElementById('search-bar').addEventListener('input', searchWaypoints);

map.on('mousedown', (e) => {
    if (locked) return;  // Prevent drawing after lock
    isDrawing = true;
    const point = { lat: e.lngLat.lat, lng: e.lngLat.lng, altitude: generalAltitude };
    drawnLine.push(point);
    waypoints.push(point);

    const marker = new maplibregl.Marker()
        .setLngLat([point.lng, point.lat])
        .setPopup(new maplibregl.Popup().setText(`Altitude: ${point.altitude} m`))

        .addTo(map);

    markers.push(marker);
    updateWaypointList();
    map.dragPan.disable();  // Disable map dragging while drawing
});

map.on('mousemove', (e) => {
    if (isDrawing && !locked) {
        const point = { lat: e.lngLat.lat, lng: e.lngLat.lng, altitude: generalAltitude };
        drawnLine.push(point);
        waypoints.push(point);

        map.getSource('drawnLine').setData({
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: drawnLine.map(pt => [pt.lng, pt.lat]) }
                }
            ]
        });

        updateWaypointList();
    }
});

map.on('mouseup', () => {
    if (locked) return;  // If locked, stop drawing
    isDrawing = false;
    map.dragPan.enable();  // Re-enable map dragging
    locked = true;  // Lock the map after drawing is complete
});

map.on('click', (e) => {
    if (locked) {  // Only allow selecting from drawn waypoints
        const clickPoint = e.lngLat;
        const closestWaypoint = findClosestWaypoint(clickPoint);
        if (closestWaypoint) {
            highlightedWaypoint = closestWaypoint;
            highlightWaypoint(closestWaypoint.index);
            alert(`You clicked on Waypoint ${closestWaypoint.index + 1}.`);

        }
    }
});

function updateWaypointList() {
    const listContainer = document.getElementById('waypoint-list');
    listContainer.innerHTML = '';
    waypoints.forEach((wp, index) => {
        const item = document.createElement('div');
        item.className = 'waypoint-item';
        item.innerHTML = 
            `<label><strong>Waypoint ${index + 1}</strong></label>
            <label>Latitude: ${wp.lat.toFixed(5)}</label>
            <label>Longitude: ${wp.lng.toFixed(5)}</label>
            <label>Altitude (m):</label>
            <input type="number" value="${wp.altitude || generalAltitude}" step="1" 
                onchange="updateWaypointAltitude(${index}, this.value)" />
            <button onclick="updateAltitudeForCSV(${index})">Update</button>
        `;
        listContainer.appendChild(item);
    });
}



function updateWaypointAltitude(index, newAltitude) {
    waypoints[index].altitude = parseInt(newAltitude) || null; // Set specific altitude or null for fallback
    markers[index].setPopup(new maplibregl.Popup().setText(`Waypoint ${index + 1} - Altitude: ${waypoints[index].altitude || generalAltitude} m`));
    updateWaypointList(); // Update the list to reflect the change
}


function highlightWaypoint(index) {
    document.querySelectorAll('.waypoint-item')[index].classList.add('highlight');
    map.flyTo({ center: [waypoints[index].lng, waypoints[index].lat], zoom: 15 });
}

function unhighlightWaypoint(index) {
    document.querySelectorAll('.waypoint-item')[index].classList.remove('highlight');
}

function findClosestWaypoint(clickPoint) {
    let closestWaypoint = null;
    let closestDistance = Infinity;

    waypoints.forEach((wp, index) => {
        const distance = getDistance(clickPoint, wp);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestWaypoint = { ...wp, index };
        }
    });

    return closestWaypoint;
}

function getDistance(point1, point2) {
    const R = 6371; // Radius of Earth in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c * 1000; // Distance in meters
    return distance;
}

function searchWaypoints() {
    const query = document.getElementById('search-bar').value.toLowerCase();
    const items = document.querySelectorAll('.waypoint-item');
    items.forEach(item => {
        const waypoint = item.querySelector('label').innerText.toLowerCase();
        if (waypoint.includes(query)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

function zoomIn() {
const currentZoom = map.getZoom();
map.zoomTo(currentZoom + 1);
}

function zoomOut() {
const currentZoom = map.getZoom();
map.zoomTo(currentZoom - 1);
}

function getMyLocation() {
if (navigator.geolocation) {
navigator.geolocation.getCurrentPosition(function(position) {
    const userLocation = [position.coords.longitude, position.coords.latitude];
    map.flyTo({
        center: userLocation,
        zoom: 14
    });

    // Optionally, add a marker for the user's location
    new maplibregl.Marker()
        .setLngLat(userLocation)
        .setPopup(new maplibregl.Popup().setText('You are here!'))
        .addTo(map);
}, function(error) {
    alert('Error: ' + error.message);
});
} else {
alert("Geolocation is not supported by this browser.");
}
}


let pitchInterval;
let bearingInterval;

// Increase pitch with a higher limit (0 to 85 degrees) when button is held down
document.getElementById('increase-pitch').addEventListener('mousedown', () => {
    pitchInterval = setInterval(() => {
        const currentPitch = map.getPitch();
        const newPitch = Math.min(currentPitch + 1, 85);  // Increase pitch by 1 degree every interval
        map.setPitch(newPitch);
    }, 50);  // Repeat every 50ms (adjust speed if necessary)
});

document.getElementById('increase-pitch').addEventListener('mouseup', () => {
    clearInterval(pitchInterval);  // Stop increasing pitch when button is released
});

// Decrease pitch with a lower limit (0 to 85 degrees) when button is held down
document.getElementById('decrease-pitch').addEventListener('mousedown', () => {
    pitchInterval = setInterval(() => {
        const currentPitch = map.getPitch();
        const newPitch = Math.max(currentPitch - 1, 0);  // Decrease pitch by 1 degree every interval
        map.setPitch(newPitch);
    }, 50);  // Repeat every 50ms
});

document.getElementById('decrease-pitch').addEventListener('mouseup', () => {
    clearInterval(pitchInterval);  // Stop decreasing pitch when button is released
});

// Rotate map to the left when the button is held down
document.getElementById('rotate-left').addEventListener('mousedown', () => {
    bearingInterval = setInterval(() => {
        const currentBearing = map.getBearing();
        map.rotateTo(currentBearing - 1, { duration: 0 });  // Rotate left by 1 degree every interval
    }, 50);  // Repeat every 50ms
});

document.getElementById('rotate-left').addEventListener('mouseup', () => {
    clearInterval(bearingInterval);  // Stop rotating when button is released
});

// Rotate map to the right when the button is held down
document.getElementById('rotate-right').addEventListener('mousedown', () => {
    bearingInterval = setInterval(() => {
        const currentBearing = map.getBearing();
        map.rotateTo(currentBearing + 1, { duration: 0 });  // Rotate right by 1 degree every interval
    }, 50);  // Repeat every 50ms
});

document.getElementById('rotate-right').addEventListener('mouseup', () => {
    clearInterval(bearingInterval);  // Stop rotating when button is released
});




function generateCSV() {
    const header = ['Latitude', 'Longitude', 'Altitude'];
    const rows = waypoints.map(wp => [
        wp.lat,
        wp.lng,
        wp.altitude || generalAltitude // Use specific altitude if set, otherwise fallback
    ]);

    let csvContent = header.join(',') + '\n';
    rows.forEach(row => {
        csvContent += row.join(',') + '\n';
    });

    return csvContent;
}


// Function to trigger the download of CSV
function downloadCSV() {
    const csvContent = generateCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', 'waypoints.csv');
    link.click();
}


// Add event listener for CSV download button
document.getElementById('download-csv').addEventListener('click', downloadCSV);





function setGeneralAltitude(value) {
    generalAltitude = parseInt(value) || 10;
    console.log(`General altitude set to: ${generalAltitude} meters`);
    updateWaypointList(); // Refresh the waypoint list to reflect new general altitude
}


// Function to generate CSV content
function generateCSV() {
    const header = ['Latitude', 'Longitude', 'Altitude', 'Point Type'];
    const rows = waypoints.map((wp, index) => [
        wp.lat,
        wp.lng,
        wp.altitude || generalAltitude, // Use user-specified altitude if available; otherwise, use general altitude
        index === 0 ? 'Start' : index === waypoints.length - 1 ? 'Land' : `Waypoint ${index}` // Point Type in the last column
    ]);

    let csvContent = header.join(',') + '\n';
    rows.forEach(row => {
        csvContent += row.join(',') + '\n';
    });

    return csvContent;
}



function updateAltitudeForCSV(index) {
    const updatedAltitude = waypoints[index].altitude || generalAltitude;
    markers[index].setPopup(new maplibregl.Popup().setText(`Waypoint ${index + 1} - Altitude: ${updatedAltitude} m`));
    generateCSV();  // Ensure CSV is updated
}


function updateWaypointAltitude(index, newAltitude) {
    waypoints[index].altitude = parseInt(newAltitude) || null; // Set specific altitude or null for fallback
    markers[index].setPopup(new maplibregl.Popup().setText(`Waypoint ${index + 1} - Altitude: ${waypoints[index].altitude || generalAltitude} m`));
    updateWaypointList(); // Update the list to reflect the change
}