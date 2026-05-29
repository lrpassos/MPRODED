/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Activity, 
  Server, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  History
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { Device, PingLog, DashboardStats } from '../types';

interface DashboardOverviewProps {
  devices: Device[];
  logs: PingLog[];
  stats: DashboardStats;
  onSelectDevice: (deviceId: string) => void;
}

export default function DashboardOverview({ 
  devices, 
  logs, 
  stats,
  onSelectDevice 
}: DashboardOverviewProps) {
  
  // Format log history for the aggregate telemetry monitor chart
  // Group logs by time or simply show the last 20 measurements
  const chartData = React.useMemo(() => {
    if (logs.length === 0) return [];
    
    // Group logs briefly by device or take last 15 aggregate checkpoints
    const lastLogs = [...logs].slice(-30);
    return lastLogs.map(log => {
      const dev = devices.find(d => d.id === log.device_id);
      return {
        time: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        latency: log.status === 'online' ? log.latency : 0,
        deviceName: dev ? dev.name : 'Unknown Target',
        status: log.status
      };
    });
  }, [logs, devices]);

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Devices */}
        <div className="relative overflow-hidden rounded-xl bg-slate-900/40 p-5 px-6 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Total Monitored</p>
              <h3 className="mt-2 text-3xl font-bold font-mono text-slate-100">{stats.totalDevices}</h3>
            </div>
            <div className="flex size-12 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Server className="size-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-slate-400">
            <span className="font-semibold text-indigo-400 font-mono">100%</span>
            <span className="ml-2">allocated slots</span>
          </div>
        </div>

        {/* Online Devices */}
        <div className="relative overflow-hidden rounded-xl bg-slate-900/40 p-5 px-6 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Active / Online</p>
              <h3 className="mt-2 text-3xl font-bold font-mono text-emerald-400">{stats.onlineDevices}</h3>
            </div>
            <div className="flex size-12 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle className="size-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-slate-400">
            <span className="font-semibold text-emerald-400 font-mono">
              {stats.totalDevices > 0 ? Math.round((stats.onlineDevices / stats.totalDevices) * 100) : 0}%
            </span>
            <span className="ml-2">systems operational</span>
          </div>
        </div>

        {/* Offline Devices */}
        <div className="relative overflow-hidden rounded-xl bg-slate-900/40 p-5 px-6 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Offline Outages</p>
              <h3 className={`mt-2 text-3xl font-bold font-mono ${stats.offlineDevices > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`}>
                {stats.offlineDevices}
              </h3>
            </div>
            <div className={`flex size-12 items-center justify-center rounded-lg border ${stats.offlineDevices > 0 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-slate-800/40 text-slate-400 border-slate-700/50'}`}>
              <XCircle className="size-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-slate-400">
            <span className={`font-semibold font-mono ${stats.offlineDevices > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {stats.offlineDevices}
            </span>
            <span className="ml-2">unreachable host targets</span>
          </div>
        </div>

        {/* High Latency Alerts */}
        <div className="relative overflow-hidden rounded-xl bg-slate-900/40 p-5 px-6 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Latency Warning</p>
              <h3 className={`mt-2 text-3xl font-bold font-mono ${stats.highLatencyAlerts > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {stats.highLatencyAlerts}
              </h3>
            </div>
            <div className={`flex size-12 items-center justify-center rounded-lg border ${stats.highLatencyAlerts > 0 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-800/40 text-slate-400 border-slate-700/50'}`}>
              <AlertTriangle className="size-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-slate-400">
            <span className="ml-0 text-amber-400 font-semibold">&gt; 400ms</span>
            <span className="ml-1.5">queues lagging</span>
          </div>
        </div>
      </div>

      {/* Aggregate Network Telemetry Latency Trend */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-950 p-6 shadow-xl">
        <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-100 flex items-center gap-2">
              <History className="size-5 text-indigo-400" />
              Live Telemetry Stream
            </h2>
            <p className="text-xs text-slate-400">Continuous ping timeline mapping average and spiked node latencies (updated automatically)</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="size-2 rounded-full bg-emerald-500"></span> Normal
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="size-2 rounded-full bg-amber-500"></span> Spike (&gt;400ms)
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="size-2 rounded-full bg-rose-500"></span> Timeout (0ms)
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis 
                  dataKey="time" 
                  stroke="#64748b" 
                  fontSize={10}
                  tickLine={false}
                  dy={8}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false}
                  unit="ms"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px'
                  }}
                  formatter={(value: any, name: any, props: any) => {
                    if (props.payload.status === 'offline') {
                      return ['TIMEOUT / Dropped', 'Status'];
                    }
                    return [`${value} ms`, props.payload.deviceName];
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="latency" 
                  stroke="#818cf8" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#latencyGrad)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-905">
              <div className="text-center text-slate-500">
                <Activity className="mx-auto size-8 animate-pulse text-indigo-400/50 mb-2" />
                <p className="text-sm">Initiating monitoring feeds...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
