/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Cpu, 
  Network, 
  Layers, 
  Database, 
  Wifi, 
  Save, 
  ShieldAlert 
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Device, DeviceType } from '../types';

interface DeviceFormProps {
  device: Device | null; // Null means Add Mode, populated means Edit Mode
  onSave: (data: { name: string; ip_address: string; type: DeviceType; description: string }) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export default function DeviceForm({
  device,
  onSave,
  onCancel,
  isSaving
}: DeviceFormProps) {
  const [name, setName] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [type, setType] = useState<DeviceType>('router');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Initialize form state if Editing
  useEffect(() => {
    if (device) {
      setName(device.name);
      setIpAddress(device.ip_address);
      setType(device.type);
      setDescription(device.description || '');
    } else {
      // Clear values if Adding
      setName('');
      setIpAddress('');
      setType('router');
      setDescription('');
    }
    setError(null);
  }, [device]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Simple robust form validation
    if (!name.trim()) {
      setError('Please provide a descriptive identifier name for this node.');
      return;
    }
    if (!ipAddress.trim()) {
      setError('An IP address or hostname target is required for ping monitoring.');
      return;
    }

    onSave({
      name: name.trim(),
      ip_address: ipAddress.trim(),
      type,
      description: description.trim()
    });
  };

  const typesConfig: { value: DeviceType; label: string; icon: any; colorClass: string; desc: string }[] = [
    { 
      value: 'router', 
      label: 'Edge Router', 
      icon: Network, 
      colorClass: 'border-indigo-500/30 text-indigo-400 bg-indigo-500/5', 
      desc: 'Standard internet routing unit.' 
    },
    { 
      value: 'mikrotik', 
      label: 'MikroTik CCR/AP', 
      icon: Cpu, 
      colorClass: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/5', 
      desc: 'RouterBoard or RouterOS endpoint.' 
    },
    { 
      value: 'switch', 
      label: 'Core Switch', 
      icon: Layers, 
      colorClass: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5', 
      desc: 'Layer 2/3 distribution switches.' 
    },
    { 
      value: 'link', 
      label: 'WAN / Internet Link', 
      icon: Wifi, 
      colorClass: 'border-blue-500/30 text-blue-400 bg-blue-500/5', 
      desc: 'Dedicated fiber, P2P or ISP bridge.' 
    },
    { 
      value: 'server', 
      label: 'Physical / VPS Server', 
      icon: Database, 
      colorClass: 'border-amber-500/30 text-amber-500 bg-amber-500/5', 
      desc: 'Local database or virtual host server.' 
    }
  ];

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950 p-6 shadow-xl max-w-2xl mx-auto">
      {/* Form Title & Back Action */}
      <div className="mb-6 flex items-center justify-between border-b border-slate-805 pb-4">
        <div className="flex items-center space-x-3">
          <button 
            type="button"
            onClick={onCancel}
            className="flex items-center justify-center size-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-100">
              {device ? 'Modify Node Profile' : 'Configure New NodeTarget'}
            </h2>
            <p className="text-xs text-slate-400">
              {device ? `Editing parameters for ${device.name}` : 'Provision a new IP/host into the monitoring sequence daemon.'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error notification banner */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg bg-rose-500/10 border border-rose-500/20 p-4 text-xs text-rose-400">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-300">Invalid parameters error</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Input Name & IP Address Grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Node identifier Name */}
          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Device Identifier/Name</label>
            <input
              type="text"
              required
              placeholder="e.g., Core Router CCR2004"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Node IPAddress / HostTarget */}
          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-wider text-slate-400 uppercase">IP Address / Host Target</label>
            <input
              type="text"
              required
              placeholder="e.g., 192.168.88.1 or dynamic.host.net"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-2 text-sm font-mono text-indigo-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Custom Interactive Hardware Category Buttons */}
        <div className="space-y-2">
          <label className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Hardware Category Type</label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {typesConfig.map((item) => {
              const IconComp = item.icon;
              const isSelected = type === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setType(item.value)}
                  className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/5 text-indigo-200' 
                      : 'border-slate-800 bg-slate-950 hover:bg-slate-900/40 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg border ${isSelected ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-slate-900 text-slate-400 border-slate-850'}`}>
                      <IconComp className="size-4" />
                    </div>
                    <span className="font-semibold text-xs text-slate-300">{item.label}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-2 font-normal leading-relaxed">{item.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Textarea Description */}
        <div className="space-y-2">
          <label className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Device Description / Location / Notes</label>
          <textarea
            rows={3}
            placeholder="Describe connection ports, operational notes, alert notifications routing, or node rack location..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed"
          />
        </div>

        {/* Form Action Controls */}
        <div className="flex items-center justify-end space-x-3 border-t border-slate-900 pt-5">
          <Button
            type="button"
            onClick={onCancel}
            variant="outline"
            className="border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 font-medium md:px-5"
          >
            <Save className="size-4 mr-1.5" />
            {isSaving ? 'Saving Configurations...' : 'Commit Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
}
