const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const SIMULATION_MODE = true;
const SERIAL_PORT_PATH = 'COM6';
const BAUD_RATE = 115200;

const TEAM_ID = "2026-INSPACe-CAN-7USAT-020";
const CSV_FILENAME = `Flight_${TEAM_ID}.csv`;

const csvHeaders = "TEAM_ID,TIME_STAMPING,PACKET_COUNT,ALTITUDE,PRESSURE,TEMP,VOLTAGE,GNSS_TIME,GNSS_LATITUDE,GNSS_LONGITUDE,GNSS_ALTITUDE,GNSS_SATS,ACCELEROMETER_DATA,GYRO_SPIN_RATE,FLIGHT_SOFTWARE_STATE,OPTIONAL_DATA\n";

if (!fs.existsSync(CSV_FILENAME)) {
    fs.writeFileSync(CSV_FILENAME, csvHeaders);
    console.log(`[SYS] LOG CREATED: ${CSV_FILENAME}`);
}

let port;
let parser;

if (!SIMULATION_MODE) {
    try {
        port = new SerialPort({ path: SERIAL_PORT_PATH, baudRate: BAUD_RATE });
        parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

        port.on('open', () => console.log(`[SYS] LINK ESTABLISHED: ${SERIAL_PORT_PATH}`));
        port.on('error', (err) => console.error(`[ERR] PORT FAULT: ${err.message}`));

        parser.on('data', (data) => {
            const line = data.trim();
            console.log(`[RX] ${line}`);
            if (line.startsWith(TEAM_ID)) {
                processTelemetry(line);
            }
        });
    } catch (err) {
        console.error("[ERR] INIT FAULT:", err.message);
    }
} else {
    console.log(`[SYS] SIMULATION ACTIVE`);
    startSimulator();
}

function processTelemetry(csvString) {
    if (!csvString) return;
    fs.appendFile(CSV_FILENAME, csvString + '\r\n', (err) => {
        if (err) console.error('[ERR] LOG FAULT:', err);
    });
    io.emit('telemetry_data', csvString);
}

function startSimulator() {
    let packetCount = 0;
    let simAlt = 0;
    let simLat = 28.6139;
    let simLng = 77.2090;
    let phase = "PRE-FLIGHT";

    setInterval(() => {
        packetCount++;
        const timeSecs = Math.floor(Date.now() / 1000);

        if (packetCount > 10 && packetCount < 40) {
            simAlt += 25;
            phase = "ASCENT";
        } else if (packetCount >= 40 && simAlt > 0) {
            simAlt -= 8;
            phase = "DESCENT";
        } else if (simAlt <= 0 && packetCount > 40) {
            simAlt = 0;
            phase = "LANDED";
        }

        if (simAlt > 0) {
            simLat += 0.00005;
            simLng -= 0.00002;
        }

        const press = 101325 - (simAlt * 12);
        const temp = 35 - (simAlt * 0.0065);
        const ax = simAlt > 0 ? (Math.random() * 20 - 10) : 0;
        const ay = simAlt > 0 ? (Math.random() * 20 - 10) : 0;
        const az = phase === "ASCENT" ? 25.5 : (simAlt > 0 ? 9.81 + (Math.random() * 4 - 2) : 9.81);
        const spin = simAlt > 0 ? (Math.random() * 90) : 0;

        const simMagX = (Math.random() * 50 - 25).toFixed(1);
        const simMagY = (Math.random() * 50 - 25).toFixed(1);
        const simMagZ = (Math.random() * 50 - 25).toFixed(1);
        const simGas = Math.floor(Math.random() * 10000 + 40000);
        const simAqi = Math.floor(Math.random() * 50 + 20);
        const simHum = (Math.random() * 10 + 40).toFixed(1);

        const optionalData = `${simMagX};${simMagY};${simMagZ}|${simGas}|${simAqi}|${simHum}`;
        const csvString = `${TEAM_ID},${timeSecs},${packetCount},${simAlt.toFixed(1)},${press.toFixed(0)},${temp.toFixed(1)},8.20,12:00:00,${simLat.toFixed(5)},${simLng.toFixed(5)},${simAlt.toFixed(1)},8,${ax.toFixed(2)};${ay.toFixed(2)};${az.toFixed(2)},${spin.toFixed(1)},${phase},${optionalData}`;

        processTelemetry(csvString);
    }, 1000);
}

io.on('connection', (socket) => {
    socket.on('uplink_command', (cmd) => {
        if (SIMULATION_MODE) {
            setTimeout(() => socket.emit('command_echo', `[SIM] ACK: ${cmd}`), 300);
        } else if (port && port.isOpen) {
            port.write(cmd + '\r\n', (err) => {
                if (err) socket.emit('command_echo', `[ERR] TX FAULT`);
                else socket.emit('command_echo', `[TX] ${cmd}`);
            });
        } else {
            socket.emit('command_echo', `[ERR] NO LINK`);
        }
    });
});

let initialPort = process.env.PORT || 3000;

function startServer(port) {
    server.listen(port, () => {
        console.log(`[SYS] VASU-X ONLINE: http://localhost:${port}`);
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            startServer(port + 1);
        } else {
            console.error('[ERR] SERVER FAULT:', err);
        }
    });
}

startServer(initialPort);