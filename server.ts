/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { dbService } from './server-db';
import { Device, DeviceType, DeviceStatus } from './src/types';

async function startServer() {
  const app = express();
  app.use(express.json());

  const PORT = 3000;

  // --- API ROUTES FIRST ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // GET All Devices
  app.get('/api/devices', async (req, res) => {
    try {
      const devices = await dbService.getDevices();
      res.json(devices);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch devices', details: err.message });
    }
  });

  // GET Single Device
  app.get('/api/devices/:id', async (req, res) => {
    try {
      const device = await dbService.getDeviceById(req.params.id);
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }
      res.json(device);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch device', details: err.message });
    }
  });

  // POST Create Device
  app.post('/api/devices', async (req, res) => {
    try {
      const { name, ip_address, type, description } = req.body;
      if (!name || !ip_address || !type) {
        return res.status(400).json({ error: 'Name, IP/Host and Type are required fields.' });
      }
      const device = await dbService.saveDevice({
        name,
        ip_address,
        type,
        description: description || '',
        status: 'online',
        latency: 10 + Math.floor(Math.random() * 20),
        last_check: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
      
      // Seed an initial ping log
      await dbService.addPingLog(device.id, device.latency, device.status);

      res.status(201).json(device);
    } catch (err: any) {
      res.status(400).json({ error: 'Failed to create device', details: err.message });
    }
  });

  // PUT Update Device
  app.put('/api/devices/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, ip_address, type, description, status, latency } = req.body;
      
      const existing = await dbService.getDeviceById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Device not found' });
      }

      const updated = await dbService.saveDevice({
        ...existing,
        name: name !== undefined ? name : existing.name,
        ip_address: ip_address !== undefined ? ip_address : existing.ip_address,
        type: type !== undefined ? type : existing.type,
        description: description !== undefined ? description : existing.description,
        status: status !== undefined ? status : existing.status,
        latency: latency !== undefined ? latency : existing.latency,
        last_check: new Date().toISOString()
      });

      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: 'Failed to update device', details: err.message });
    }
  });

  // DELETE Device
  app.delete('/api/devices/:id', async (req, res) => {
    try {
      const success = await dbService.deleteDevice(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Device not found or failed to delete' });
      }
      res.json({ success: true, message: 'Device deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete device', details: err.message });
    }
  });

  // GET Device Logs for historic charts
  app.get('/api/devices/:id/logs', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await dbService.getPingLogs(req.params.id, limit);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch ping history logs', details: err.message });
    }
  });

  // POST Trigger Single Ping Simulation in real-time
  // Excellent for making the interactive Ping Modal perfectly dynamic!
  app.post('/api/devices/:id/ping', async (req, res) => {
    try {
      const { id } = req.params;
      const device = await dbService.getDeviceById(id);
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      // Generate simulated ping metrics based on host characteristics
      let latencyValue = 0;
      let statusValue: DeviceStatus = 'online';

      // Custom simulation based on device name/type
      const failureOdds = device.type === 'link' ? 0.03 : device.type === 'server' ? 0.08 : 0.02;
      const isFailed = Math.random() < failureOdds;
      const isSpike = Math.random() < 0.08; // 8% chance of temporary latency queue congestion

      if (isFailed) {
        statusValue = 'offline';
        latencyValue = 0;
      } else {
        statusValue = 'online';
        const baseLatency = 
          device.type === 'mikrotik' ? 8 :
          device.type === 'router' ? 12 :
          device.type === 'switch' ? 1 : 
          device.type === 'link' ? 16 : 30;
          
        if (isSpike) {
          // Spike simulation (exceeds high threshold)
          latencyValue = Math.round(410 + Math.random() * 200);
        } else {
          latencyValue = Math.round(baseLatency + Math.random() * 12);
        }
      }

      // Write result to local logs
      const newLog = await dbService.addPingLog(id, latencyValue, statusValue);
      
      // Update device state
      await dbService.updateDeviceStatus(id, statusValue, latencyValue);

      res.json({
        success: true,
        log: newLog,
        deviceStatus: statusValue,
        latency: latencyValue
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Ping execution failed', details: err.message });
    }
  });

  // POST Reset/Seed DB action
  app.post('/api/reset', async (req, res) => {
    try {
      await dbService.resetToSeed();
      const devices = await dbService.getDevices();
      res.json({ success: true, message: 'Database reset to default seeds', devices });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to reset database', details: err.message });
    }
  });


  // --- BACKGROUND NETWORK MONITORING SYSTEM ---
  // Periodically polls all devices and updates their parameters (status, latency, timestamps)
  // Automatically creates historic logs.
  const MONITOR_INTERVAL_MS = 12000; // Poll every 12 seconds
  
  setInterval(async () => {
    try {
      const devices = await dbService.getDevices();
      if (devices.length === 0) return;

      console.log(`📡 MProded background daemon: polling ${devices.length} network targets...`);
      
      for (const dev of devices) {
        let latency = 0;
        let status: 'online' | 'offline' = 'online';

        // 1. Failure simulation mechanics
        let offlineThresholdCheck = 0.03; // 3% default packet loss drop rate
        if (dev.id === 'dev-5') {
          // Keep our Database Cluster host occasionally failing or recovering to show states
          const hourMin = new Date().getMinutes();
          offlineThresholdCheck = hourMin % 20 < 6 ? 0.90 : 0.05; // Offline 6 mins out of 20
        }

        const isDown = Math.random() < offlineThresholdCheck;

        if (isDown) {
          status = 'offline';
          latency = 0;
        } else {
          status = 'online';
          // 2. Base latency profiles by device category
          const base = 
            dev.type === 'switch' ? 1 :
            dev.type === 'mikrotik' ? 5 :
            dev.type === 'router' ? 14 :
            dev.type === 'link' ? 18 : 32;

          // 3. High latency spike simulation (>400ms occasionally)
          const spikeThresholdCheck = 0.05; // 5% chance of link congestion queue delay
          if (Math.random() < spikeThresholdCheck) {
            latency = Math.round(415 + Math.random() * 180); // Mark high latencyAbove 400ms!
          } else {
            latency = Math.round(base + Math.random() * 8);
          }
        }

        // Update database for device state
        await dbService.updateDeviceStatus(dev.id, status, latency);
        
        // Log history entry
        await dbService.addPingLog(dev.id, latency, status);
      }
    } catch (err: any) {
      console.error('⚠️ Monitor loop error:', err.message);
    }
  }, MONITOR_INTERVAL_MS);


  // --- VITE DEV MIDDLEWARE / STATIC FILES MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ MProded Server running at http://0.0.0.0:${PORT}`);
    console.log(`⏱️ Background network ping simulation active on ${MONITOR_INTERVAL_MS}ms interval loop.`);
  });
}

startServer();
