/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  Search, 
  Filter, 
  Activity, 
  Edit, 
  Trash2, 
  ExternalLink,
  Cpu, 
  Network, 
  Layers, 
  Database,
  Wifi,
  Plus
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Device, DeviceType, DeviceStatus } from '../types';

interface DeviceListProps {
  devices: Device[];
  onTriggerPing: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  onDeleteDevice: (id: string) => void;
  onNavigateToAdd: () => void;
}

export default function DeviceList({
  devices,
  onTriggerPing,
  onEditDevice,
  onDeleteDevice,
  onNavigateToAdd
}: DeviceListProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredDevices = devices.filter(dev => {
    const matchesSearch = 
      dev.name.toLowerCase().includes(search.toLowerCase()) || 
      dev.ip_address.toLowerCase().includes(search.toLowerCase()) ||
      (dev.description || '').toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === 'all' || dev.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || dev.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case 'mikrotik':
        return <Cpu className="size-4 text-cyan-400" />;
      case 'router':
        return <Network className="size-4 text-indigo-400" />;
      case 'switch':
        return <Layers className="size-4 text-emerald-400" />;
      case 'server':
        return <Database className="size-4 text-amber-400" />;
      case 'link':
        return <Wifi className="size-4 text-indigo-400" />;
      default:
        return <Network className="size-4" />;
    }
  };

  const formatLastCheck = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '--:--:--';
    }
  };

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950 p-6 shadow-xl space-y-5">
      {/* Table Header Filter Action Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="grow max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search hostname, IP, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Type Filter */}
          <div className="flex items-center space-x-2 bg-slate-900/40 px-3 py-1.5 rounded-lg border border-slate-800">
            <Filter className="size-3.5 text-slate-500" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent border-none text-xs text-slate-300 focus:outline-none cursor-pointer pr-4"
            >
              <option value="all" className="bg-slate-950 text-slate-300">All Modules</option>
              <option value="mikrotik" className="bg-slate-950 text-slate-300">MikroTik</option>
              <option value="router" className="bg-slate-950 text-slate-300">Routers</option>
              <option value="switch" className="bg-slate-950 text-slate-300">Switches</option>
              <option value="server" className="bg-slate-950 text-slate-300">Servers</option>
              <option value="link" className="bg-slate-950 text-slate-300">Links/WAN</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2 bg-slate-900/40 px-3 py-1.5 rounded-lg border border-slate-800">
            <Activity className="size-3.5 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none text-xs text-slate-300 focus:outline-none cursor-pointer pr-4"
            >
              <option value="all" className="bg-slate-950 text-slate-300">All States</option>
              <option value="online" className="bg-slate-950 text-slate-300">Online</option>
              <option value="offline" className="bg-slate-950 text-slate-300">Offline</option>
            </select>
          </div>

          {/* Create Device button */}
          <Button 
            onClick={onNavigateToAdd}
            variant="default"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg hover:shadow-indigo-500/20"
          >
            <Plus className="size-4 mr-1.5" />
            Add Device
          </Button>
        </div>
      </div>

      {/* Network Table Representation */}
      <div className="overflow-x-auto rounded-lg border border-slate-800/60">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/30 text-xs font-semibold tracking-wider text-slate-400 uppercase">
              <th className="px-6 py-4">Node Profile</th>
              <th className="px-6 py-4">IP / hostname</th>
              <th className="px-6 py-4">Hardware Type</th>
              <th className="px-6 py-4">Link Status</th>
              <th className="px-6 py-4">Latency Metric</th>
              <th className="px-6 py-4">Last Monitored</th>
              <th className="px-6 py-4 text-center">Diagnostics</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-sm">
            {filteredDevices.length > 0 ? (
              filteredDevices.map((dev) => (
                <tr 
                  key={dev.id} 
                  className="hover:bg-slate-900/20 transition-all group duration-150"
                >
                  {/* Name Description */}
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-200">{dev.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-1 max-w-xs">{dev.description || 'No description provided.'}</div>
                  </td>

                  {/* IP Host Address */}
                  <td className="px-6 py-4 font-mono text-xs text-indigo-300">
                    {dev.ip_address}
                  </td>

                  {/* Device Type Badge */}
                  <td className="px-6 py-4 align-middle">
                    <div className="flex items-center gap-1.5 text-slate-300 font-medium text-xs">
                      {getDeviceIcon(dev.type)}
                      <span className="capitalize">{dev.type}</span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    {dev.status === 'online' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/20 animate-pulse">
                        <span className="size-1.5 rounded-full bg-rose-500"></span>
                        Offline
                      </span>
                    )}
                  </td>

                  {/* Latency with high indicator warning */}
                  <td className="px-6 py-4 font-mono text-xs">
                    {dev.status === 'offline' ? (
                      <span className="text-slate-500 font-bold">TIMEOUT</span>
                    ) : dev.latency > 400 ? (
                      <span className="text-amber-400 font-bold flex items-center gap-1.5">
                        {dev.latency} ms
                        <span className="inline-block size-2 rounded-full bg-amber-500 animate-ping"></span>
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-medium">{dev.latency} ms</span>
                    )}
                  </td>

                  {/* Last check time */}
                  <td className="px-6 py-4 text-xs font-mono text-slate-400">
                    {formatLastCheck(dev.last_check)}
                  </td>

                  {/* Diagnostic actions */}
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {/* Diagnostic Ping Button */}
                      <Button
                        onClick={() => onTriggerPing(dev)}
                        variant="outline"
                        size="xs"
                        className="text-xs font-medium border-slate-800 text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/30 gap-1"
                        title="Live ping simulation window"
                      >
                        <Activity className="size-3" />
                        Live Ping
                      </Button>

                      {/* Edit Button */}
                      <Button
                        onClick={() => onEditDevice(dev)}
                        variant="ghost"
                        size="icon-xs"
                        className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/80"
                        title="Edit Node Profile"
                      >
                        <Edit className="size-3.5" />
                      </Button>

                      {/* Delete Button */}
                      <Button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete ${dev.name}?`)) {
                            onDeleteDevice(dev.id);
                          }
                        }}
                        variant="ghost"
                        size="icon-xs"
                        className="text-slate-500 hover:text-rose-400 hover:bg-slate-800/80"
                        title="Delete Device Node"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-500">
                  No devices matched your active query filters. Create a new target profile!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
