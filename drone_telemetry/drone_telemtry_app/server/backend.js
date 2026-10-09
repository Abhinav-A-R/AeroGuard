import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dgram from 'dgram';

const HTTP_PORT = process.env.PORT || 5000;
const WS_PORT = process.env.WS_PORT || 5001;

const app = express();
app.use(express.json({ limit: '1mb' }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Latest Telemetry Buffer State
let latestTelemetry = null;
let lastPacketTime = 0;
let packetCount = 0;
let isEsp32Connected = false;
let testScenario = 'NORMAL';

// WebSocket Server initialization on PORT 5001
const server = http.createServer(app);
const wss = new WebSocketServer({ port: WS_PORT });

console.log(`[AeroGuard Backend] WebSocket Server listening on port ${WS_PORT}`);

// Broadcast telemetry to all connected browser clients
function broadcastToClients(data) {
  const jsonStr = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonStr);
    }
  });
}

// Telemetry Validator (Requirement 8 & 24 - prevents malformed payload crashes)
function validateTelemetryPayload(body) {
  if (!body || typeof body !== 'object') return null;

  let ax = typeof body.ax === 'number' && !isNaN(body.ax) ? body.ax : 0;
  let ay = typeof body.ay === 'number' && !isNaN(body.ay) ? body.ay : 0;
  let az = typeof body.az === 'number' && !isNaN(body.az) ? body.az : 9.81;

  // Auto-detect if accelerometer is in 'g' (e.g. az ~ 1.0) vs m/s^2 (e.g. az ~ 9.81)
  const accelMag = Math.sqrt(ax * ax + ay * ay + az * az);
  const rawAx = ax;
  const rawAy = ay;
  const rawAz = az;

  if (accelMag > 0.3 && accelMag < 3.5) {
    // Convert g to m/s^2
    ax = +(ax * 9.81).toFixed(3);
    ay = +(ay * 9.81).toFixed(3);
    az = +(az * 9.81).toFixed(3);
  }

  // Auto-calculate Roll and Pitch from Accelerometer if not explicitly provided
  const computedRoll = +(Math.atan2(rawAy, rawAz) * (180.0 / Math.PI)).toFixed(2);
  const computedPitch = +(Math.atan2(-rawAx, Math.sqrt(rawAy * rawAy + rawAz * rawAz)) * (180.0 / Math.PI)).toFixed(2);

  return {
    timestamp: typeof body.timestamp === 'number' ? body.timestamp : Date.now() / 1000,
    roll: typeof body.roll === 'number' && !isNaN(body.roll) ? body.roll : computedRoll,
    pitch: typeof body.pitch === 'number' && !isNaN(body.pitch) ? body.pitch : computedPitch,
    yaw: typeof body.yaw === 'number' && !isNaN(body.yaw) ? body.yaw : 0,
    ax,
    ay,
    az,
    gx: typeof body.gx === 'number' && !isNaN(body.gx) ? body.gx : 0,
    gy: typeof body.gy === 'number' && !isNaN(body.gy) ? body.gy : 0,
    gz: typeof body.gz === 'number' && !isNaN(body.gz) ? body.gz : 0,
    temperature: typeof body.temperature === 'number' && !isNaN(body.temperature) ? body.temperature : 25.0,
    pressure: typeof body.pressure === 'number' && !isNaN(body.pressure) ? body.pressure : 1013.25,
    altitude: typeof body.altitude === 'number' && !isNaN(body.altitude) ? body.altitude : 0,
    battery: typeof body.battery === 'number' && !isNaN(body.battery) ? body.battery : 11.4,
  };
}

// Process incoming telemetry packet from ESP32
function handleIncomingTelemetry(rawBody, source = 'HTTP') {
  const validated = validateTelemetryPayload(rawBody);
  if (!validated) {
    console.warn(`[AeroGuard Backend] Rejected malformed telemetry packet from ${source}`);
    return false;
  }

  const now = Date.now();
  lastPacketTime = now;
  packetCount++;
  const wasConnected = isEsp32Connected;
  isEsp32Connected = true;

  if (!wasConnected) {
    broadcastToClients({
      type: 'STATUS_UPDATE',
      esp32Connected: true,
      message: 'ESP32 Telemetry Receiving',
    });
  }

  const packet = {
    type: 'TELEMETRY',
    serverTimestamp: now,
    source,
    telemetry: validated,
  };

  latestTelemetry = packet;
  broadcastToClients(packet);
  return true;
}

// REST API Endpoints on PORT 5000
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    httpPort: HTTP_PORT,
    wsPort: WS_PORT,
    esp32Connected: isEsp32Connected,
    totalPackets: packetCount,
    lastPacketMsAgo: lastPacketTime ? Date.now() - lastPacketTime : -1,
  });
});

// ESP32 HTTP POST Endpoint: http://[LAPTOP_IP]:5000/api/telemetry
app.post('/api/telemetry', (req, res) => {
  const success = handleIncomingTelemetry(req.body, 'HTTP_POST');
  if (success) {
    res.json({ status: 'ACK', packetCount });
  } else {
    res.status(400).json({ error: 'Malformed Telemetry Payload' });
  }
});

// Test Scenario Control Endpoint
app.post('/api/test-scenario', (req, res) => {
  const { scenario } = req.body;
  if (scenario) {
    testScenario = scenario;
    console.log(`[AeroGuard Backend] Active test scenario set to: ${scenario}`);
    broadcastToClients({ type: 'SCENARIO_CHANGE', scenario });
  }
  res.json({ status: 'OK', scenario: testScenario });
});

// UDP Listener on PORT 5000 (for high-rate binary/text socket from ESP32)
const udpSocket = dgram.createSocket('udp4');
udpSocket.on('message', (msg, rinfo) => {
  try {
    const json = JSON.parse(msg.toString('utf-8'));
    handleIncomingTelemetry(json, `UDP:${rinfo.address}:${rinfo.port}`);
  } catch (err) {
    console.warn(`[AeroGuard Backend] UDP parse error from ${rinfo.address}:`, err.message);
  }
});

udpSocket.on('error', (err) => {
  console.error('[AeroGuard Backend] UDP Socket error:', err.message);
});

udpSocket.bind(HTTP_PORT, () => {
  console.log(`[AeroGuard Backend] UDP Receiver bound to port ${HTTP_PORT}`);
});

// Check ESP32 Connection Disconnection Timeout (Requirement 8 & 23)
setInterval(() => {
  if (isEsp32Connected && Date.now() - lastPacketTime > 3000) {
    isEsp32Connected = false;
    console.warn('[AeroGuard Backend] ESP32 Telemetry Dropout / Disconnected');
    broadcastToClients({
      type: 'STATUS_UPDATE',
      esp32Connected: false,
      message: 'ESP32 Disconnected (No telemetry for >3s)',
    });
  }
}, 1000);

// Start Express HTTP Server on PORT 5000
app.listen(HTTP_PORT, () => {
  console.log(`[AeroGuard Backend] HTTP REST Server listening on http://localhost:${HTTP_PORT}`);
});
