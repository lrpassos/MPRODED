/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Play, 
  Pause, 
  Terminal, 
  Activity, 
  TrendingUp, 
  CheckCircle, 
  AlertOctagon 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../../components/ui/button';
import { Device, PingLog } from '../types';

interface PingModalProps {
  device: Device;
  onClose: () => void;
}

interface PingSequenceItem {
  seq: number;
  timeString: string;
  latency: number;
  status: 'online' | 'offline';
  message: string;
}

export default function PingModal({ device, onClose }: PingModalProps) {
  const [isActive, setIsActive] = useState(true);
  const [sequence, setSequence] = useState<PingSequenceItem[]>([]);
  const [stats, setStats] = useState({
    sent: 0,
    received: 0,
    loss: 0,
    min: 9999,
    max: 0,
    avg: 0,
    totalLatency: 0
  });

  const seqCounter = useRef(1);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal logs to bottom on changes
  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sequence]);

  // Realtime loop running while active and modal open
  useEffect(() => {
    if (!isActive) return;

    const runPing = async () => {
      try {
        const res = await fetch(`/api/devices/${device.id}/ping`, {
          method: 'POST'
        });
        
        const data = await res.json();
        
        if (data.success) {
          const lat = data.latency;
          const status = data.deviceStatus;
          const currentSeq = seqCounter.current;
          seqCounter.current += 1;

          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          let terminalMessage = '';

          if (status === 'online') {
            terminalMessage = `64 bytes from ${device.ip_address}: icmp_seq=${currentSeq} ttl=64 time=${lat} ms`;
          } else {
            terminalMessage = `Request timeout for icmp_seq=${currentSeq} (No response from host target)`;
          }

          const newItem: PingSequenceItem = {
            seq: currentSeq,
            timeString: timeStr,
            latency: status === 'online' ? lat : 0,
            status,
            message: terminalMessage
          };

          // Append to log sequence list (keep last 20 for graph representation)
          setSequence(prev => {
            const nextList = [...prev, newItem];
            return nextList.slice(-25); // Limit chart length elegantly
          });

          // Update aggregated run statistics
          setStats(prev => {
            const nextSent = prev.sent + 1;
            const nextReceived = status === 'online' ? prev.received + 1 : prev.received;
            const nextLoss = Math.round(((nextSent - nextReceived) / nextSent) * 100);
            
            let nextMin = prev.min;
            let nextMax = prev.max;
            let nextTotalLatency = prev.totalLatency;

            if (status === 'online') {
              if (lat < prev.min) nextMin = lat;
              if (lat > prev.max) nextMax = lat;
              nextTotalLatency += lat;
            }

            const nextAvg = nextReceived > 0 ? Math.round(nextTotalLatency / nextReceived) : 0;

            return {
              sent: nextSent,
              received: nextReceived,
              loss: nextLoss,
              min: nextMin === 9999 ? lat : nextMin,
              max: nextMax,
              avg: nextAvg,
              totalLatency: nextTotalLatency
            };
          });
        }
      } catch (err) {
        console.error('Ping modal error pinging host:', err);
      }
    };

    // Run first immediately
    runPing();

    const interval = setInterval(runPing, 1500); // Probe every 1.5 seconds
    return () => clearInterval(interval);
  }, [isActive, device]);

  const chartData = useMemo(() => {
    return sequence.map(item => ({
      seq: `seq ${item.seq}`,
      latency: item.status === 'online' ? item.latency : 0,
      status: item.status
    }));
  }, [sequence]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-3xl rounded-xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Activity className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Live Diagnostic Probe: MPRODED
              </h2>
              <p className="text-xs text-indigo-300 font-mono mt-0.5">{device.name} — {device.ip_address}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-900 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Core Layout Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Diagnostic Controls & Stats Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {/* Status / Command block */}
            <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/15 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-semibold text-slate-500 tracking-widest uppercase">Probe Status</span>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`inline-block size-2 rounded-full ${isActive ? 'bg-emerald-505 animate-ping' : 'bg-amber-500'}`}></span>
                  <span className="text-xs font-bold text-slate-300 capitalize">
                    {isActive ? 'Simulating' : 'Suspended'}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                {isActive ? (
                  <Button
                    onClick={() => setIsActive(false)}
                    variant="outline"
                    size="xs"
                    className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-[11px] gap-1"
                  >
                    <Pause className="size-3" />
                    Pause
                  </Button>
                ) : (
                  <Button
                    onClick={() => setIsActive(true)}
                    variant="default"
                    size="xs"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-[11px] text-white gap-1"
                  >
                    <Play className="size-3" />
                    Resume
                  </Button>
                )}
              </div>
            </div>

            {/* Total packet counts and loss */}
            <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/15">
              <span className="text-[10px] font-semibold text-slate-500 tracking-widest uppercase">Transmission</span>
              <div className="mt-2 text-xl font-bold font-mono text-slate-300">
                {stats.received} <span className="text-xs text-slate-500">/ {stats.sent} ok</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                {stats.loss > 0 ? (
                  <span className="text-rose-400 font-bold font-mono text-[11px]">{stats.loss}% loss</span>
                ) : (
                  <span className="text-emerald-400 font-bold font-mono text-[11px]">0% loss</span>
                )}
                <span className="text-[11px] text-slate-500">drop rate</span>
              </div>
            </div>

            {/* Average latency readout */}
            <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/15">
              <span className="text-[10px] font-semibold text-slate-500 tracking-widest uppercase">Average Latency</span>
              <div className="mt-2 text-xl font-bold font-mono text-indigo-300">
                {stats.avg} <span className="text-xs text-slate-500">ms</span>
              </div>
              <div className="mt-1.5 text-[11px] text-slate-500">
                aggregate response limit
              </div>
            </div>

            {/* Min / Max bounds */}
            <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/15">
              <span className="text-[10px] font-semibold text-slate-500 tracking-widest uppercase">Latency Bounds</span>
              <div className="mt-2 text-sm font-bold font-mono text-slate-300 flex justify-between">
                <span>Min: <span className="text-emerald-400">{stats.min === 9999 ? 0 : stats.min}ms</span></span>
                <span>Max: <span className="text-amber-500">{stats.max}ms</span></span>
              </div>
              <div className="mt-2.5 text-[11px] text-slate-500">
                jitter bounds limits
              </div>
            </div>
          </div>

          {/* Active Line Chart visual */}
          <div className="rounded-xl border border-slate-900 bg-slate-950 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-indigo-400" />
              Live Ping Scancode Chart (1.5s Probe Feed)
            </h3>
            <div className="h-44 w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#101927" opacity={0.6} />
                    <XAxis dataKey="seq" stroke="#334155" fontSize={9} hide />
                    <YAxis stroke="#475569" fontSize={9} domain={[0, 'auto']} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#070a13',
                        borderColor: '#1e293b',
                        color: '#f8fafc',
                        fontSize: '11px',
                        borderRadius: '6px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="latency" 
                      stroke="#6366f1" 
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#6366f1', strokeWidth: 1 }}
                      activeDot={{ r: 5 }}
                      animationDuration={300}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-600 font-mono">
                  Listening to line latency packets...
                </div>
              )}
            </div>
          </div>

          {/* Live Command Line sequence terminal logs output box */}
          <div className="rounded-xl border border-slate-900 bg-slate-950 p-4 font-mono text-[11px] flex flex-col h-48 select-text">
            <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-2 text-slate-500">
              <div className="flex items-center gap-1.5 font-sans font-semibold">
                <Terminal className="size-3.5 text-indigo-400" />
                <span>ICMP Log Terminal Stream</span>
              </div>
              <span className="text-[10px]">mproded v1.0.0</span>
            </div>
            
            <div className="overflow-y-auto flex-1 space-y-1 pr-2 custom-scrollbar">
              {sequence.map((item, index) => (
                <div 
                  key={index} 
                  className={`leading-relaxed whitespace-pre-wrap ${
                    item.status === 'offline' 
                      ? 'text-rose-400' 
                      : item.latency > 400 
                        ? 'text-amber-400 font-bold' 
                        : 'text-emerald-400'
                  }`}
                >
                  <span className="text-slate-600 select-none">[{item.timeString}]</span> {item.message}
                </div>
              ))}
              <div ref={terminalBottomRef} />
            </div>
          </div>
        </div>

        {/* Modal Controls footer */}
        <div className="px-6 py-4 border-t border-slate-900 bg-slate-950/40 flex items-center justify-end space-x-2">
          <Button 
            onClick={onClose}
            variant="default"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
          >
            Close Diagnostics
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
