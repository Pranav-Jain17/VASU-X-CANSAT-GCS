# VASU-X Ground Control Station (GCS)

**Target:** IN-SPACe CanSat Competition 2026
**Team ID:** 2026-INSPACe-CAN-7USAT-020

The VASU-X GCS is a high-performance, real-time telemetry dashboard designed for monitoring and commanding a CanSat payload. Built with a Node.js backend and a modern web-based frontend, it handles real-time data parsing, 3D attitude visualization, and command uplink over standard RF hardware.

## 🚀 Key Features

* **Tactical Split-Screen UI:** All 16 telemetry parameters remain visible at all times on the sidebar, while dynamic tools exist in the main view.
* **3D Attitude Theatre:** Real-time 3D rendering of the CanSat's pitch, roll, and yaw using `Three.js` and BNO055 IMU data.
* **Live Analytics:** Auto-scrolling graphs for Altitude, Environment (Temp/Pressure), Acceleration, and Spin Rate using `Chart.js`.
* **GNSS Tracking:** Live map plotting using `Leaflet.js` to track the IRNSS/NavIC coordinates of the CanSat.
* **Command & Log Terminal:** Send custom commands to the CanSat and view live raw packet streams.
* **Auto-Logging:** Automatically appends every valid telemetry packet to a local `Flight_2026-INSPACe-CAN-7USAT-020.csv` file.

## 🛠️ Tech Stack

* **Hardware:** Teensy 4.1, BMP388 (Barometer), BNO055 (IMU), NavIC/IRNSS BOB (GPS), Nicla Sense ME (Environment).
* **Backend:** Node.js, Express, Socket.io, SerialPort.
* **Frontend:** HTML5, Tailwind CSS, Three.js, Chart.js, Leaflet.js, Canvas Gauges.

## 📦 Installation & Setup

1. **Install Node.js:** Ensure you have Node.js (v18+) installed on your Ground Station laptop.
2. **Clone/Download:** Place the project files in a dedicated folder (e.g., `VASU_GCS`).
3. **Install Dependencies:** Open a terminal in the project folder and run:
npm install express socket.io serialport @serialport/parser-readline
4. **Configure COM Port:**
* Plug in your GCS receiver (Teensy or XBee via USB).
* Open Device Manager (Windows) or Arduino IDE to find the assigned COM port.
* Open `server.js` and update line 17: `const SERIAL_PORT_PATH = 'COM6';` (Replace COM6 with your port).



## 🚀 Running the GCS

### Option 1: Standard Terminal

1. Open terminal in the project folder.
2. Run `node server.js`
3. Open a web browser and navigate to `http://localhost:3000`

### Option 2: Windows Launch Script (Recommended for Flight Day)

1. Double-click the `start_gcs.bat` file.
2. This script will automatically boot the server in the background, wait 3 seconds, and launch the UI in your default browser.

## 📡 Telemetry Format (Annexure-2 Compliance)

The backend expects incoming Serial data at **115200 baud**, ending with a newline (`\n`).
It strictly filters for packets starting with the Team ID and containing exactly 16 comma-separated values:

1. `TEAM_ID` (String)
2. `TIME_STAMPING` (Seconds since boot)
3. `PACKET_COUNT` (Integer)
4. `ALTITUDE` (Float, Meters)
5. `PRESSURE` (Float, Pascals)
6. `TEMP` (Float, Celsius)
7. `VOLTAGE` (Float, Volts)
8. `GNSS_TIME` (HH:MM:SS)
9. `GNSS_LATITUDE` (Float)
10. `GNSS_LONGITUDE` (Float)
11. `GNSS_ALTITUDE` (Float, Meters)
12. `GNSS_SATS` (Integer)
13. `ACCELEROMETER_DATA` (String: "X;Y;Z")
14. `GYRO_SPIN_RATE` (Float, Deg/s)
15. `FLIGHT_SOFTWARE_STATE` (String)
16. `OPTIONAL_DATA` (String: "MagX;MagY;MagZ|Gas|AQI|Hum")

*Any packet not matching this structure or missing the Team ID will be rejected by the backend.*

## ⚠️ Troubleshooting

* **UI Shows all 0s:** Check the backend terminal. If the UI connects but shows zeros, the COM port is reading, but the packet format is failing validation or the Team ID is mismatched between the Teensy code and `server.js`.
* **Port Error / EADDRINUSE:** Make sure the Arduino IDE Serial Monitor is closed. Only one program can read the USB COM port at a time.
* **GPS Sats = 0:** The code is working, but the hardware needs a "Cold Start". Take the GPS module outside under an open sky and wait 10-15 minutes for a satellite lock.