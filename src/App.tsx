/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Network, 
  Database, 
  Settings, 
  RefreshCw, 
  HelpCircle, 
  ShieldCheck, 
  AlertCircle,
  Clock,
  LayoutDashboard
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { Button } from '../components/ui/button';
import { Device, PingLog, DashboardStats, DeviceType } from './types';
import DashboardOverview from './components/DashboardOverview';
import DeviceList from './components/DeviceList';
import DeviceForm from './components/DeviceForm';
import PingModal from './components/PingModal';

export default function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [logs, setLogs] = useState<PingLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // App routing state: 'dashboard' | 'add_device' | 'edit_device'
  const [currentView, setCurrentView] = useState<'dashboard' | 'add_device' | 'edit_device'>('dashboard');
  const [selectedDeviceForEdit, setSelectedDeviceForEdit] = useState<Device | null>(null);
  const [selectedDeviceForPing, setSelectedDeviceForPing] = useState<Device | null>(null);

  // System time clock state
  const [currentTime, setCurrentTime] = useState(new Date().toISOString());

  // Force dark mode on mount
  useEffect(() => {
    document.documentElement.classList.add('dark');
    
    // Timer to update local clock
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date().toISOString());
    }, 1000);

    return () => clearInterval(clockTimer);
  }, []);

  // Fetch core devices
  const fetchDevices = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const res = await fetch('/api/devices');
      if (!res.ok) throw new Error('Failed to retrieve network targets from server.');
      const data = await res.json();
      setDevices(data);
      setErrorNotice(null);
    } catch (err: any) {
      console.error(err);
      setErrorNotice(err.message || 'Severe network connection error with server.');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  // Fetch log history for aggregate chart
  const fetchLogs = async () => {
    try {
      // Pick up the logs
      const res = await fetch('/api/devices/all/logs?limit=40');
      // Wait, there might be no specific ID or we fetch for a specific device,
      // let's fetch individual or fallback to getting first device logs,
      // or we can query our generic bulk timeline endpoint (we built GET /api/devices/:id/logs.
      // Wait, what if we get all logs?
      // Since our server returns logs, let's fetch for EACH device to build a beautiful timeline,
      // or retrieve logs for a specific core node! Usually, showing the logs of the core edge nodes
      // (like the Fiber Internet Link or CCR) gives an amazing aggregate visualization!
      // Let's query log sequences for all devices or the top 5 devices and join them.
      // To keep it high performance, let's load logs of the first 3 active devices.
      const devicesRes = await fetch('/api/devices');
      if (!devicesRes.ok) return;
      const devList: Device[] = await devicesRes.json();
      
      let allJoinedLogs: PingLog[] = [];
      for (const dev of devList.slice(0, 4)) {
        try {
          const logsRes = await fetch(`/api/devices/${dev.id}/logs?limit=10`);
          if (logsRes.ok) {
            const list: PingLog[] = await logsRes.json();
            allJoinedLogs = [...allJoinedLogs, ...list];
          }
        } catch {
          // ignore error (offline/missing node logs)
        }
      }

      // Sort chronological
      allJoinedLogs.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setLogs(allJoinedLogs);
    } catch (err) {
      console.error('Failed aggregate logs retrieve:', err);
    }
  };

  // Trigger continuous background polling to sync metrics every 8 seconds
  useEffect(() => {
    // Initial fetch
    fetchDevices(true);
    fetchLogs();

    const fetchInterval = setInterval(() => {
      fetchDevices(false);
      fetchLogs();
    }, 8500); // 8.5 seconds polling

    return () => clearInterval(fetchInterval);
  }, []);

  // Calculate stats
  const stats: DashboardStats = useMemo(() => {
    const totalDevices = devices.length;
    const onlineDevices = devices.filter(d => d.status === 'online').length;
    const offlineDevices = devices.filter(d => d.status === 'offline').length;
    const highLatencyAlerts = devices.filter(d => d.status === 'online' && d.latency > 400).length;

    return {
      totalDevices,
      onlineDevices,
      offlineDevices,
      highLatencyAlerts
    };
  }, [devices]);

  // Handler: Add Device
  const handleCreateDevice = async (formData: { name: string; ip_address: string; type: DeviceType; description: string }) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) throw new Error('Provisioning failed on backend.');
      await fetchDevices(false);
      setCurrentView('dashboard');
    } catch (err: any) {
      alert(err.message || 'Failed to save network configuration settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handler: Edit Device
  const handleUpdateDevice = async (formData: { name: string; ip_address: string; type: DeviceType; description: string }) => {
    if (!selectedDeviceForEdit) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/devices/${selectedDeviceForEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) throw new Error('Adjustment commit failed.');
      await fetchDevices(false);
      setCurrentView('dashboard');
    } catch (err: any) {
      alert(err.message || 'Failed to modify device configurations.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handler: Delete Device
  const handleDeleteDevice = async (id: string) => {
    try {
      const res = await fetch(`/api/devices/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Deletion failed on cloud database controller.');
      await fetchDevices(false);
    } catch (err: any) {
      alert(err.message || 'Failed to execute node deletion.');
    }
  };

  // Handler: Reset Seed DB (Demo/Re-sync tool)
  const handleResetDatabase = async () => {
    if (confirm('Are you sure you want to reset the database to the five default network simulation devices? All custom added profiles will be cleared.')) {
      setIsLoading(true);
      try {
        const res = await fetch('/api/reset', { method: 'POST' });
        if (res.ok) {
          await fetchDevices(false);
          await fetchLogs();
        }
      } catch (err) {
        console.error('Database reset failed:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col antialiased selection:bg-indigo-505 selection:text-white">
      {/* Top Main Navigation Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          
          {/* Brand Logo Alignment */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentView('dashboard')}>
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 shadow-md shadow-indigo-600/20 text-white">
              <Network className="size-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">MPRODED</span>
                <span className="text-[10px] font-extrabold tracking-widest uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-md">MProded</span>
              </div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Network Monitoring Center</p>
            </div>
          </div>

          {/* Quick Metrics & System Clock indicators */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-slate-400">
            {/* Database status banner */}
            <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg select-none">
              <Database className="size-3.5 text-emerald-400" />
              <span className="text-[11px] font-medium text-slate-300">MProded DB Dual Sync</span>
            </div>

            {/* Dynamic Clock read-out */}
            <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300 font-mono">
              <Clock className="size-3.5 text-indigo-400" />
              <span>{new Date(currentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} UTC</span>
            </div>

            {/* Reload State indicator */}
            <button 
              onClick={() => { fetchDevices(true); fetchLogs(); }}
              className="flex items-center justify-center size-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 hover:border-slate-705 transition-all cursor-pointer"
              title="Force immediate telemetry update"
            >
              <RefreshCw className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Core Body Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        
        {/* Error notification banner */}
        {errorNotice && (
          <div className="flex items-start gap-3 rounded-xl bg-rose-500/10 border border-rose-500/20 p-5 text-sm text-rose-400 max-w-3xl">
            <AlertCircle className="size-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-200">Lost endpoint routing access</p>
              <p className="mt-1 leading-relaxed text-xs">{errorNotice}</p>
              <button 
                onClick={() => fetchDevices(true)}
                className="mt-3 text-xs font-bold text-rose-300 hover:text-rose-100 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
              >
                Retry handshake connection
              </button>
            </div>
          </div>
        )}

        {/* LOADING INDICATOR VIEW OVERLAY */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="relative flex justify-center items-center">
              <div className="size-16 rounded-full border-4 border-slate-800 border-t-indigo-500 animate-spin"></div>
              <Network className="absolute size-6 text-indigo-400 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold tracking-wide text-slate-300">Assembling core hardware nodes...</p>
              <p className="text-xs text-slate-500 font-mono mt-1">Contacting telemetry storage gateway</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* MAIN DASHBOARD SCREEN AREA */}
            {currentView === 'dashboard' && (
              <div className="space-y-8 animate-fadeIn">
                
                {/* Visual Intro Banner */}
                <div className="rounded-xl border border-slate-900 bg-gradient-to-r from-slate-950 via-slate-900/60 to-slate-950 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
                      <LayoutDashboard className="size-6 text-indigo-500" />
                      Network Telemetry Dashboard
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 max-w-xl">
                      MProded measures millisecond delays, outages, and bandwidth drop ratios across core switches, routers, MikroTiks, and fiber link bridges in real-time.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleResetDatabase}
                      variant="outline"
                      size="sm"
                      className="text-xs hover:border-indigo-500/30 font-medium hover:bg-indigo-500/5 text-slate-400 border-slate-800"
                      title="Reload initial CCR, Link, primary PG servers for the demo"
                    >
                      Reset Seed Nodes
                    </Button>
                  </div>
                </div>

                {/* KPI Metrics widgets and charts */}
                <DashboardOverview 
                  devices={devices} 
                  logs={logs} 
                  stats={stats} 
                  onSelectDevice={(id) => {
                    const dev = devices.find(d => d.id === id);
                    if (dev) setSelectedDeviceForPing(dev);
                  }}
                />

                {/* Primary Devices dynamic check table view */}
                <DeviceList
                  devices={devices}
                  onTriggerPing={(dev) => setSelectedDeviceForPing(dev)}
                  onEditDevice={(dev) => {
                    setSelectedDeviceForEdit(dev);
                    setCurrentView('edit_device');
                  }}
                  onDeleteDevice={handleDeleteDevice}
                  onNavigateToAdd={() => {
                    setSelectedDeviceForEdit(null);
                    setCurrentView('add_device');
                  }}
                />
              </div>
            )}

            {/* ADD DEVICE FORM VIEW SCREEN */}
            {currentView === 'add_device' && (
              <div className="animate-fadeIn">
                <DeviceForm
                  device={null}
                  onSave={handleCreateDevice}
                  onCancel={() => {
                    setCurrentView('dashboard');
                  }}
                  isSaving={isSaving}
                />
              </div>
            )}

            {/* EDIT DEVICE FORM VIEW SCREEN */}
            {currentView === 'edit_device' && (
              <div className="animate-fadeIn">
                <DeviceForm
                  device={selectedDeviceForEdit}
                  onSave={handleUpdateDevice}
                  onCancel={() => {
                    setSelectedDeviceForEdit(null);
                    setCurrentView('dashboard');
                  }}
                  isSaving={isSaving}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Diagnostics Live Ping Modal window */}
      <AnimatePresence>
        {selectedDeviceForPing && (
          <PingModal
            device={selectedDeviceForPing}
            onClose={() => setSelectedDeviceForPing(null)}
          />
        )}
      </AnimatePresence>

      {/* Aesthetic Site Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950 px-6 py-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center sm:justify-between max-w-7xl w-full mx-auto select-none">
        <div className="flex items-center justify-center gap-1.5 font-semibold text-slate-400">
          <ShieldCheck className="size-4 text-emerald-400" />
          <span>MPRODED Core Daemon Systems Inc.</span>
        </div>
        <div className="mt-2 sm:mt-0 font-mono text-[10px]">
          Telemetry Engine v2.4.12 // Cloud Native Monitoring Hub
        </div>
      </footer>
    </div>
  );
}
