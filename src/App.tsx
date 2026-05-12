/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Instagram, 
  Search, 
  History, 
  Upload, 
  Layers, 
  Settings, 
  ChevronRight, 
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
  Mic,
  Play,
  Pause,
  Volume2,
  VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
// @ts-ignore
import ReactPlayer from 'react-player';

// --- Helpers ---

const exportFormat = (job: any, format: string) => {
  if (!job || !job.results) return;

  let content = '';
  let mime = 'text/plain';
  let ext = format;

  if (format === 'json') {
    content = JSON.stringify(job, null, 2);
    mime = 'application/json';
  } else if (format === 'txt') {
    content = job.results.map((res: any) => {
      let text = `REEL: ${res.instagram_url}\n`;
      text += `USER: @${res.owner_username || 'unknown'}\n`;
      text += `STATS: Views: ${res.video_view_count || 0}, Likes: ${res.likes_count || 0}\n`;
      text += `CAPTION: ${res.caption || ''}\n`;
      text += `SUMMARY: ${res.summary || ''}\n`;
      text += `SENTIMENT: ${res.sentiment || ''}\n`;
      text += `KEYWORDS: ${(res.keywords || []).join(', ')}\n`;
      text += `------------------------------------------\n`;
      text += `TRANSCRIPT:\n${res.transcript || 'No transcript available'}\n`;
      text += `\nSEGMENTS:\n`;
      res.segments?.forEach((seg: any) => {
        text += `[${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s] ${seg.speaker ? seg.speaker + ': ' : ''}${seg.text}\n`;
      });
      return text;
    }).join('\n\n==========================================\n\n');
  } else if (format === 'csv') {
    const headers = ['URL', 'Username', 'Likes', 'Views', 'Duration', 'Transcript'];
    content = headers.join(',') + '\n' + job.results.map((res: any) => {
      const escape = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
      return [
        escape(res.instagram_url),
        escape(res.owner_username),
        res.likes_count || 0,
        res.video_view_count || 0,
        res.video_duration || 0,
        escape(res.transcript)
      ].join(',');
    }).join('\n');
    mime = 'text/csv';
  } else if (format === 'srt') {
    content = job.results.map((res: any) => {
      if (!res.segments) return '';
      return res.segments.map((seg: any, i: number) => {
        const formatTime = (seconds: number) => {
          const date = new Date(seconds * 1000);
          const hh = String(date.getUTCHours()).padStart(2, '0');
          const mm = String(date.getUTCMinutes()).padStart(2, '0');
          const ss = String(date.getUTCSeconds()).padStart(2, '0');
          const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
          return `${hh}:${mm}:${ss},${ms}`;
        };
        return `${i + 1}\n${formatTime(seg.start)} --> ${formatTime(seg.end)}\n${seg.text}\n`;
      }).join('\n');
    }).join('\n\n');
  } else if (format === 'vtt') {
    content = 'WEBVTT\n\n' + job.results.map((res: any) => {
      if (!res.segments) return '';
      return res.segments.map((seg: any, i: number) => {
        const formatTime = (seconds: number) => {
          const date = new Date(seconds * 1000);
          const hh = String(date.getUTCHours()).padStart(2, '0');
          const mm = String(date.getUTCMinutes()).padStart(2, '0');
          const ss = String(date.getUTCSeconds()).padStart(2, '0');
          const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
          return `${hh}:${mm}:${ss}.${ms}`;
        };
        return `${formatTime(seg.start)} --> ${formatTime(seg.end)}\n${seg.text}\n`;
      }).join('\n');
    }).join('\n\n');
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `export-${job.id || 'data'}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};


const speakText = (text: string, isSpeaking: boolean, setIsSpeaking: (val: boolean) => void) => {
  if (isSpeaking) {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  
  utterance.onend = () => setIsSpeaking(false);
  utterance.onerror = () => setIsSpeaking(false);
  
  setIsSpeaking(true);
  window.speechSynthesis.speak(utterance);
};

const ReelPreview = ({ url, videoUrl, onProgress }: { url: string, videoUrl?: string, onProgress?: (time: number) => void }) => {
  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden rounded-xl bg-black">
      {videoUrl ? (
        <video
          src={videoUrl}
          controls
          playsInline
          className="w-full h-full object-contain"
          onTimeUpdate={(e) => onProgress && onProgress((e.target as HTMLVideoElement).currentTime)}
          {...{ referrerPolicy: "no-referrer" }}
        />
      ) : (
        // @ts-ignore
        <ReactPlayer
          onProgress={((p: { playedSeconds: number }) => onProgress && onProgress(p.playedSeconds)) as any}
          {...{ url, width: "100%", height: "100%", controls: true, playsinline: true }}
          style={{ objectFit: 'contain' }}
        />
      )}
    </div>
  );
};

// --- Components ---

const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => {
  const menuItems = [
    { id: 'single', icon: Instagram, label: 'Extract' },
    { id: 'bulk', icon: Layers, label: 'Bulk' },
    { id: 'profile', icon: Upload, label: 'Crawler' },
    { id: 'history', icon: History, label: 'History' },
    { id: 'search', icon: Search, label: 'DB Search' },
  ];

  return (
    <>
      {/* Mobile Nav */}
      <nav id="mobile-nav" className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 h-14 w-[95%] glass-effect rounded-2xl flex items-center justify-around z-50 px-2 shadow-2xl">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 flex-1 py-1 transition-all ${
              activeTab === item.id ? 'text-brand-indigo font-bold' : 'text-slate-400'
            }`}
          >
            <item.icon size={20} className={activeTab === item.id ? 'scale-110' : ''} />
            <span className="text-[8px] sm:text-[9px] uppercase font-bold tracking-tight">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Desktop Sidebar */}
      <aside id="sidebar" className="hidden md:flex flex-col w-64 bg-slate-50 border-r border-slate-200 h-screen sticky top-0 flex-shrink-0">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-2 group cursor-pointer" onClick={() => { setActiveTab('single'); }}>
            <div className="w-10 h-10 bg-brand-indigo rounded-xl flex items-center justify-center text-slate-900 shadow-lg neon-glow-indigo group-hover:rotate-6 transition-transform">
              <Instagram size={24} />
            </div>
            <span className="text-xl font-display font-bold tracking-tighter text-slate-900">Reelscribe<span className="text-brand-indigo">.ai</span></span>
          </div>
        </div>
        
        <div className="p-4 mt-4 flex-1 overflow-y-auto no-scrollbar">
          <div className="space-y-2">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 mb-6 px-4">Core Interface</h2>
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  activeTab === item.id 
                    ? 'bg-brand-indigo/10 text-brand-indigo font-bold border border-brand-indigo/20 shadow-inner' 
                    : 'text-slate-400 hover:bg-slate-100/50 hover:text-slate-900'
                }`}
              >
                <item.icon size={18} />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 mt-auto space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
             <div>
               <p className="text-[10px] font-bold text-slate-400 uppercase">A.I. Model</p>
               <p className="text-xs font-bold text-slate-600">Whisper-1</p>
             </div>
          </div>
        </div>
      </aside>
    </>
  );
};

const JobStatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    'PENDING': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'PROCESSING': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'TRANSCRIBING': 'bg-brand-purple/10 text-brand-purple border-brand-purple/20',
    'DONE': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'FAILED': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  };

  return (
    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${colors[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
      {status}
    </span>
  );
};

const SingleURL = ({ onSuccess }: { onSuccess: (jobId: string) => void }) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await axios.post('/api/process/single', { url });
      onSuccess(response.data.job_id);
      setUrl('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start processing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="single-url-panel" className="max-w-2xl mx-auto w-full glass-effect rounded-xl md:rounded-2xl p-4 md:p-6 shadow-xl md:shadow-2xl transition-all relative overflow-hidden">
      {loading && (
         <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-brand-indigo/20 blur-2xl rounded-full scale-150 animate-pulse" />
              <Loader2 className="animate-spin text-brand-indigo relative z-10 block mx-auto" size={40} />
            </div>
            <p className="text-xs md:text-sm font-bold uppercase tracking-[0.4em] text-brand-indigo mt-6 mb-2">Ingesting Media...</p>
            <p className="text-[9px] md:text-[10px] text-slate-600 uppercase font-bold tracking-widest text-center px-6">Downloading from Instagram and triggering Neural Engine...</p>
         </div>
      )}
      <div className="mb-6 md:mb-8 text-center sm:text-left">
        <h2 className="text-lg md:text-2xl font-display font-bold text-slate-900 tracking-tighter mb-2 md:mb-4">Neural Extraction</h2>
        <p className="text-slate-400 text-sm md:text-lg leading-relaxed font-light">Enter an Instagram Reel URL to initiate deep-audio transcription and multi-language translation.</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6 md:space-y-10">
        <div className="flex flex-col gap-3">
          <div className="relative group">
            <input
              id="reel-url-input"
              type="text"
              placeholder="https://www.instagram.com/reel/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full pl-4 pr-12 py-3 bg-slate-100/50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-indigo/20 focus:border-brand-indigo focus:outline-none text-sm font-medium text-slate-900 transition-all placeholder:text-slate-400"
              required
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-indigo transition-colors flex items-center justify-center">
               <Instagram size={20} />
            </div>
          </div>
          <button
            id="process-single-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-indigo text-white font-bold uppercase tracking-[0.1em] rounded-xl hover:bg-brand-indigo/90 shadow-lg neon-glow-indigo transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs active:scale-[0.98]"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <><Play size={16} fill="currentColor" /> Initialize Process</>}
          </button>
        </div>
        
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 text-rose-400 text-sm font-bold p-6 bg-rose-500/5 border border-rose-500/20 rounded-2xl"
          >
            <AlertCircle size={24} className="shrink-0" />
            {error}
          </motion.div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6 pt-6 md:pt-8 border-t border-slate-200/50">
          <div className="flex items-center gap-3 md:gap-4 bg-slate-100/50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-200/50">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-brand-indigo/20 text-brand-indigo flex items-center justify-center shrink-0">
               <Mic size={16} className="md:w-5 md:h-5" />
            </div>
            <div>
              <p className="text-[8px] md:text-[9px] font-bold text-slate-600 uppercase tracking-widest">Diarization</p>
              <p className="text-[10px] md:text-xs font-bold text-slate-600 tracking-tight">Active Sensor</p>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-4 bg-slate-100/50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-200/50">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-brand-purple/20 text-brand-purple flex items-center justify-center shrink-0">
               <CheckCircle2 size={16} className="md:w-5 md:h-5" />
            </div>
            <div>
              <p className="text-[8px] md:text-[9px] font-bold text-slate-600 uppercase tracking-widest">Translation</p>
              <p className="text-[10px] md:text-xs font-bold text-slate-600 tracking-tight">Auto-English EN</p>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-4 bg-slate-100/50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-200/50">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
               <Settings size={16} className="md:w-5 md:h-5" />
            </div>
            <div>
              <p className="text-[8px] md:text-[9px] font-bold text-slate-600 uppercase tracking-widest">Kernel</p>
              <p className="text-[10px] md:text-xs font-bold text-slate-600 tracking-tight">Whisper-1</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

const CaptionText = ({ text }: { text: string }) => {
  const [expanded, setExpanded] = useState(false);
  const maxLength = 120;
  
  return (
    <div className="flex flex-col items-start w-full">
      <div className="flex gap-1.5 items-center mb-1.5">
        <CheckCircle2 size={12} className="text-emerald-500" />
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Author Insight</span>
      </div>
      {!text ? (
        <p className="text-xs text-slate-400 italic">No embedded narrative detected.</p>
      ) : (
        <>
          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
            {expanded ? text : (text.length > maxLength ? text.slice(0, maxLength) + '...' : text)}
          </p>
          {text.length > maxLength && (
            <button onClick={() => setExpanded(!expanded)} className="text-[10px] font-bold text-brand-indigo hover:text-brand-indigo/80 mt-1.5 uppercase tracking-wider bg-brand-indigo/5 px-2 py-1 rounded">
              {expanded ? 'Show Less' : 'Show More'}
            </button>
          )}
        </>
      )}
    </div>
  );
};

const SegmentItem = ({ seg, i, isActive, containerRef }: { seg: any, i: number, isActive: boolean, containerRef?: React.RefObject<HTMLDivElement> }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    if (isActive && ref.current) {
      if (containerRef && containerRef.current) {
         const container = containerRef.current;
         const el = ref.current;
         // Calculate scroll position to center the element
         const containerHeight = container.clientHeight;
         const elOffsetTop = el.offsetTop;
         const elHeight = el.clientHeight;
         const targetScroll = elOffsetTop - (containerHeight / 2) + (elHeight / 2);
         container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
      } else {
         ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [isActive, containerRef]);

  return (
    <motion.div 
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: i * 0.05 }}
      className={`flex gap-4 group p-3 rounded-xl transition-colors duration-200 items-start cursor-pointer ${isActive ? 'bg-brand-indigo/10 border border-brand-indigo/20 shadow-sm' : 'hover:bg-slate-50'}`}
    >
      <span className={`font-mono font-semibold shrink-0 text-[8px] sm:text-[10px] md:text-xs px-2 py-1 rounded text-center border mt-0.5 ${isActive ? 'bg-brand-indigo/20 text-brand-indigo border-brand-indigo/30' : 'text-brand-indigo bg-brand-indigo/5 border-brand-indigo/10'}`}>
        [{Math.floor((Number(seg.start)||0) / 60).toString().padStart(2, '0')}:{Math.floor((Number(seg.start)||0) % 60).toString().padStart(2, '0')}]
      </span>
      <div className="flex flex-col pt-0.5">
        {seg.speaker && (
          <span className="text-[7px] md:text-[9px] font-bold text-brand-purple uppercase tracking-[0.1em] mb-1">
            {seg.speaker}
          </span>
        )}
        <p className={`font-sans text-[10px] sm:text-xs md:text-sm leading-relaxed ${isActive ? 'text-slate-900 font-semibold' : 'text-slate-700'}`}>{seg.text}</p>
      </div>
    </motion.div>
  );
};

const ResultItem = ({ res, idx, currentTime, setCurrentTime, isSpeaking, setIsSpeaking, playingAudio, toggleOriginalAudio }: any) => {
  const transcriptRef = React.useRef<HTMLDivElement>(null);
  
  return (
    <div key={idx} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="flex flex-col lg:flex-row items-stretch border-b border-slate-100">
            {/* Video Box */}
            <div className="w-full lg:w-2/5 xl:w-[350px] shrink-0 bg-black flex items-center justify-center p-0 lg:border-r border-slate-100 flex-none h-[250px] min-h-[250px] max-h-[250px] lg:h-[350px] lg:min-h-[350px] lg:max-h-[350px] relative">
                <ReelPreview 
                  url={res.instagram_url} 
                  videoUrl={res.video_url} 
                  onProgress={(t) => setCurrentTime((prev: any) => ({ ...prev, [res.instagram_url]: t }))}
                />
            </div>

            {/* Transcript Box */}
            <div className="flex-1 flex flex-col overflow-hidden flex-none h-[250px] min-h-[250px] max-h-[250px] lg:h-[350px] lg:min-h-[350px] lg:max-h-[350px] bg-white">
                {/* Transcript Header */}
                <div className="p-3 md:p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-brand-indigo/10 rounded-lg text-brand-indigo">
                        <FileText size={16} />
                      </div>
                      <div>
                        <h4 className="font-display font-semibold text-slate-900 text-sm">Neural Transcript</h4>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium mt-0.5">Diarization Active</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                       {res.transcript_confidence && (
                         <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-1 rounded-md font-bold flex items-center gap-1">
                           <CheckCircle2 size={12} /> {((res.transcript_confidence || 0) * 100).toFixed(1)}% Acc
                         </span>
                       )}
                    </div>
                </div>
                
                {/* Transcript body */}
                <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 styled-scrollbar relative">
                    {res.status === 'FAILED' ? (
                      <div className="p-6 bg-rose-50 border border-rose-100 rounded-xl text-rose-500 mt-2">
                        <div className="flex items-center gap-3 mb-3 text-rose-600">
                          <AlertCircle size={24} />
                          <h4 className="font-bold text-sm uppercase tracking-[0.1em]">
                            {res.error?.includes('Quota') ? 'AI Quota Exceeded' : res.error?.includes('API Key') ? 'Authentication Missing' : 'Extraction Failed'}
                          </h4>
                        </div>
                        <p className="text-sm leading-relaxed italic opacity-90">{res.error || 'The neural bridge was severed by remote protocols.'}</p>
                      </div>
                    ) : (
                      <>
                        {res.segments && res.segments.length > 0 ? (
                          <div className="space-y-2">
                            <AnimatePresence>
                              {res.segments.map((seg: any, i: number) => {
                                const currentT = currentTime[res.instagram_url] || 0;
                                const startT = Number(seg.start) || 0;
                                const endT = Number(seg.end) || 0;
                                const isActive = currentT >= startT && currentT <= endT;
                                return <SegmentItem key={seg.id || i} seg={seg} i={i} isActive={isActive} containerRef={transcriptRef} />;
                              })}
                            </AnimatePresence>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-12 text-slate-400 h-full">
                            {res.status === 'TRANSCRIBING' ? (
                              <div className="flex flex-col items-center gap-6">
                                <Loader2 className="animate-spin text-brand-indigo" size={32} />
                                <div className="text-center">
                                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-indigo mb-1">Processing</p>
                                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">Translating Frequency Data...</p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm font-light italic leading-relaxed text-slate-500 text-center max-w-sm">
                                {res.transcript || 'No transcript generated.'}
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                </div>
            </div>
        </div>

        {/* Bottom row: Metadata */}
        <div className="p-4 md:p-5 flex flex-col md:flex-row items-center md:items-stretch gap-4 md:gap-6 bg-slate-50/50">
           
           {/* Publisher Info */}
           <div className="flex flex-col w-full md:w-[250px] shrink-0 border-b md:border-b-0 md:border-r border-slate-200/50 pb-4 md:pb-0 md:pr-6 justify-center">
             <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  {res.channel_thumbnail ? (
                    <img src={res.channel_thumbnail} alt={res.owner_username} className="w-8 h-8 rounded-full object-cover border border-slate-200" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-brand-indigo/10 text-brand-indigo flex items-center justify-center font-bold text-base">
                      {res.owner_username?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      <a href={res.channel_url} target="_blank" rel="noreferrer" className="hover:text-brand-indigo">@{res.owner_username || 'unknown'}</a>
                    </p>
                    <p className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">{res.posted_at ? new Date(res.posted_at).toLocaleDateString() : 'Realtime'}</p>
                  </div>
                </div>
             </div>
             
             <div className="flex gap-2 w-full">
                <div className="flex-1 bg-white p-2 rounded-lg border border-slate-100 text-center shadow-sm">
                   <p className="text-[8px] text-slate-400 uppercase tracking-widest font-bold mb-0.5">Views</p>
                   <p className="text-xs font-display font-bold text-slate-700">{res.video_view_count?.toLocaleString() || '-'}</p>
                </div>
                <div className="flex-1 bg-white p-2 rounded-lg border border-slate-100 text-center shadow-sm">
                   <p className="text-[8px] text-slate-400 uppercase tracking-widest font-bold mb-0.5">Likes</p>
                   <p className="text-xs font-display font-bold text-brand-purple">{res.likes_count?.toLocaleString() || '-'}</p>
                </div>
             </div>
           </div>

           {/* Caption & Analysis Insight */}
           <div className="flex-1 w-full flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-200/50 pb-4 md:pb-0 md:px-6">
             {res.summary ? (
               <div className="mb-4">
                 <h5 className="text-[9px] font-bold text-brand-indigo uppercase tracking-widest mb-1 flex items-center gap-1">
                   <CheckCircle2 size={10} /> AI Summary & Sentiment
                 </h5>
                 <p className="text-xs text-slate-800 font-medium leading-relaxed mb-1">{res.summary}</p>
                 <span className={`inline-block text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${res.sentiment?.toLowerCase().includes('positive') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : res.sentiment?.toLowerCase().includes('negative') ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                   {res.sentiment || 'Neutral'}
                 </span>
                 {res.keywords && res.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                     {res.keywords.map((kw: string) => (
                       <span key={kw} className="text-[8px] font-semibold text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded">
                         {kw}
                       </span>
                     ))}
                    </div>
                 )}
               </div>
             ) : null}
             
             <div className="pt-2 border-t border-slate-100/50">
               <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Original Caption</h5>
               <CaptionText text={res.caption} />
               {res.hashtags && res.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                   {res.hashtags.map((tag: string) => (
                     <span key={tag} className="text-[8px] font-bold text-brand-indigo px-1.5 py-0.5 bg-brand-indigo/5 rounded border border-brand-indigo/10 uppercase tracking-wider">#{tag}</span>
                   ))}
                  </div>
               )}
             </div>
           </div>
           
           {/* Controls */}
           <div className="w-full md:w-[150px] shrink-0 flex flex-col justify-center gap-2">
             <div className="bg-white p-2 text-center rounded-lg border border-slate-100 flex items-center justify-between mb-1 shadow-sm">
               <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Lang</span>
               <span className="text-[10px] font-bold text-slate-700">{res.detected_language || 'Detecting'}</span>
             </div>
             <div className="flex gap-2 w-full">
               <button 
                 onClick={() => speakText(res.transcript, !!isSpeaking[res.instagram_url], (val) => setIsSpeaking((prev: any) => ({...prev, [res.instagram_url]: val})))}
                 className={`flex-1 py-2 rounded-lg transition-all flex flex-col items-center justify-center gap-1 text-[8px] font-bold uppercase tracking-wider border ${
                   isSpeaking[res.instagram_url] 
                     ? 'bg-brand-indigo text-white border-brand-indigo' 
                     : 'bg-white text-slate-600 border-slate-200 hover:border-brand-indigo hover:text-brand-indigo'
                 }`}
               >
                 {isSpeaking[res.instagram_url] ? <VolumeX size={12} /> : <Volume2 size={12} />}
                 Play
               </button>
               {res.audio_file && (
                 <button 
                   onClick={() => toggleOriginalAudio(res.instagram_url)}
                   className={`flex-1 py-2 rounded-lg transition-all flex flex-col items-center justify-center gap-1 text-[8px] font-bold uppercase tracking-wider border ${
                     playingAudio[res.instagram_url] 
                       ? 'bg-brand-purple text-white border-brand-purple' 
                       : 'bg-white text-slate-600 border-slate-200 hover:border-brand-purple hover:text-brand-purple'
                   }`}
                 >
                   {playingAudio[res.instagram_url] ? <Pause size={12} /> : <Play size={12} />}
                   Source
                 </button>
               )}
             </div>
           </div>

        </div>
    </div>
  );
};

const Results = ({ jobId, onReset }: { jobId: string, onReset: () => void }) => {
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transcribing, setTranscribing] = useState<Record<string, boolean>>({});
  const [isSpeaking, setIsSpeaking] = useState<Record<string, boolean>>({});
  const [playingAudio, setPlayingAudio] = useState<Record<string, boolean>>({});
  const [currentTime, setCurrentTime] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!jobId) return;
    const fetchJob = async () => {
      try {
        const response = await axios.get(`/api/results/${jobId}`);
        const jobData = response.data;
        setJob(jobData);
        
        if (jobData.status === 'DONE' || jobData.status === 'FAILED') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Error fetching job:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
    const interval = setInterval(fetchJob, 3000);
    return () => clearInterval(interval);
  }, [jobId, transcribing]);

  const toggleOriginalAudio = (url: string) => {
    const audio = document.getElementById(`audio-${url}`) as HTMLAudioElement;
    if (!audio) return;

    if (playingAudio[url]) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlayingAudio(prev => ({ ...prev, [url]: !prev[url] }));
  };

  if (loading && !job) return (
    <div className="flex flex-col items-center justify-center py-32 w-full">
      <Loader2 className="animate-spin text-brand-indigo mb-6 shadow-sm" size={40} />
      <h3 className="text-lg font-display font-bold text-slate-900 mb-2">Analyzing Media</h3>
      <p className="text-sm text-slate-500 font-medium">Downloading telemetry and processing via Neural Engine...</p>
    </div>
  );

  if (!job) return (
    <div className="flex flex-col items-center justify-center py-32 w-full text-center">
      <AlertCircle className="text-rose-500 mb-6 shadow-sm" size={40} />
      <h3 className="text-lg font-display font-bold text-slate-900 mb-2">Extraction Not Found</h3>
      <p className="text-sm text-slate-500 font-medium mb-6">The specified extraction job could not be retrieved from the database.</p>
      <button onClick={onReset} className="px-6 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg font-bold uppercase tracking-widest text-xs transition-colors">Go Back</button>
    </div>
  );

  return (
    <div id="results-panel" className="w-full max-w-5xl space-y-8 pb-32 md:pb-12 text-slate-900">
      <div className="glass-effect rounded-2xl p-4 shadow-sm border border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="p-2.5 bg-brand-indigo/10 rounded-xl border border-brand-indigo/20">
            <Instagram size={28} className="text-brand-indigo" />
          </div>
          <div>
            <h3 className="text-xl font-display font-bold text-slate-900 tracking-tighter">Extraction Report</h3>
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
              <JobStatusBadge status={job.status} />
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-[0.2em] truncate w-24 sm:w-auto">{jobId}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={onReset}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-brand-indigo/10 hover:bg-brand-indigo/20 text-brand-indigo border border-brand-indigo/30 rounded-xl transition-all text-[10px] font-bold uppercase tracking-widest whitespace-nowrap" 
          >
             New Extraction
          </button>
          
          <div className="flex items-center gap-1">
            <select
              className="bg-slate-100/50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest px-3 py-2 outline-none focus:border-brand-indigo/30 transition-all cursor-pointer"
              onChange={(e) => {
                if (e.target.value) {
                  exportFormat(job, e.target.value);
                  e.target.value = "";
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Export As...</option>
              <option value="csv">CSV (Spreadsheet)</option>
              <option value="json">JSON (Raw Data)</option>
              <option value="txt">TXT (Format)</option>
              <option value="srt">SRT (Subtitles)</option>
              <option value="vtt">VTT (Web Video)</option>
            </select>
          </div>

        </div>
      </div>

      <div className="space-y-12">
        {job.results.length === 0 && (job.status === 'PENDING' || job.status === 'PROCESSING') && (
          <div className="flex flex-col items-center justify-center py-24 glass-effect rounded-2xl border border-slate-200">
            <Loader2 className="animate-spin text-brand-indigo mb-6 shadow-sm" size={40} />
            <h3 className="text-xl font-display font-bold text-slate-900 mb-2">Engaging Neural Network</h3>
            <p className="text-sm text-slate-500 font-medium">Downloading telemetry and analyzing frequency waves...</p>
          </div>
        )}
        {job.results.length === 0 && job.status === 'FAILED' && (
          <div className="flex flex-col items-center justify-center py-24 glass-effect rounded-2xl border border-rose-200/50 bg-rose-50/30">
            <AlertCircle className="text-rose-500 mb-6" size={40} />
            <h3 className="text-xl font-display font-bold text-slate-900 mb-2">Extraction Failed</h3>
            <p className="text-sm text-slate-500 font-medium">Could not retrieve video or metadata from Instagram.</p>
          </div>
        )}
        {job.results.map((res: any, idx: number) => (
          <ResultItem
            key={idx}
            idx={idx}
            res={res}
            currentTime={currentTime}
            setCurrentTime={setCurrentTime}
            isSpeaking={isSpeaking}
            setIsSpeaking={setIsSpeaking}
            playingAudio={playingAudio}
            toggleOriginalAudio={toggleOriginalAudio}
          />
        ))}
      </div>
    </div>
  );
};

const SearchTab = ({ onSelectJob }: { onSelectJob: (jobId: string) => void }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setHasSearched(true);
    try {
      const response = await axios.get('/api/search', { params: { q: query } });
      setResults(response.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 md:space-y-8">
       <form onSubmit={handleSearch} className="glass-effect rounded-2xl p-2 md:p-3 shadow-xl flex flex-col sm:flex-row items-center ring-[4px] md:ring-[8px] ring-white/2">
          <Search className="md:ml-4 text-slate-400 hidden md:block" size={20} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Neural search across global transcripts..."
            className="flex-1 w-full px-4 py-3 md:py-4 bg-transparent focus:outline-none text-slate-900 font-bold text-sm md:text-lg placeholder:text-slate-400 md:placeholder:text-slate-500 text-center sm:text-left"
          />
          <button type="submit" disabled={loading} className="w-full sm:w-auto bg-brand-indigo text-white px-6 md:px-8 py-3 md:py-4 rounded-xl font-bold uppercase tracking-[0.2em] hover:bg-brand-indigo/90 transition-all shadow-lg neon-glow-indigo active:scale-95 disabled:opacity-50 text-xs md:text-sm mt-2 sm:mt-0">
            {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Query DB'}
          </button>
       </form>

       <div className="space-y-4">
         {hasSearched && results.length === 0 && !loading && (
           <p className="text-center text-slate-500 font-medium py-12">No matching structural patterns found in the database.</p>
         )}
         {results.map((res: any, idx) => (
           <div key={idx} onClick={() => onSelectJob(res.job_id)} className="glass-effect rounded-2xl p-6 border border-slate-200 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:border-brand-indigo/30 hover:shadow-lg transition-all">
             <div className="flex items-center gap-4 text-left w-full sm:w-auto min-w-0">
               {res.thumbnail_url ? (
                 <img src={res.thumbnail_url} alt="thumbnail" className="w-16 h-16 rounded-xl object-cover" referrerPolicy="no-referrer" />
               ) : (
                 <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                   <Instagram size={24} />
                 </div>
               )}
               <div className="min-w-0 flex-1">
                 <h3 className="text-sm font-bold text-slate-900 truncate flex items-center gap-2 mb-1">
                   {res.owner_username ? `@${res.owner_username}` : 'Instagram Reel'}
                   <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wider">{res.detected_language}</span>
                 </h3>
                 <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{res.transcript || res.summary || 'No transcript text available'}</p>
               </div>
             </div>
             <ChevronRight className="text-slate-400 shrink-0 hidden sm:block" />
           </div>
         ))}
       </div>
    </div>
  );
};

const HistoryTab = ({ onSelectJob }: { onSelectJob: (jobId: string) => void }) => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await axios.get('/api/jobs');
        setJobs(response.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="animate-spin text-brand-indigo mb-6 shadow-sm" size={40} />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="glass-effect rounded-2xl shadow-2xl overflow-hidden mt-6">
        <div className="px-8 py-32 text-center bg-slate-50">
           <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-inner border border-slate-200/50">
             <History size={40} className="text-slate-700" />
           </div>
           <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.4em] italic mb-2">Satellite Scan Empty</p>
           <p className="text-slate-600 text-sm font-light">No historical data found in local storage modules.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-6">
      {jobs.map(job => (
        <div key={job.id} onClick={() => onSelectJob(job.id)} className="glass-effect rounded-2xl p-6 shadow-sm border border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer hover:border-brand-indigo/30 hover:bg-brand-indigo/5 transition-all group">
          <div className="flex items-center gap-4 text-left">
            <div className="p-2.5 bg-slate-100 rounded-xl border border-slate-200 group-hover:bg-brand-indigo/10 group-hover:border-brand-indigo/20 transition-all text-slate-500 group-hover:text-brand-indigo">
              {job.type === 'single' ? <Instagram size={20} /> : job.type === 'bulk' ? <Layers size={20} /> : <Upload size={20} />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight capitalize flex items-center gap-2">
                 {job.type} Process
                 <JobStatusBadge status={job.status} />
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-[0.1em]">{job.id.split('-')[0]}</span>
                <span className="text-[10px] text-slate-400">•</span>
                <span className="text-[10px] text-slate-400 font-medium">{new Date(job.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
             <div className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 uppercase tracking-widest group-hover:bg-brand-indigo group-hover:text-white transition-all">
               View Report <ChevronRight size={14} className="inline ml-1" />
             </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('single');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [bulkUrls, setBulkUrls] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJobSuccess = (jobId: string) => {
    setCurrentJobId(jobId);
    setActiveTab('results');
  };

  const handleBulkSubmit = async () => {
    const urls = bulkUrls.split('\n').map(u => u.trim()).filter(u => u);
    if (urls.length === 0) return;

    setLoading(true);
    try {
      const response = await axios.post('/api/process/bulk', { urls });
      handleJobSuccess(response.data.job_id);
      setBulkUrls('');
    } catch (err) {
      alert('Failed to start bulk processing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="app-container" className="flex flex-col md:flex-row h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-indigo/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-brand-purple/10 blur-[120px]" />
        </div>

        <header id="header" className="h-20 px-6 md:px-12 bg-slate-50/40 backdrop-blur-md border-b border-slate-200/50 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
             <div className="md:hidden w-10 h-10 bg-brand-indigo rounded-xl flex items-center justify-center text-slate-900 neon-glow-indigo">
               <Instagram size={20} />
             </div>
             <div>
               <h1 className="text-xl font-display font-bold text-slate-900 tracking-tight">
                 {activeTab === 'results' ? 'Transcription Feed' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
               </h1>
               <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                 <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">System Ready</span>
               </div>
             </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-3 bg-slate-100/50 px-4 py-2 rounded-full border border-slate-200">
              <Mic size={14} className="text-brand-indigo" />
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Neural Listening Active</span>
            </div>
            <button className="p-3 bg-slate-100/50 text-slate-400 rounded-2xl hover:bg-white/10 hover:text-slate-900 transition-all border border-slate-200">
               <Settings size={20} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center no-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-5xl"
            >
              {activeTab === 'single' && <SingleURL onSuccess={handleJobSuccess} />}
              {activeTab === 'results' && currentJobId && <Results jobId={currentJobId} onReset={() => setActiveTab('single')} />}
              {activeTab === 'bulk' && (
                <div id="bulk-panel" className="max-w-4xl mx-auto w-full glass-effect rounded-xl md:rounded-2xl p-6 md:p-8 shadow-xl md:shadow-2xl relative overflow-hidden">
                  {loading && (
                    <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center">
                        <div className="relative">
                          <div className="absolute inset-0 bg-brand-purple/20 blur-2xl rounded-full scale-150 animate-pulse" />
                          <Loader2 className="animate-spin text-brand-purple relative z-10 block mx-auto" size={40} />
                        </div>
                        <p className="text-xs md:text-sm font-bold uppercase tracking-[0.4em] text-brand-purple mt-6 mb-2">Deploying Swarm...</p>
                        <p className="text-[9px] md:text-[10px] text-slate-600 uppercase font-bold tracking-widest text-center px-6">Queueing multiple jobs to Neural Engine</p>
                    </div>
                  )}
                  <div className="mb-6 md:mb-8 text-center sm:text-left">
                    <h2 className="text-lg md:text-2xl font-display font-bold text-slate-900 tracking-tighter mb-2 md:mb-4">Parallel Ingestion</h2>
                    <p className="text-slate-400 text-sm md:text-base font-light leading-relaxed">Massive scale extraction. Deploy worker threads to process multiple Reels simultaneously with localized translation.</p>
                  </div>
                  
                  <textarea
                    id="bulk-urls-textarea"
                    placeholder="https://www.instagram.com/reel/ID1/&#10;https://www.instagram.com/reel/ID2/"
                    className="w-full h-40 md:h-48 p-4 md:p-6 bg-slate-100/50 border border-slate-200 rounded-xl md:rounded-2xl mb-6 md:mb-8 focus:ring-4 focus:ring-brand-indigo/10 focus:border-brand-indigo focus:outline-none text-sm md:text-sm font-mono leading-relaxed text-slate-700 placeholder:text-slate-400 transition-all shadow-inner"
                    onChange={(e) => setBulkUrls(e.target.value)}
                    value={bulkUrls}
                  ></textarea>
                  
                  <button
                    id="bulk-submit-btn"
                    onClick={handleBulkSubmit}
                    disabled={loading || !bulkUrls.trim()}
                    className="w-full py-4 bg-brand-purple text-white font-bold uppercase tracking-[0.2em] md:tracking-[0.2em] rounded-xl md:rounded-2xl hover:bg-brand-purple/90 shadow-xl md:shadow-2xl shadow-brand-purple/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 md:gap-4 text-xs md:text-sm active:scale-[0.98]"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <><Layers size={18} className="md:w-5 md:h-5" /> Execute Batch Deploy</>}
                  </button>
                </div>
              )}
              {activeTab === 'profile' && (
                <div className="glass-effect rounded-xl md:rounded-2xl p-8 md:p-12 shadow-xl md:shadow-2xl text-center max-w-2xl mx-auto w-full relative overflow-hidden">
                  {loading && (
                    <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center">
                        <Loader2 className="animate-spin text-brand-indigo mb-4" size={40} />
                        <p className="text-xs md:text-sm font-bold uppercase tracking-[0.4em] text-brand-indigo mt-6 mb-2">Deploying Crawler...</p>
                    </div>
                  )}
                  <div className="absolute top-0 left-0 w-full h-1.5 md:h-2 bg-gradient-to-r from-brand-indigo via-brand-purple to-brand-blue" />
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-brand-indigo/20 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-6 md:mb-8 shadow-inner border border-brand-indigo/30">
                    <Upload className="text-brand-indigo" size={28} />
                  </div>
                  <h3 className="text-lg md:text-2xl font-display font-bold text-slate-900 mb-2 md:mb-4 tracking-tight">Profile Crawler</h3>
                  <p className="text-slate-400 text-sm md:text-base mb-6 md:mb-8 leading-relaxed max-w-lg mx-auto font-light">Deep scan public profiles. Automatically identify, download, and transcribe the entire media lineage of any target.</p>
                  
                  <div className="flex flex-col gap-3 md:gap-4 max-w-md mx-auto">
                    <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                      <div className="flex-1 relative group">
                         <span className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base md:text-base group-focus-within:text-brand-indigo transition-colors">@</span>
                         <input id="profile-username-input" type="text" placeholder="username" value={bulkUrls} onChange={(e) => setBulkUrls(e.target.value)} className="w-full pl-10 md:pl-10 pr-4 md:pr-4 py-3 md:py-4 bg-slate-100/50 border border-slate-200 rounded-xl md:rounded-xl focus:outline-none focus:ring-4 focus:ring-brand-indigo/10 focus:border-brand-indigo font-bold text-sm md:text-sm text-slate-900 transition-all placeholder:text-slate-400" />
                      </div>
                      <input id="profile-count-input" type="number" min={1} max={100} placeholder="Count (20)" className="w-full sm:w-32 px-4 md:px-4 py-3 md:py-4 bg-slate-100/50 border border-slate-200 rounded-xl md:rounded-xl focus:outline-none focus:ring-4 focus:ring-brand-indigo/10 focus:border-brand-indigo font-bold text-sm md:text-sm text-slate-900 transition-all text-center placeholder:text-slate-400" />
                    </div>
                    <button id="profile-submit-btn" disabled={loading} onClick={async () => {
                      if (!bulkUrls.trim()) return;
                      setLoading(true);
                      try {
                         const countInput = document.getElementById('profile-count-input') as HTMLInputElement;
                         const reel_count = parseInt(countInput.value) || 20;
                         const response = await axios.post('/api/process/profile', { profile: bulkUrls.trim(), reel_count });
                         handleJobSuccess(response.data.job_id);
                         setBulkUrls('');
                      } catch (err) {
                         alert('Failed to start profile processing');
                      } finally {
                         setLoading(false);
                      }
                    }} className="w-full py-4 md:py-5 bg-brand-indigo text-white rounded-xl md:rounded-2xl font-bold uppercase tracking-widest hover:bg-brand-indigo/90 shadow-lg md:shadow-2xl neon-glow-indigo transition-all active:scale-95 disabled:opacity-50 text-xs md:text-sm">Initiate</button>
                  </div>
                </div>
              )}
              {activeTab === 'history' && (
                <div className="w-full max-w-5xl mx-auto space-y-6 md:space-y-10">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 md:gap-6 text-center sm:text-left">
                    <div>
                      <h2 className="text-lg md:text-2xl font-display font-bold text-slate-900 tracking-tighter">Extraction Vault</h2>
                      <p className="text-slate-400 text-sm md:text-lg font-light">Immutable record of previous neural processing cycles.</p>
                    </div>
                  </div>
                  <HistoryTab onSelectJob={handleJobSuccess} />
                </div>
              )}
              {activeTab === 'search' && (
                <SearchTab onSelectJob={handleJobSuccess} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
