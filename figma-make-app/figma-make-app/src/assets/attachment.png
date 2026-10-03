Design a modern desktop application UI for a college-level "STM32 Drone Data Logger and Flight Monitoring System".

The application communicates with a drone electronics system using this data flow:

MPU6050 IMU → ESP32 → Laptop Application → STM32 Flight Controller → Laptop Application

The application should be designed primarily for a Windows laptop and should look like a professional engineering/drone telemetry dashboard while remaining simple enough for a student project.

PROJECT PURPOSE:
The software receives sensor data from an ESP32, displays and records the data, sends required control/configuration signals from the laptop to the STM32, and receives feedback/telemetry from the STM32. The software should act as a real-time drone monitoring and data-logging station.

CREATE THESE MAIN SCREENS:

1. DASHBOARD / LIVE FLIGHT MONITOR

Create a main dashboard containing:

- Connection status
- ESP32 connection indicator
- STM32 connection indicator
- MPU6050 sensor status
- Data logging status
- Battery voltage
- Flight time
- Communication latency
- Packet count
- Packet loss percentage

Display real-time IMU data:

Accelerometer:
- X acceleration
- Y acceleration
- Z acceleration

Gyroscope:
- X angular velocity
- Y angular velocity
- Z angular velocity

Optional calculated values:
- Roll
- Pitch
- Yaw

Use live numerical cards and scrolling real-time graphs.

Add a simple artificial-horizon style visualization showing:
- Roll
- Pitch
- Drone orientation

2. REAL-TIME SENSOR GRAPHS

Create a dedicated "Sensor Graphs" page.

Include selectable graphs for:

- Accelerometer X/Y/Z
- Gyroscope X/Y/Z
- Roll/Pitch/Yaw
- Battery voltage
- Communication latency

Allow the user to:
- Start graphing
- Pause graphing
- Clear graph
- Zoom into graph
- Select time range
- Select individual sensor channels

Use a clean engineering dashboard style with grid-based graphs and clearly labeled axes.

3. DATA LOGGER PAGE

Create a "Data Logger" screen.

Include:

- Start Logging button
- Stop Logging button
- Pause Logging button
- Recording duration
- Number of samples
- Sampling frequency
- File size
- Current log filename
- Storage location

Allow data export in:

- CSV
- JSON
- TXT

Show a table of recorded samples with columns:

Timestamp
Accelerometer X
Accelerometer Y
Accelerometer Z
Gyroscope X
Gyroscope Y
Gyroscope Z
Roll
Pitch
Yaw
Battery Voltage
ESP32 Status
STM32 Status

Add a "Download Log" button and "Open Log Folder" button.

4. COMMUNICATION / SYSTEM STATUS PAGE

Create a communication monitoring screen showing the complete system data path:

MPU6050
↓
ESP32
↓
LAPTOP
↓
STM32
↓
LAPTOP

Represent each device as a card with:

- Device name
- Connection status
- IP/COM port
- Baud rate where applicable
- Packet rate
- Last received packet
- Error count
- Latency

Use animated connection lines to visually indicate active communication.

Show separate sections for:

ESP32 → Laptop

Laptop → STM32

STM32 → Laptop

5. STM32 CONTROL PAGE

Create a "Flight Controller / STM32" page.

Include:

- STM32 connection status
- COM port selector
- Baud rate selector
- Connect button
- Disconnect button
- Send command button

Create a command console showing:

Timestamp
Direction
Command
Response
Status

Provide controls for sending safe test commands/configuration commands to the STM32.

Include a clear warning that actual motor/flight commands should only be enabled during controlled testing.

6. MPU6050 SENSOR PAGE

Create a dedicated sensor page showing:

- MPU6050 connection status
- Accelerometer values
- Gyroscope values
- Sensor update rate
- I2C status
- Calibration status

Add a "Calibrate Sensor" button.

Show a small 3D-style drone orientation visualization based on Roll, Pitch and Yaw.

7. FLIGHT SESSION PAGE

Create a page for managing flight-test sessions.

Allow the user to enter:

- Flight test name
- Date
- Drone ID
- Test description
- Operator name

Show:

- Start Flight Session
- Stop Flight Session
- Session duration
- Maximum roll
- Maximum pitch
- Maximum yaw rate
- Maximum acceleration
- Minimum battery voltage
- Number of recorded samples

Allow the complete session to be saved as a log.

8. DATA ANALYSIS PAGE

Create a post-flight analysis dashboard.

Allow the user to load a previously recorded CSV/JSON log.

Display:

- Accelerometer graphs
- Gyroscope graphs
- Orientation graphs
- Battery graph
- Communication latency
- Packet loss

Provide summary statistics:

Maximum value
Minimum value
Average value
Peak value
Number of samples

Add a timeline slider so the user can move through the flight recording.

9. SYSTEM SETTINGS PAGE

Create settings for:

- ESP32 COM port
- STM32 COM port
- Baud rate
- Sampling frequency
- IMU update rate
- Data logging frequency
- Data storage location
- Graph update rate

Include "Save Settings" and "Reset Settings" buttons.

10. HOME / PROJECT OVERVIEW

Create a clean landing page showing:

"DRONE DATA LOGGER"

Subtitle:
"STM32 + ESP32 + MPU6050 Flight Monitoring System"

Show a visual architecture diagram:

MPU6050 → ESP32 → LAPTOP → STM32 → LAPTOP

Include buttons:

"Live Dashboard"
"Start Data Logging"
"Sensor Data"
"Flight Sessions"
"Data Analysis"
"System Settings"

DESIGN STYLE:

Use a professional engineering/drone-control dashboard aesthetic.

Use:
- Dark desktop interface
- Clear typography
- Card-based layout
- Technical dashboard elements
- Real-time graph components
- Status indicators
- Minimal animations
- High readability
- Responsive desktop layout

Use a consistent color system:
- Green = Connected / Normal
- Red = Error / Disconnected
- Yellow = Warning
- Blue = Data transmission
- Gray = Inactive

Do not make the UI look like a gaming interface. It should look like an engineering research/data-logging application.

IMPORTANT FUNCTIONAL CONCEPT:

The application should clearly distinguish between:

1. SENSOR INPUT:
MPU6050 → ESP32 → Laptop

2. CONTROL / COMMUNICATION:
Laptop → STM32

3. FEEDBACK / TELEMETRY:
STM32 → Laptop

4. DATA STORAGE:
Laptop → Flight Log

The UI should make this data flow visually understandable to a college project evaluator.

Add a persistent top navigation bar containing:

Dashboard | Sensors | Graphs | Data Logger | STM32 | Flight Session | Analysis | Settings

Add a persistent bottom status bar showing:

ESP32: CONNECTED
STM32: CONNECTED
MPU6050: ACTIVE
Logging: OFF
Packets: 0
Latency: -- ms

Create realistic sample sensor values and graph data for the prototype so that the UI looks functional even before the actual hardware is connected.

Make the design suitable for a final-year/college engineering project demonstration and presentation.