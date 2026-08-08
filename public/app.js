function switchTab(tabId) {
    document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.className = "nav-btn px-4 py-1.5 text-sm font-medium rounded-md text-slate-400 hover:text-white transition-all";
    });
    document.getElementById('btn-' + tabId).className = "nav-btn px-4 py-1.5 text-sm font-medium rounded-md bg-sky-600 text-white transition-all";

    if (tabId === 'tab-spatial' && map) setTimeout(() => map.invalidateSize(), 100);
    if (tabId === 'tab-spatial' && renderer && camera) {
        const container = document.getElementById('three-container');
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }
}

let socket, fullLog = [], map, marker, cansatModel, renderer, camera;
let prevAlt = 0, lastTime = 0;

try {
    socket = io();
    socket.on('connect', () => {
        document.getElementById('conn-status').className = "w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]";
        logTerm("SYSTEM ONLINE", "sys");
    });
    socket.on('disconnect', () => {
        document.getElementById('conn-status').className = "w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]";
        logTerm("SYSTEM OFFLINE", "err");
    });
} catch (e) { }

function init3D() {
    const container = document.getElementById('three-container');
    const scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 1.5, 7);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const light = new THREE.DirectionalLight(0xffffff, 0.8);
    light.position.set(5, 5, 5);
    scene.add(light);

    const geo = new THREE.CylinderGeometry(0.5, 0.5, 2.5, 32);
    const mats = [
        new THREE.MeshLambertMaterial({ color: 0x0ea5e9 }),
        new THREE.MeshLambertMaterial({ color: 0x334155 }),
        new THREE.MeshLambertMaterial({ color: 0x334155 })
    ];
    cansatModel = new THREE.Mesh(geo, mats);
    scene.add(cansatModel);
    scene.add(new THREE.AxesHelper(1.5));

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        if (container.clientWidth > 0) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    });
}

Chart.defaults.color = '#475569';
Chart.defaults.font.family = "'JetBrains Mono', monospace";
Chart.defaults.elements.point.radius = 0;
Chart.defaults.elements.line.borderWidth = 1.5;

function makeChart(id, l1, c1, l2 = null, c2 = null) {
    const ctx = document.getElementById(id).getContext('2d');
    const cfg = {
        type: 'line', data: { labels: [], datasets: [{ label: l1, data: [], borderColor: c1, tension: 0.1 }] },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            scales: { x: { grid: { color: '#1e293b' } }, y: { grid: { color: '#1e293b' } } },
            plugins: { legend: { labels: { boxWidth: 10 } } }
        }
    };
    if (l2) {
        cfg.data.datasets.push({ label: l2, data: [], borderColor: c2, tension: 0.1, yAxisID: 'y1' });
        cfg.options.scales.y1 = { type: 'linear', position: 'right', grid: { drawOnChartArea: false } };
    }
    return new Chart(ctx, cfg);
}

let cAlt, cEnv, cAcc, cGyr;

window.onload = function () {
    init3D();
    cAlt = makeChart('chart-alt', 'Altitude (m)', '#38bdf8');
    cEnv = makeChart('chart-env', 'Pressure (Pa)', '#64748b', 'Temp °C', '#fbbf24');
    cAcc = makeChart('chart-accel', 'Accel Z', '#f87171');
    cGyr = makeChart('chart-gyro', 'Spin (deg/s)', '#a78bfa');

    map = L.map('gnss-map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '' }).addTo(map);
    marker = L.marker([0, 0], {
        icon: L.divIcon({ html: '<div class="w-3 h-3 bg-sky-400 rounded-full shadow-[0_0_10px_#38bdf8]"></div>', className: '', iconSize: [12, 12], iconAnchor: [6, 6] })
    }).addTo(map);
};

if (socket) {
    socket.on('telemetry_data', (csv) => {
        fullLog.push(csv);
        const p = csv.split(',');
        if (p.length >= 15) {
            const d = {
                team: p[0], time: parseInt(p[1]) || 0, pkt: parseInt(p[2]) || 0,
                alt: parseFloat(p[3]) || 0, press: parseFloat(p[4]) || 0, temp: parseFloat(p[5]) || 0,
                volt: parseFloat(p[6]) || 0, gtime: p[7], lat: parseFloat(p[8]) || 0, lng: parseFloat(p[9]) || 0,
                galt: parseFloat(p[10]) || 0, sats: parseInt(p[11]) || 0, state: p[14] || 'UNK'
            };

            const acc = p[12].split(';');
            const ax = parseFloat(acc[0]) || 0, ay = parseFloat(acc[1]) || 0, az = parseFloat(acc[2]) || 0;
            const gz = parseFloat(p[13]) || 0;

            let mx = 0, my = 0, mz = 0, gas = 0, aqi = 0, hum = 0;
            const opt = (p[15] || "").split('|');
            if (opt.length >= 4) {
                const mag = opt[0].split(';');
                mx = parseFloat(mag[0]) || 0; my = parseFloat(mag[1]) || 0; mz = parseFloat(mag[2]) || 0;
                gas = parseFloat(opt[1]) || 0; aqi = parseFloat(opt[2]) || 0; hum = parseFloat(opt[3]) || 0;
            }

            let vel = lastTime > 0 ? (d.alt - prevAlt) / (d.time - lastTime) : 0;
            prevAlt = d.alt; lastTime = d.time;

            const sec = d.time % 60, min = Math.floor(d.time / 60) % 60, hr = Math.floor(d.time / 3600);
            const fTime = `${hr.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;

            document.getElementById('val-team').innerText = d.team;
            document.getElementById('val-alt').innerText = d.alt.toFixed(1);
            document.getElementById('val-state').innerText = d.state;
            document.getElementById('val-time').innerText = fTime;
            document.getElementById('val-pkt').innerText = d.pkt;
            document.getElementById('val-press').innerText = Math.round(d.press) + " Pa";
            document.getElementById('val-temp').innerText = d.temp.toFixed(1) + " °C";
            document.getElementById('val-volt').innerText = d.volt.toFixed(2) + " V";
            document.getElementById('val-vel').innerText = vel.toFixed(1) + " m/s";
            document.getElementById('val-gyro').innerText = gz.toFixed(1) + " °/s";
            document.getElementById('val-ax').innerText = ax.toFixed(2);
            document.getElementById('val-ay').innerText = ay.toFixed(2);
            document.getElementById('val-az').innerText = az.toFixed(2);
            document.getElementById('val-mx').innerText = mx.toFixed(1);
            document.getElementById('val-my').innerText = my.toFixed(1);
            document.getElementById('val-mz').innerText = mz.toFixed(1);
            document.getElementById('val-lat').innerText = d.lat.toFixed(5);
            document.getElementById('val-lng').innerText = d.lng.toFixed(5);
            document.getElementById('val-galt').innerText = d.galt.toFixed(1) + " m";
            document.getElementById('val-gtime').innerText = d.gtime;
            document.getElementById('val-sats').innerText = d.sats + " Sats";
            document.getElementById('val-aqi').innerText = aqi;
            document.getElementById('val-hum').innerText = hum.toFixed(1) + "%";
            document.getElementById('val-gas').innerText = gas + " Ω";

            if (cansatModel) {
                const pitch = Math.atan2(ay, Math.sqrt(ax * ax + az * az));
                const roll = Math.atan2(-ax, az);
                cansatModel.rotation.x += (pitch - cansatModel.rotation.x) * 0.1;
                cansatModel.rotation.z += (roll - cansatModel.rotation.z) * 0.1;
                cansatModel.rotation.y = gz * (Math.PI / 180);
                document.getElementById('att-pitch').innerText = (cansatModel.rotation.x * 180 / Math.PI).toFixed(1) + '°';
                document.getElementById('att-roll').innerText = (cansatModel.rotation.z * 180 / Math.PI).toFixed(1) + '°';
            }

            if (cAlt) {
                const l = d.time;
                cAlt.data.labels.push(l); cAlt.data.datasets[0].data.push(d.alt);
                cEnv.data.labels.push(l); cEnv.data.datasets[0].data.push(d.press); cEnv.data.datasets[1].data.push(d.temp);
                cAcc.data.labels.push(l); cAcc.data.datasets[0].data.push(az);
                cGyr.data.labels.push(l); cGyr.data.datasets[0].data.push(gz);
                [cAlt, cEnv, cAcc, cGyr].forEach(c => {
                    if (c.data.labels.length > 40) { c.data.labels.shift(); c.data.datasets.forEach(s => s.data.shift()); }
                    c.update('none');
                });
            }

            if (map && marker && d.lat !== 0) {
                const ll = new L.LatLng(d.lat, d.lng);
                marker.setLatLng(ll);
                if (d.pkt === 1 || d.pkt % 10 === 0) map.setView(ll, 16);
            }

            const tb = document.getElementById('table-body');
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="p-3 text-sky-400">${d.pkt}</td><td class="p-3">${d.time}</td><td class="p-3">${d.alt.toFixed(1)}</td><td class="p-3">${d.state}</td><td class="p-3">${d.sats}</td>`;
            tb.prepend(tr);
            if (tb.children.length > 40) tb.lastChild.remove();
        }
    });

    socket.on('command_echo', msg => logTerm(msg, msg.includes("ERR") ? 'err' : 'sys'));
}

function logTerm(m, t = 'info') {
    const el = document.getElementById('terminal-output');
    const d = document.createElement('div');
    d.className = t === 'tx' ? 'text-white' : t === 'sys' ? 'text-amber-400' : t === 'err' ? 'text-red-400' : 'text-slate-500';
    d.innerText = `[${new Date().toISOString().split('T')[1].slice(0, -1)}] ${m}`;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
}

function sendCommand(c) { logTerm(`TX > ${c}`, 'tx'); if (socket) socket.emit('uplink_command', c); }
function sendCustomCommand() { const i = document.getElementById('cmd-input'); if (i.value.trim()) { sendCommand(i.value.trim()); i.value = ''; } }

function downloadCSV() {
    if (!fullLog.length) return;
    const a = document.createElement("a");
    a.href = encodeURI("data:text/csv;charset=utf-8,TEAM_ID,TIME,PKT,ALT,PRESS,TEMP,VOLT,GTIME,LAT,LNG,GALT,SATS,ACC,GYRO,STATE,OPT\n" + fullLog.join("\n"));
    a.download = "VASU_LOG.csv";
    a.click();
}