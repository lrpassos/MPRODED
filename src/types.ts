/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DeviceType = 'router' | 'switch' | 'mikrotik' | 'server' | 'link';

export type DeviceStatus = 'online' | 'offline';

export interface Device {
  id: string;
  name: string;
  ip_address: string; // Host or IP
  type: DeviceType;
  description: string;
  status: DeviceStatus;
  latency: number; // in ms
  last_check: string; // ISO String
  created_at: string; // ISO String
}

export interface PingLog {
  id: string;
  device_id: string;
  latency: number;
  status: DeviceStatus;
  timestamp: string; // ISO String
}

export interface DashboardStats {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  highLatencyAlerts: number;
}
