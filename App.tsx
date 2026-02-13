
import React, { useState, useRef, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { GoogleGenAI } from "@google/genai";
import { 
  analyzeVisual, 
  translateResult, 
  generateSpeech,
  askVisionary
} from './services/geminiService';
import { playPCM } from './services/audioService';
import { extractFramesFromVideo, fileToBase64 } from './services/videoService';
import { 
  AnalysisResult, 
  InputMode, 
  LANGUAGES, 
  VisualInput 
} from './types';

interface Message {
  role: 'user' | 'bot';
  text: string;
}

const QUOTES = [
  "Vision is the art of seeing what is invisible to others. — Jonathan Swift",
  "The only thing worse than being blind is having sight but no vision. — Helen Keller",
  "Eyes are useless when the mind is blind. — Arabic Proverb",
  "The real voyage of discovery consists not in seeking new landscapes, but in having new eyes. — Marcel Proust",
  "Creativity is seeing what others see and thinking what no one else has thought. — Albert Einstein",
  "Vision without action is merely a dream. — Joel A. Barker"
];

const App: React.FC = () => {
  const [view, setView] = useState<'analyzer' | 'documentation'>('analyzer');
  const [inputMode, setInputMode] = useState<InputMode>('upload');
  const [isDetailedMode, setIsDetailedMode] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLiveMonitoring, setIsLiveMonitoring] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'report' | 'technical'>('report');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [currentQuote, setCurrentQuote] = useState('');
  
  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { role: 'bot', text: 'Greetings! I am the Visionary Assistant. Upload media to begin, or ask me anything about visual analysis.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyzerRef = useRef<HTMLElement>(null);
  const liveIntervalRef = useRef<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadingStatuses = [
    "Identifying visual anchors...",
    "Decoding relationships...",
    "Synthesizing 5 distinct perspectives...",
    "Drafting concluding narrative...",
    "Finalizing fidelity metrics..."
  ];

  useEffect(() => {
    // Pick a random quote on mount
    setCurrentQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  }, []);

  useEffect(() => {
    let interval: number;
    if (loading) {
      let i = 0;
      setLoadingStatus(loadingStatuses[0]);
      interval = window.setInterval(() => {
        i = (i + 1) % loadingStatuses.length;
        setLoadingStatus(loadingStatuses[i]);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatOpen]);

  const handleAnalysis = async (input: VisualInput, silent = false) => {
    if (!silent) {
      setLoading(true);
      setActiveTab('report');
    }
    try {
      const initialResult = await analyzeVisual(input, isDetailedMode);
      let finalResult = initialResult;
      if (selectedLang !== 'en') {
        finalResult = await translateResult(initialResult, selectedLang);
      }
      setResult(finalResult);
      
      // Auto-notify bot about new analysis
      setChatMessages(prev => [...prev, { role: 'bot', text: `Analysis complete! I've generated a high-fidelity caption and 5 distinct variants for your ${input.type === 'image' ? 'image' : 'video'}. Feel free to ask me questions about the findings.` }]);
      
      if (!silent) {
        setTimeout(() => {
          analyzerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    } catch (error) {
      console.error(error);
      if (!silent) alert('Analysis failed. Please check your API key or connection.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleChatSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);

    try {
      const botResponse = await askVisionary(userMsg, result);
      setChatMessages(prev => [...prev, { role: 'bot', text: botResponse }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'bot', text: "I'm having trouble connecting to my neural network. Please try again." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    setPreviewImages([`data:image/jpeg;base64,${base64}`]);
    setResult(null);
    handleAnalysis({ type: 'image', data: base64 });
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowPicker(false);
  };

  const onVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const frames = await extractFramesFromVideo(file);
      setPreviewImages(frames.map(f => `data:image/jpeg;base64,${f}`));
      setResult(null);
      handleAnalysis({ type: 'video_frames', data: frames });
    } catch (error) {
      console.error(error);
      setLoading(false);
    } finally {
      if (videoInputRef.current) videoInputRef.current.value = '';
      setShowPicker(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      alert("Camera access denied.");
      setInputMode('upload');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    setIsLiveMonitoring(false);
  };

  const captureFrame = (silent = false) => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      if (!silent) {
        setPreviewImages([`data:image/jpeg;base64,${base64}`]);
        stopCamera();
        handleAnalysis({ type: 'image', data: base64 });
      } else {
        handleAnalysis({ type: 'image', data: base64 }, true);
      }
    }
  };

  const captureLiveVideoSequence = async () => {
    if (videoRef.current && canvasRef.current) {
      setLoading(true);
      setLoadingStatus("Recording visual sequence...");
      const frames: string[] = [];
      const capture = () => {
        const canvas = canvasRef.current!;
        const video = videoRef.current!;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      };

      for (let i = 0; i < 3; i++) {
        frames.push(capture());
        await new Promise(r => setTimeout(r, 1000));
      }

      setPreviewImages(frames.map(f => `data:image/jpeg;base64,${f}`));
      stopCamera();
      handleAnalysis({ type: 'video_frames', data: frames });
    }
  };

  const toggleLiveMonitoring = () => {
    if (isLiveMonitoring) {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
      setIsLiveMonitoring(false);
    } else {
      setIsLiveMonitoring(true);
      captureFrame(true);
      liveIntervalRef.current = window.setInterval(() => captureFrame(true), 15000);
    }
  };

  const handlePickerSelect = (mode: InputMode) => {
    setInputMode(mode);
    setShowPicker(false);
    if (mode === 'upload') {
      setTimeout(() => fileInputRef.current?.click(), 100);
    } else if (mode === 'video') {
      setTimeout(() => videoInputRef.current?.click(), 100);
    } else {
      setTimeout(() => {
        analyzerRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  useEffect(() => {
    if (inputMode === 'camera' || inputMode === 'live') startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [inputMode]);

  const handleSpeech = async (text: string) => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      const pcm = await generateSpeech(text);
      await playPCM(pcm);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSpeaking(false);
    }
  };

  const chartData = result ? [
    { name: 'BLEU', score: Math.round(result.metrics.bleu * 100) },
    { name: 'METEOR', score: Math.round(result.metrics.meteor * 100) },
    { name: 'CIDEr', score: Math.round(result.metrics.cider * 100) },
  ] : [];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied!');
  };

  const RobotIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 100 100" className={className || "w-full h-full p-2"}>
      <defs>
        <linearGradient id="robotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#1d4ed8', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill="white" />
      <rect x="30" y="35" width="40" height="30" rx="15" fill="url(#robotGrad)" />
      <circle cx="40" cy="50" r="4" fill="white" />
      <circle cx="60" cy="50" r="4" fill="white" />
      <path d="M45 60 Q50 65 55 60" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="50" cy="22" r="5" fill="#f59e0b" />
    </svg>
  );

  return (
    <div className="min-h-screen pb-24 bg-[#f8fafc] relative selection:bg-blue-100 font-['Plus_Jakarta_Sans']">
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-100/30 blur-[150px] rounded-full -z-10"></div>
      
      {/* Navbar */}
      <nav className="sticky top-0 z-[100] bg-white/80 backdrop-blur-xl border-b border-slate-200 px-6 md:px-12 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('analyzer')}>
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center text-white shadow-lg">
            <RobotIcon className="w-7 h-7 p-0" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-tighter text-slate-900 leading-none uppercase">Visionary</span>
            <span className="text-[10px] font-bold text-blue-600 uppercase mt-0.5 tracking-widest">AI Audit System</span>
          </div>
        </div>
        <div className="hidden md:flex gap-8 text-[11px] font-black uppercase tracking-widest text-slate-500">
          <button onClick={() => setView('analyzer')} className={view === 'analyzer' ? 'text-blue-600' : 'hover:text-blue-600 transition-colors'}>Analyzer</button>
          <button onClick={() => setView('documentation')} className={view === 'documentation' ? 'text-blue-600' : 'hover:text-blue-600 transition-colors'}>Documentation</button>
        </div>
        <button 
          onClick={() => setShowSupportModal(true)}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all"
        >
          Support
        </button>
      </nav>

      {/* Support Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl relative border border-slate-100">
            <button 
              onClick={() => setShowSupportModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-blue-600">
              <i className="fas fa-headset text-3xl"></i>
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">Contact Support</h2>
            <p className="text-slate-500 text-sm font-medium mb-8">Our neural maintenance team is ready to assist you with any technical inquiries.</p>
            
            <div className="space-y-4">
              <a href="tel:9014853931" className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <i className="fas fa-phone"></i>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Call Us</div>
                  <div className="text-sm font-black text-slate-800 tracking-tight">9014853931</div>
                </div>
              </a>
              <a href="mailto:22331A1241@gmail.com" className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <i className="fas fa-envelope"></i>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Support</div>
                  <div className="text-sm font-black text-slate-800 tracking-tight">22331A1241@gmail.com</div>
                </div>
              </a>
            </div>
            
            <button 
              onClick={() => setShowSupportModal(false)}
              className="w-full mt-8 bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {view === 'analyzer' ? (
        <>
          {/* Hero */}
          <header className="pt-24 pb-16 text-center max-w-5xl mx-auto px-6">
            <h1 className="text-6xl md:text-8xl font-black gradient-text mb-6 tracking-tighter leading-[1.05]">
              Visual Narrative.
            </h1>
            <p className="text-slate-500 text-lg md:text-xl font-medium tracking-tight max-w-2xl mx-auto leading-relaxed mb-10 italic">
              "{currentQuote}"
            </p>
            
            <div className="relative inline-block mb-12">
              <button 
                onClick={() => setShowPicker(!showPicker)}
                className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black text-sm tracking-widest uppercase hover:bg-blue-700 hover:shadow-2xl hover:shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <i className="fas fa-magic text-lg"></i> Upload or Capture
              </button>
              
              {showPicker && (
                <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-[360px] bg-white rounded-3xl shadow-2xl border border-slate-200 p-4 z-[120] animate-in fade-in slide-in-from-top-4">
                  <div className="grid grid-cols-1 gap-2">
                    <button onClick={() => handlePickerSelect('upload')} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors text-left group">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <i className="fas fa-image text-xl"></i>
                      </div>
                      <div className="flex-1">
                        <div className="font-black text-xs uppercase tracking-widest text-slate-800">Image File</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Upload JPG or PNG</div>
                      </div>
                    </button>
                    <button onClick={() => handlePickerSelect('video')} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors text-left group">
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <i className="fas fa-film text-xl"></i>
                      </div>
                      <div className="flex-1">
                        <div className="font-black text-xs uppercase tracking-widest text-slate-800">Video File</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Analyze MP4 frames</div>
                      </div>
                    </button>
                    <div className="h-px bg-slate-100 my-1"></div>
                    <button onClick={() => handlePickerSelect('camera')} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors text-left group">
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                        <i className="fas fa-camera text-xl"></i>
                      </div>
                      <div className="flex-1">
                        <div className="font-black text-xs uppercase tracking-widest text-slate-800">Live Camera</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Single frame snapshot</div>
                      </div>
                    </button>
                    <button onClick={() => handlePickerSelect('live')} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors text-left group">
                      <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-all">
                        <i className="fas fa-video text-xl"></i>
                      </div>
                      <div className="flex-1">
                        <div className="font-black text-xs uppercase tracking-widest text-slate-800">Video Sequence</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Temporal live capture</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Step Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-12 text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
              <div className="flex items-center gap-3"><span className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center">1</span> Media</div>
              <i className="fas fa-chevron-right text-[8px]"></i>
              <div className="flex items-center gap-3"><span className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center">2</span> 5 Captions</div>
              <i className="fas fa-chevron-right text-[8px]"></i>
              <div className="flex items-center gap-3"><span className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center">3</span> Narrative</div>
            </div>
          </header>

          <main id="main-analyzer" className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 px-6">
            {/* Sidebar Controls */}
            <aside className="lg:col-span-4 space-y-10">
              <div className="card-prism rounded-[2.5rem] p-8">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6 text-slate-400">Settings</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Language</label>
                    <div className="relative">
                      <select 
                        value={selectedLang}
                        onChange={(e) => setSelectedLang(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all appearance-none cursor-pointer"
                      >
                        {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                      </select>
                      <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-300"></i>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black text-slate-700 uppercase">Expert Mode</span>
                    <button onClick={() => setIsDetailedMode(!isDetailedMode)} className={`w-10 h-5 rounded-full relative transition-all ${isDetailedMode ? 'bg-blue-600' : 'bg-slate-300'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isDetailedMode ? 'left-5.5' : 'left-0.5'}`}></div>
                    </button>
                  </div>
                </div>
              </div>

              <div className="card-prism rounded-[2.5rem] p-8">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6 text-slate-400">Viewfinder</h2>
                <div className="relative aspect-square bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden">
                  {inputMode === 'camera' || inputMode === 'live' ? (
                    <>
                      <video ref={videoRef} className="w-full h-full object-cover opacity-80" autoPlay muted playsInline />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
                        {inputMode === 'camera' && (
                          <button onClick={() => captureFrame()} className="bg-white text-blue-600 h-14 w-14 rounded-full flex items-center justify-center shadow-xl active:scale-90 transition-transform"><i className="fas fa-camera text-xl"></i></button>
                        )}
                        {inputMode === 'live' && (
                          <button onClick={captureLiveVideoSequence} className="px-6 py-3 bg-white text-blue-600 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-90 transition-transform">Capture Sequence</button>
                        )}
                      </div>
                    </>
                  ) : previewImages.length > 0 ? (
                    <img src={previewImages[0]} alt="Preview" className="w-full h-full object-cover rounded-3xl" />
                  ) : (
                    <div className="text-center p-8">
                      <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-600">
                        <i className="fas fa-image text-2xl"></i>
                      </div>
                      <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Awaiting Media</p>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} onChange={onFileUpload} accept="image/*" className="hidden" />
                  <input type="file" ref={videoInputRef} onChange={onVideoUpload} accept="video/*" className="hidden" />
                </div>
              </div>
            </aside>

            {/* Analysis Result Flow */}
            <section ref={analyzerRef} className="lg:col-span-8 min-h-[700px]">
              {loading ? (
                <div className="card-prism rounded-[3rem] p-20 flex flex-col items-center justify-center h-full text-center">
                  <div className="w-24 h-24 mb-10 relative">
                    <div className="absolute inset-0 border-[8px] border-blue-100 rounded-full"></div>
                    <div className="absolute inset-0 border-[8px] border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <h3 className="text-3xl font-black text-slate-800 uppercase tracking-tight mb-4">{loadingStatus}</h3>
                  <p className="text-slate-400 font-bold text-sm">Decoding visual geometry for narrative synthesis...</p>
                </div>
              ) : result ? (
                <div className="space-y-12 animate-success">
                  {/* Tabs Navigation */}
                  <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit">
                    {(['report', 'technical'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setActiveTab(t)}
                        className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {t === 'report' ? 'The Visionary Report' : 'Technical Data'}
                      </button>
                    ))}
                  </div>

                  {activeTab === 'report' && (
                    <div className="space-y-12">
                      {/* Master Caption */}
                      <div className="card-prism rounded-[3rem] p-12 border-2 border-blue-50 relative overflow-hidden bg-white shadow-xl">
                        <div className="absolute top-0 right-0 p-6 flex gap-2">
                           <button onClick={() => handleSpeech(result.primaryCaption)} className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center hover:scale-110 transition-all shadow-lg">
                             <i className={`fas ${isSpeaking ? 'fa-spinner fa-spin' : 'fa-volume-up'}`}></i>
                           </button>
                           <button onClick={() => copyToClipboard(result.primaryCaption)} className="w-12 h-12 rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-blue-600 flex items-center justify-center hover:scale-110 transition-all">
                             <i className="far fa-copy"></i>
                           </button>
                        </div>
                        <span className="px-5 py-1.5 rounded-full bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest border border-blue-100 inline-block mb-6">Primary Identification</span>
                        <h2 className="text-3xl md:text-5xl font-black text-slate-900 leading-[1.1] tracking-tight pr-24">
                          {result.primaryCaption}
                        </h2>
                      </div>

                      {/* 5 Captions (Perspectives) */}
                      <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 px-4">5 Multi-Modal Perspectives</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {result.variants.map((v, i) => (
                            <div key={i} className="card-prism rounded-[2rem] p-8 group hover:bg-slate-50 transition-all border border-slate-100 flex flex-col justify-between h-full bg-white">
                              <div className="flex justify-between items-center mb-6">
                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Perspective 0{i+1}</span>
                                <div className="flex gap-2">
                                  <button onClick={() => handleSpeech(v)} className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-400 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-all"><i className="fas fa-volume-up text-[10px]"></i></button>
                                  <button onClick={() => copyToClipboard(v)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-300 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all"><i className="far fa-copy text-[10px]"></i></button>
                                </div>
                              </div>
                              <p className="text-sm font-bold text-slate-700 leading-relaxed italic pr-4">"{v}"</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Final Concluding Paragraph */}
                      <div className="card-prism rounded-[3rem] p-16 bg-slate-900 text-white relative overflow-hidden shadow-2xl">
                        <div className="absolute top-[-100px] left-[-100px] w-full h-full bg-blue-500/10 blur-[120px] rounded-full pointer-events-none"></div>
                        <div className="relative z-10">
                          <div className="flex justify-between items-center mb-10">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-400">Concluding Narrative</h3>
                            <button onClick={() => handleSpeech(result.narrative)} className="w-14 h-14 rounded-2xl bg-white/10 hover:bg-blue-600 text-white flex items-center justify-center transition-all shadow-xl">
                              <i className="fas fa-play"></i>
                            </button>
                          </div>
                          <p className="text-2xl md:text-3xl font-medium leading-[1.6] opacity-90 font-serif italic mb-10 pr-10">"{result.narrative}"</p>
                          <div className="flex items-center gap-4">
                            <div className="h-px flex-1 bg-white/10"></div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/30 italic">Generated by Visionary Engine</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'technical' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="card-prism rounded-[2.5rem] p-10 space-y-8 bg-white">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Metadata Extraction</h3>
                        <div className="space-y-6">
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-3">Detected Actions</span>
                            <div className="flex flex-wrap gap-2">
                              {result.metadata.actions.map(a => <span key={a} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase border border-blue-100">{a}</span>)}
                            </div>
                          </div>
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-3">Dominant Color Palette</span>
                            <div className="flex flex-wrap gap-2">
                              {result.metadata.colors.map(c => <span key={c} className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-[9px] font-black border border-slate-100 uppercase">{c}</span>)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="card-prism rounded-[2.5rem] p-10 bg-white">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-10">Fidelity Benchmarking</h3>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontWeight="800" axisLine={false} tickLine={false} />
                              <YAxis domain={[0, 100]} hide />
                              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', fontSize: '12px' }} />
                              <Bar dataKey="score" radius={[12, 12, 0, 0]} barSize={36}>
                                {chartData.map((e, idx) => <Cell key={`c-${idx}`} fill={['#3b82f6', '#4f46e5', '#f59e0b'][idx]} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="card-prism rounded-[3rem] p-24 h-full flex flex-col items-center justify-center text-center bg-white border border-slate-100 shadow-inner">
                  <div className="w-40 h-40 bg-slate-50 rounded-[4rem] shadow-xl mb-12 flex items-center justify-center relative group">
                    <div className="absolute inset-0 bg-blue-100/40 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <i className="fas fa-eye-slash text-6xl text-blue-100 relative z-10"></i>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">Neural Processor Idle</h3>
                  <p className="text-slate-400 font-bold max-w-sm mx-auto text-sm leading-relaxed mb-10">Upload media to generate your 5 perspectives and final narrative summary.</p>
                  <button onClick={() => setShowPicker(true)} className="text-blue-600 font-black text-[10px] uppercase tracking-widest hover:underline transition-all">Start Analysis</button>
                </div>
              )}
            </section>
          </main>
        </>
      ) : (
        <div className="max-w-4xl mx-auto pt-20 pb-40 px-6">
          <div className="card-prism rounded-[3rem] p-12 md:p-20 bg-white">
            <h1 className="text-5xl font-black gradient-text mb-12 uppercase tracking-tighter">Documentation</h1>
            <p className="text-slate-600 text-lg leading-relaxed font-medium mb-12">Visionary AI is engineered to provide a comprehensive visual audit. Every result includes 5 distinct stylistic captions and a linear concluding paragraph, all synthesized via the Gemini 3 Pro engine.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              {[
                { t: '5 PERSPECTIVES', d: 'Creative, Technical, Social, Minimal, and Detailed captions per capture.' },
                { t: 'CONCLUDING NARRATIVE', d: 'A cohesive paragraph synthesizing the visual context into prose.' },
                { t: 'VOICE SYNTHESIS', d: 'High-fidelity audio generation for every single caption variant.' },
                { t: 'TEMPORAL DATA', d: 'Extract meaning from video sequences or live camera streams.' }
              ].map((it, idx) => (
                <div key={idx} className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <h4 className="font-black text-slate-800 uppercase tracking-tight mb-3 text-xs">{it.t}</h4>
                  <p className="text-slate-500 text-sm font-medium leading-relaxed">{it.d}</p>
                </div>
              ))}
            </div>

            {/* Support Info Card in Documentation */}
            <div className="p-10 bg-blue-600 rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl">
              <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-white/10 blur-[80px] rounded-full"></div>
              <div className="relative z-10">
                <h3 className="text-2xl font-black uppercase tracking-tight mb-4">Contact & Technical Support</h3>
                <p className="opacity-80 text-sm font-medium mb-8 max-w-lg leading-relaxed">For direct technical assistance or business inquiries regarding Visionary AI, please reach out to our core development team.</p>
                <div className="flex flex-wrap gap-8">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Phone</div>
                    <div className="text-lg font-black tracking-tight">9014853931</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Email</div>
                    <div className="text-lg font-black tracking-tight">22331A1241@gmail.com</div>
                  </div>
                </div>
              </div>
            </div>

            <button onClick={() => setView('analyzer')} className="mt-16 bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl">Back to analyzer</button>
          </div>
        </div>
      )}

      {/* Floating Action Buttons */}
      <div className="fixed bottom-10 right-10 flex flex-col gap-4 z-[200]">
        {result && !loading && view === 'analyzer' && (
          <button 
            onClick={() => { setResult(null); setPreviewImages([]); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="bg-slate-900 text-white h-16 w-16 rounded-2xl shadow-2xl flex items-center justify-center hover:bg-blue-600 hover:scale-110 transition-all"
            title="New Analysis"
          >
            <i className="fas fa-plus text-xl"></i>
          </button>
        )}
      </div>

      {/* Chatbot Interface */}
      <div className="fixed bottom-10 left-10 z-[200]">
        {isChatOpen ? (
          <div className="w-[380px] h-[550px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                  <RobotIcon className="w-6 h-6 p-0" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest">Visionary Assist</h4>
                  <span className="text-[9px] font-bold opacity-60 uppercase tracking-widest">Neural Support</span>
                </div>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="text-white/60 hover:text-white transition-colors">
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-xs font-medium leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-100"></div>
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleChatSubmit} className="p-4 bg-white border-t border-slate-100 flex gap-2">
              <input 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask me about the analysis..."
                className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
              <button 
                type="submit"
                disabled={isChatLoading}
                className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg hover:bg-indigo-600 transition-all active:scale-90 disabled:opacity-50"
              >
                <i className="fas fa-paper-plane text-xs"></i>
              </button>
            </form>
          </div>
        ) : (
          <button 
            onClick={() => setIsChatOpen(true)}
            className="w-20 h-20 bg-white rounded-[2rem] shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group relative border border-slate-100"
          >
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-[9px] font-black border-2 border-white animate-bounce">!</div>
            <RobotIcon className="w-12 h-12 p-1" />
          </button>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-40 py-24 border-t border-slate-200 text-center">
        <div className="max-w-[1440px] mx-auto px-6 flex flex-col gap-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-center">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center"><RobotIcon className="w-5 h-5 p-0" /></div>
              <span className="text-lg font-black tracking-tighter text-slate-900 uppercase">Visionary</span>
            </div>
            <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.5em]">Visionary Systems &copy; 2026</p>
            <div className="flex justify-center md:justify-end gap-8 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <button className="hover:text-slate-900">Privacy</button>
              <button className="hover:text-slate-900">Terms</button>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-10 py-8 border-t border-slate-100">
             <div className="flex items-center gap-3">
                <i className="fas fa-phone text-blue-600"></i>
                <span className="text-xs font-black text-slate-800">9014853931</span>
             </div>
             <div className="flex items-center gap-3">
                <i className="fas fa-envelope text-blue-600"></i>
                <span className="text-xs font-black text-slate-800">22331A1241@gmail.com</span>
             </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
