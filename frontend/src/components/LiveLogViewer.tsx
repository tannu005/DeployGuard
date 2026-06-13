'use client';

import React, { useEffect, useState, useRef } from 'react';

export interface LogLine {
  timestamp: string;
  content: string;
  severity: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
}

export function LiveLogViewer({ pipelineId, onComplete }: { pipelineId: string, onComplete?: (report: any) => void }) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'>('CONNECTING');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001');

    ws.onopen = () => {
      setStatus('CONNECTED');
      ws.send(JSON.stringify({ type: 'SUBSCRIBE_LOGS', pipelineId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'LOG_LINE') {
          setLogs((prev) => [...prev, data as LogLine]);
        } else if (data.type === 'ANALYSIS_COMPLETE') {
          if (onComplete) onComplete(data.report);
        }
      } catch (e) {
        console.error('Failed to parse log line', e);
      }
    };

    ws.onclose = () => setStatus('DISCONNECTED');
    return () => ws.close();
  }, [pipelineId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'ERROR': return 'text-red-600 bg-red-500/10';
      case 'WARN': return 'text-orange-600 bg-orange-500/10';
      case 'SUCCESS': return 'text-emerald-600 bg-emerald-500/10';
      case 'INFO': default: return 'text-neutral-600';
    }
  };

  const formatTimestamp = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-[#EAECE9] shadow-[0_8px_40px_rgb(0,0,0,0.06)] overflow-hidden flex flex-col relative group mt-4">
      
      {/* Terminal Header */}
      <div className="bg-[#FAFBF9] border-b border-[#F1F3F1] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-semibold text-[#1C2E1E] uppercase tracking-widest">DeployGuard Pipeline Stream</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#F1F3F1] rounded-full shadow-sm">
          <div className={`w-2 h-2 rounded-full ${status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-[11px] font-bold text-[#5A635A] tracking-wider uppercase">{status}</span>
        </div>
      </div>

      {/* Terminal Body */}
      <div 
        ref={scrollRef}
        className="p-5 h-[400px] overflow-y-auto font-mono text-[13px] leading-relaxed custom-scrollbar relative bg-white"
      >
        {logs.length === 0 && status !== 'CONNECTING' ? (
           <div className="h-full flex items-center justify-center text-neutral-400 italic">No logs available.</div>
        ) : null}

        {logs.map((log, i) => (
          <div key={i} className={`flex gap-3 px-3 py-1.5 rounded transition-colors mb-0.5 ${getSeverityColor(log.severity)} hover:bg-neutral-50`}>
            <span className="text-neutral-400 select-none whitespace-nowrap">[{formatTimestamp(log.timestamp)}]</span>
            <span className="break-all font-medium">{log.content}</span>
          </div>
        ))}

        {status === 'CONNECTED' && (
          <div className="flex gap-3 px-3 py-1.5">
            <span className="text-neutral-400 whitespace-nowrap">[{formatTimestamp(new Date().toISOString())}]</span>
            <span className="w-2 h-[15px] bg-black animate-blink inline-block mt-0.5"></span>
          </div>
        )}
      </div>
    </div>
  );
}
