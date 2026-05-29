/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { Device, PingLog } from './src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Seed data
const SEED_DEVICES: Device[] = [
  {
    id: 'dev-1',
    name: 'MikroTik Core CCR2004',
    ip_address: '192.168.88.1',
    type: 'mikrotik',
    description: 'Main core router for the corporate HQ.',
    status: 'online',
    latency: 12,
    last_check: new Date().toISOString(),
    created_at: new Date().toISOString()
  },
  {
    id: 'dev-2',
    name: 'Cisco Core Switch Catalyst',
    ip_address: '10.0.10.2',
    type: 'switch',
    description: 'Central building-floor distribution switch.',
    status: 'online',
    latency: 2,
    last_check: new Date().toISOString(),
    created_at: new Date().toISOString()
  },
  {
    id: 'dev-3',
    name: 'Dedicated Fiber Internet Link',
    ip_address: '200.150.44.12',
    type: 'link',
    description: 'Primary corporate WAN dedicated fiber line (ISP).',
    status: 'online',
    latency: 15,
    last_check: new Date().toISOString(),
    created_at: new Date().toISOString()
  },
  {
    id: 'dev-4',
    name: 'VPC Router VPS Cloud',
    ip_address: 'router.mproded.net',
    type: 'router',
    description: 'WireGuard/VPN gateway on Google Cloud Platform.',
    status: 'online',
    latency: 45,
    last_check: new Date().toISOString(),
    created_at: new Date().toISOString()
  },
  {
    id: 'dev-5',
    name: 'Database Cluster Primaries',
    ip_address: 'db-cluster-01.local',
    type: 'server',
    description: 'Replica group PostgreSQL servers for MPRODED system.',
    status: 'offline',
    latency: 0,
    last_check: new Date().toISOString(),
    created_at: new Date().toISOString()
  }
];

// Seed initial ping logs to make history immediately beautiful
const generateSeedLogs = (devices: Device[]): PingLog[] => {
  const logs: PingLog[] = [];
  const now = new Date();
  
  // Create 20 historical logs for each device spanning the last hour
  devices.forEach(dev => {
    for (let i = 20; i >= 0; i--) {
      const logTime = new Date(now.getTime() - i * 3 * 60 * 1000); // every 3 mins
      
      let lat = 0;
      let stat: 'online' | 'offline' = 'online';
      
      if (dev.id === 'dev-5') {
        // mostly offline or problematic
        stat = i < 15 ? 'offline' : 'online';
        lat = stat === 'online' ? 350 + Math.random() * 80 : 0;
      } else {
        stat = 'online';
        const base = dev.id === 'dev-1' ? 10 : dev.id === 'dev-2' ? 2 : dev.id === 'dev-3' ? 14 : 42;
        // occasionally generate spikes
        const spiked = (i % 7 === 0);
        lat = base + (Math.random() * 8) + (spiked ? 380 + Math.random() * 40 : 0);
      }

      logs.push({
        id: `log-${dev.id}-${i}-${logTime.getTime()}`,
        device_id: dev.id,
        latency: Math.round(lat),
        status: stat,
        timestamp: logTime.toISOString()
      });
    }
  });

  return logs;
};

// Local storage init structure
interface LocalDB {
  devices: Device[];
  ping_logs: PingLog[];
}

let supabase: any = null;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

function checkAndDisableSupabaseIfInvalid(error: any) {
  if (error && supabase) {
    const msg = error.message || '';
    if (
      msg.includes('Invalid API key') || 
      msg.includes('JWT') || 
      msg.includes('api_key') || 
      msg.includes('API key') ||
      msg.includes('unauthorized') || 
      msg.includes('401') ||
      msg.includes('Invalid key') ||
      msg.includes('service_role')
    ) {
      console.warn(`⚙️ Supabase credentials check failed: "${msg}". Automatically disabling Supabase database integration to rely entirely on local storage fallback.`);
      supabase = null;
    }
  }
}

if (supabaseUrl && supabaseKey && supabaseUrl !== 'https://your-project.supabase.co') {
  try {
    // Attempt schema configuration to target "MProded" schema
    supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'MProded' }
    });
    console.log('🔌 Supabase initialized with schema "MProded". Checking tables...');
    
    // Quick validation check on targets
    supabase.from('devices').select('id').limit(1).then(({ error }: any) => {
      if (error) {
        // If schema MProded doesn't exist or is invalid, try public fallback
        console.warn(`⚠️ Error querying "MProded" schema tables. Attempting default public schema fallback... Error info:`, error.message);
        
        supabase = createClient(supabaseUrl, supabaseKey);
        supabase.from('devices').select('id').limit(1).then(({ error: pubError }: any) => {
          if (pubError) {
            checkAndDisableSupabaseIfInvalid(pubError);
          } else {
            console.log('✅ Supabase verified successfully on public schema fallback.');
          }
        });
      } else {
        console.log('✅ Supabase credentials verified successfully on "MProded" schema.');
      }
    });
  } catch (error) {
    console.error('⚠️ Supabase connection error:', error);
  }
} else {
  console.log('📂 No valid Supabase credentials found. Falling back to local file database `/data/db.json`.');
}

// Helpers for Local Storage fallback
function readLocalDB(): LocalDB {
  if (!fs.existsSync(DB_FILE)) {
    const defaultData: LocalDB = {
      devices: SEED_DEVICES,
      ping_logs: generateSeedLogs(SEED_DEVICES)
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
    return defaultData;
  }
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    if (!parsed.devices || !parsed.ping_logs) {
      throw new Error('Malformed database schema');
    }
    return parsed;
  } catch (e) {
    console.error('⚠️ Local DB file read failed, resetting with default seed data:', e);
    const defaultData: LocalDB = {
      devices: SEED_DEVICES,
      ping_logs: generateSeedLogs(SEED_DEVICES)
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
    return defaultData;
  }
}

function writeLocalDB(data: LocalDB) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// --- DATABASE SERVICE EXPORT ---
export const dbService = {
  // Reset database (for dev troubleshooting)
  async resetToSeed(): Promise<void> {
    if (supabase) {
      try {
        console.log('🔄 Seeding Supabase database with core network devices...');
        // delete existing entries to prevent key conflicts
        await supabase.from('ping_logs').delete().neq('id', '0');
        await supabase.from('devices').delete().neq('id', '0');
        
        await supabase.from('devices').insert(SEED_DEVICES);
        await supabase.from('ping_logs').insert(generateSeedLogs(SEED_DEVICES));
        return;
      } catch (err) {
        console.warn('⚠️ Supabase seeding query failed, standardizing to local db storage fallback. Error detail:');
      }
    }
    // file db fallback
    const defaultData: LocalDB = {
      devices: SEED_DEVICES,
      ping_logs: generateSeedLogs(SEED_DEVICES)
    };
    writeLocalDB(defaultData);
  },

  // GET Devices
  async getDevices(): Promise<Device[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('devices')
          .select('*')
          .order('name', { ascending: true });
        
        if (!error && data) {
          return data as Device[];
        }
        if (error) {
          checkAndDisableSupabaseIfInvalid(error);
          console.warn('⚠️ Supabase getDevices error, using local fallback:', error.message);
        }
      } catch (err) {
        // silent fallback to local
      }
    }
    const local = readLocalDB();
    return local.devices;
  },

  // GET Specific Device
  async getDeviceById(id: string): Promise<Device | null> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('devices')
          .select('*')
          .eq('id', id)
          .single();
        if (!error && data) return data as Device;
      } catch (err) {
        // silent fallback
      }
    }
    const local = readLocalDB();
    return local.devices.find(d => d.id === id) || null;
  },

  // Save/Update Device
  async saveDevice(device: Partial<Device> & { name: string; ip_address: string; type: any }): Promise<Device> {
    const isNew = !device.id;
    const finalDevice: Device = {
      id: device.id || `dev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: device.name,
      ip_address: device.ip_address,
      type: device.type,
      description: device.description || '',
      status: device.status || 'online',
      latency: device.latency !== undefined ? device.latency : 0,
      last_check: device.last_check || new Date().toISOString(),
      created_at: device.created_at || new Date().toISOString()
    };

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('devices')
          .upsert(finalDevice)
          .select()
          .single();
        if (!error && data) {
          return data as Device;
        }
        console.warn('⚠️ Supabase upsert failed, switching to local DB:', error?.message);
      } catch (err) {
        // silent fallback
      }
    }

    // fallback write
    const local = readLocalDB();
    if (isNew) {
      local.devices.push(finalDevice);
    } else {
      const idx = local.devices.findIndex(d => d.id === finalDevice.id);
      if (idx !== -1) {
        local.devices[idx] = finalDevice;
      } else {
        local.devices.push(finalDevice);
      }
    }
    writeLocalDB(local);
    return finalDevice;
  },

  // Update Status / Latency specifically
  async updateDeviceStatus(id: string, status: 'online' | 'offline', latency: number): Promise<Device | null> {
    const lastCheck = new Date().toISOString();
    
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('devices')
          .update({ status, latency, last_check: lastCheck })
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return data as Device;
      } catch (err) {
        // silent fallback
      }
    }

    const local = readLocalDB();
    const idx = local.devices.findIndex(d => d.id === id);
    if (idx !== -1) {
      local.devices[idx].status = status;
      local.devices[idx].latency = latency;
      local.devices[idx].last_check = lastCheck;
      writeLocalDB(local);
      return local.devices[idx];
    }
    return null;
  },

  // Delete Device
  async deleteDevice(id: string): Promise<boolean> {
    if (supabase) {
      try {
        // Delete logs first representing relationships
        await supabase.from('ping_logs').delete().eq('device_id', id);
        const { error } = await supabase.from('devices').delete().eq('id', id);
        if (!error) return true;
        console.warn('⚠️ Supabase delete error:', error.message);
      } catch (err) {
        // silent fallback
      }
    }

    const local = readLocalDB();
    const originalLen = local.devices.length;
    local.devices = local.devices.filter(d => d.id !== id);
    local.ping_logs = local.ping_logs.filter(l => l.device_id !== id);
    
    if (local.devices.length !== originalLen) {
      writeLocalDB(local);
      return true;
    }
    return false;
  },

  // GET Ping Logs
  async getPingLogs(deviceId?: string, limit: number = 50): Promise<PingLog[]> {
    if (supabase) {
      try {
        let query = supabase.from('ping_logs').select('*');
        if (deviceId) {
          query = query.eq('device_id', deviceId);
        }
        const { data, error } = await query
          .order('timestamp', { ascending: false })
          .limit(limit);
          
        if (!error && data) {
          // Return reversed to chronological order for recharts display
          return (data as PingLog[]).reverse();
        }
      } catch (err) {
        // silent fallback
      }
    }

    const local = readLocalDB();
    let logs = local.ping_logs;
    if (deviceId) {
      logs = logs.filter(l => l.device_id === deviceId);
    }
    
    // Grab the last limit results from the local database
    const sliced = logs.slice(-limit);
    return sliced;
  },

  // Add a Ping Log
  async addPingLog(deviceId: string, latency: number, status: 'online' | 'offline'): Promise<PingLog> {
    const rawLog: PingLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      device_id: deviceId,
      latency,
      status,
      timestamp: new Date().toISOString()
    };

    if (supabase) {
      try {
        const { data, error } = await supabase.from('ping_logs').insert(rawLog).select().single();
        if (!error && data) return data as PingLog;
      } catch (err) {
        // silent fallback
      }
    }

    const local = readLocalDB();
    local.ping_logs.push(rawLog);
    
    // Prune logs cleanly to keep file light: keep last 100 logs per device
    const deviceLogsCount = local.ping_logs.filter(l => l.device_id === deviceId).length;
    if (deviceLogsCount > 100) {
      let removeCount = deviceLogsCount - 100;
      // remove oldest logs for this specific device
      local.ping_logs = local.ping_logs.filter(l => {
        if (l.device_id === deviceId && removeCount > 0) {
          removeCount--;
          return false;
        }
        return true;
      });
    }

    writeLocalDB(local);
    return rawLog;
  }
};

// Seed database on launch if empty
dbService.getDevices().then(devices => {
  if (devices.length === 0) {
    dbService.resetToSeed();
  }
});
