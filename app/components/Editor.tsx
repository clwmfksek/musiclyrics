'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Clapperboard, MessageSquare, Check, Plus, Trash2, Download, AlertCircle, Film, Type, ChevronLeft, Settings2, MonitorPlay } from 'lucide-react';
import { Track, Subtitle } from '../lib/mockData';

interface EditorProps {
    track: Track;
    onBack: () => void;
}

interface StyleConfig {
    mainFontSize: number;
    subFontSize: number;
    mainColor: string;
    subColor: string;
    mainY: number; // % from top
    subY: number; // % from bottom
    fontFamily: string;
}

export default function Editor({ track, onBack }: EditorProps) {
    // State
    const [videoUrl, setVideoUrl] = useState<string>('');
    const [videoDuration, setVideoDuration] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const [subtitles, setSubtitles] = useState<Subtitle[]>(track.subtitles);
    const [activeTab, setActiveTab] = useState<'scene' | 'style' | 'subtitles'>('scene');
    const [isExporting, setIsExporting] = useState(false);

    // Style State
    const [styleConfig, setStyleConfig] = useState<StyleConfig>({
        mainFontSize: 48,
        subFontSize: 24,
        mainColor: '#FFFFFF',
        subColor: '#FACC15', // Yellow-400
        mainY: 15, // 15% from top
        subY: 10, // 10% from bottom
        fontFamily: 'Inter, sans-serif'
    });

    // Player State
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>();
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [currentSubtitle, setCurrentSubtitle] = useState<Subtitle | null>(null);

    // Initialize
    useEffect(() => {
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    // Render Loop
    const renderFrame = () => {
        if (audioRef.current && videoRef.current && canvasRef.current) {
            const rawTime = audioRef.current.currentTime;
            // Use rawTime directly for accurate sync
            const time = rawTime;
            setCurrentTime(time);

            // Sync video if drifted (use rawTime for video sync)
            // Only sync if video is ready and playing
            if (videoRef.current.readyState >= 2 && !videoRef.current.paused) {
                if (Math.abs(videoRef.current.currentTime - rawTime) > 0.2) {
                    videoRef.current.currentTime = rawTime;
                }
            }

            // Find Subtitle based on adjusted time
            const activeSub = subtitles.find((sub, index) => {
                if (sub.endTime) {
                    return time >= sub.time && time < sub.endTime;
                }
                // Fallback for legacy data
                const nextSub = subtitles[index + 1];
                const endTime = nextSub ? nextSub.time : sub.time + 5; // Default 5s duration
                return time >= sub.time && time < endTime;
            });
            setCurrentSubtitle(activeSub || null);

            // Draw Canvas
            drawCanvas(activeSub || null);

            if (isPlaying || isExporting) {
                requestRef.current = requestAnimationFrame(renderFrame);
            }
        }
    };

    const drawCanvas = (sub: Subtitle | null) => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        if (video && canvas && ctx) {
            // Clear
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw Video
            // Maintain aspect ratio (cover)
            if (video.readyState >= 2) {
                const vRatio = video.videoWidth / video.videoHeight;
                const cRatio = canvas.width / canvas.height;
                let drawW, drawH, offsetX, offsetY;

                if (vRatio > cRatio) {
                    drawH = canvas.height;
                    drawW = drawH * vRatio;
                    offsetX = (canvas.width - drawW) / 2;
                    offsetY = 0;
                } else {
                    drawW = canvas.width;
                    drawH = drawW / vRatio;
                    offsetX = 0;
                    offsetY = (canvas.height - drawH) / 2;
                }
                ctx.drawImage(video, offsetX, offsetY, drawW, drawH);
            } else {
                // Draw placeholder background if no video
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // Draw Subtitles
            if (sub) {
                ctx.textAlign = 'center';
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                // Main (Korean) - Bottom
                ctx.font = `bold ${styleConfig.mainFontSize}px ${styleConfig.fontFamily}`;
                ctx.fillStyle = styleConfig.mainColor;
                const mainYPos = canvas.height - ((canvas.height * styleConfig.mainY) / 100);
                const maxWidth = canvas.width * 0.9; // 5% padding on each side
                ctx.fillText(sub.ko, canvas.width / 2, mainYPos, maxWidth);

                // Sub (English) - Bottom
                ctx.font = `medium ${styleConfig.subFontSize}px ${styleConfig.fontFamily}`;
                ctx.fillStyle = styleConfig.subColor;
                const subYPos = canvas.height - ((canvas.height * styleConfig.subY) / 100);
                ctx.fillText(sub.en, canvas.width / 2, subYPos, maxWidth);
            }
        }
    };

    // Redraw canvas when style configuration changes (font size, position, colors)
    useEffect(() => {
        if (canvasRef.current && videoRef.current) {
            // Force a redraw with the current subtitle (if any)
            drawCanvas(currentSubtitle);
        }
    }, [styleConfig]);

    // Play/Pause – sync audio & video and start/stop render loop
    useEffect(() => {
        if (isPlaying) {
            requestRef.current = requestAnimationFrame(renderFrame);
            audioRef.current?.play();
            videoRef.current?.play().catch(() => {
                // Video might fail if not loaded, ignore
            });
        } else {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            audioRef.current?.pause();
            videoRef.current?.pause();
        }
    }, [isPlaying]);

    const togglePlay = () => {
        setIsPlaying(!isPlaying);
    };

    const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setVideoUrl(url);

            const tempVideo = document.createElement('video');
            tempVideo.src = url;
            tempVideo.onloadedmetadata = () => {
                setVideoDuration(tempVideo.duration);
                if (audioRef.current && tempVideo.duration < audioRef.current.duration) {
                    setError(`Video is too short! Music is ${Math.round(audioRef.current.duration)}s, but video is only ${Math.round(tempVideo.duration)}s.`);
                } else {
                    setError(null);
                }
            };
        }
    };

    const handleExport = async () => {
        if (!canvasRef.current || !audioRef.current || !videoRef.current) return;

        setIsExporting(true);
        setIsPlaying(false); // Stop playback first

        // Reset both audio and video to start, also reset offset handling
        audioRef.current.currentTime = 0;
        videoRef.current.currentTime = 0;


        const stream = canvasRef.current.captureStream(60); // 60 FPS

        // Safe audio stream capture
        let audioStream: MediaStream | null = null;
        try {
            // @ts-ignore - captureStream is experimental
            if (audioRef.current.captureStream) {
                // @ts-ignore
                audioStream = audioRef.current.captureStream();
                // @ts-ignore
            } else if (audioRef.current.mozCaptureStream) {
                // @ts-ignore
                audioStream = audioRef.current.mozCaptureStream();
            }
        } catch (e) {
            console.warn("Audio capture not supported", e);
        }

        if (audioStream) {
            stream.addTrack(audioStream.getAudioTracks()[0]);
        } else {
            alert("Audio export is not supported in this browser. The video will be silent.");
        }

        const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 8000000 // 8 Mbps for better quality
        });

        const chunks: Blob[] = [];
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${track.title}_cinematic.webm`;
            a.click();
            setIsExporting(false);
            setIsPlaying(false);
        };

        mediaRecorder.start();

        // Start playback for recording
        try {
            await audioRef.current.play();
            await videoRef.current.play();
            requestRef.current = requestAnimationFrame(renderFrame);
        } catch (e) {
            console.error("Playback failed", e);
            setIsExporting(false);
        }

        audioRef.current.onended = () => {
            mediaRecorder.stop();
            audioRef.current!.onended = null;
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    };

    const handleTimeChange = (index: number, field: 'time' | 'endTime', value: string) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;

        const newSubtitles = [...subtitles];
        const sub = newSubtitles[index];

        if (field === 'time') {
            sub.time = numValue;
            // Ensure end time is valid
            if (sub.endTime && sub.endTime <= numValue) {
                sub.endTime = numValue + 0.5;
            }
            // Prevent overlap with previous: shorten previous end time
            if (index > 0) {
                const prev = newSubtitles[index - 1];
                if (prev.endTime && prev.endTime > numValue) {
                    prev.endTime = numValue;
                }
            }
        } else {
            sub.endTime = numValue;
            // Ensure start time is valid
            if (sub.time >= numValue) {
                sub.time = numValue - 0.5;
            }
            // Prevent overlap with next: push next start time
            if (index < newSubtitles.length - 1) {
                const next = newSubtitles[index + 1];
                if (next.time < numValue) {
                    next.time = numValue;
                }
            }
        }
        setSubtitles(newSubtitles);
    };

    return (
        <div className="flex flex-col h-screen bg-[#1e1e1e] text-white overflow-hidden font-sans selection:bg-blue-500/30">
            {/* ... (rest of the component structure remains the same up to the subtitles tab) ... */}
            <audio
                ref={audioRef}
                src={track.videoUrl}
                onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration)}
            />

            {/* Header */}
            <header className="h-14 bg-[#2d2d2d] border-b border-black/20 flex items-center px-4 justify-between shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="font-semibold text-sm text-gray-200">{track.title}</h1>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md font-medium text-xs transition-all ${isExporting ? 'bg-yellow-500/20 text-yellow-500 cursor-wait' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                            }`}
                        onClick={handleExport}
                        disabled={isExporting || !!error || !videoUrl}
                    >
                        {isExporting ? (
                            <>Recording...</>
                        ) : (
                            <>
                                <Download size={14} />
                                Export
                            </>
                        )}
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Left: Preview Area */}
                <div className="flex-1 flex flex-col bg-[#1e1e1e] relative">
                    <div className="flex-1 flex items-center justify-center p-8 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-opacity-5">
                        <div className="relative w-full max-w-5xl aspect-video bg-black shadow-2xl rounded-lg overflow-hidden ring-1 ring-white/5 group">
                            <canvas
                                ref={canvasRef}
                                width={1920}
                                height={1080}
                                className="w-full h-full object-contain"
                            />
                            <video
                                ref={videoRef}
                                src={videoUrl}
                                className="hidden"
                                muted
                                playsInline
                                loop
                            />
                            {!videoUrl && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 bg-zinc-900/50 backdrop-blur-sm">
                                    <Film size={48} className="mb-4 opacity-50" />
                                    <p className="text-sm font-medium">No video loaded</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Timeline / Controls */}
                    <div className="h-32 bg-[#2d2d2d] border-t border-black/20 flex flex-col px-6 py-4 gap-4 shrink-0">
                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-xs justify-center bg-red-500/10 py-1 rounded">
                                <AlertCircle size={12} />
                                {error}
                            </div>
                        )}

                        <div className="flex items-center gap-4">
                            <button onClick={togglePlay} className="w-10 h-10 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition shadow-lg">
                                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                            </button>

                            <div className="text-xs font-mono text-zinc-400 w-12 text-right">
                                {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
                            </div>

                            <div className="flex-1 h-8 relative group cursor-pointer" onClick={(e) => {
                                if (audioRef.current) {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const pos = (e.clientX - rect.left) / rect.width;
                                    audioRef.current.currentTime = pos * audioRef.current.duration;
                                    renderFrame();
                                }
                            }}>
                                {/* Track Background */}
                                <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: `${(currentTime / (audioDuration || 1)) * 100}%` }} />
                                </div>
                                {/* Thumb (visible on hover) */}
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                    style={{ left: `${(currentTime / (audioDuration || 1)) * 100}%`, transform: 'translate(-50%, -50%)' }}
                                />
                            </div>

                            <div className="text-xs font-mono text-zinc-500 w-12">
                                {Math.floor(audioDuration / 60)}:{Math.floor(audioDuration % 60).toString().padStart(2, '0')}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Inspector */}
                <div className="w-[360px] bg-[#252525] border-l border-black/20 flex flex-col shrink-0">
                    <div className="flex border-b border-black/20 p-1 bg-[#2d2d2d]">
                        {[
                            { id: 'scene', icon: MonitorPlay, label: 'Media' },
                            { id: 'style', icon: Settings2, label: 'Style' },
                            { id: 'subtitles', icon: Type, label: 'Text' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex-1 py-2 flex items-center justify-center gap-2 text-xs font-medium rounded-md transition-all ${activeTab === tab.id ? 'bg-[#3d3d3d] text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                                    }`}
                            >
                                <tab.icon size={14} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                        {activeTab === 'scene' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Background Video</h3>
                                    <div className="p-8 border border-dashed border-zinc-700 rounded-lg hover:border-zinc-500 hover:bg-white/5 transition-all text-center group cursor-pointer relative">
                                        <input
                                            type="file"
                                            accept="video/*"
                                            onChange={handleVideoUpload}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                        <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                            <Plus className="text-zinc-400" size={20} />
                                        </div>
                                        <span className="text-sm font-medium text-zinc-300 block">Upload Video</span>
                                        <span className="text-xs text-zinc-500 mt-1 block">MP4, WebM, MOV</span>
                                    </div>
                                    {videoUrl && (
                                        <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
                                            <div className="w-8 h-8 bg-green-500/20 rounded flex items-center justify-center text-green-500">
                                                <Check size={14} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-medium text-green-400 truncate">Video Loaded</div>
                                                <div className="text-[10px] text-green-500/70">{Math.round(videoDuration)}s duration</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'style' && (
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Primary Text (Korean)</h3>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] text-zinc-500 mb-1.5 block">Size</label>
                                                <input
                                                    type="number"
                                                    value={styleConfig.mainFontSize}
                                                    onChange={(e) => setStyleConfig({ ...styleConfig, mainFontSize: Number(e.target.value) })}
                                                    className="w-full bg-[#1e1e1e] border border-zinc-700 text-white rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-zinc-500 mb-1.5 block">Position Y (%)</label>
                                                <input
                                                    type="number"
                                                    value={styleConfig.mainY}
                                                    onChange={(e) => setStyleConfig({ ...styleConfig, mainY: Number(e.target.value) })}
                                                    className="w-full bg-[#1e1e1e] border border-zinc-700 text-white rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-zinc-500 mb-2 block">Color</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {['#FFFFFF', '#000000', '#FACC15', '#EF4444', '#3B82F6', '#10B981'].map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setStyleConfig({ ...styleConfig, mainColor: c })}
                                                        className={`w-6 h-6 rounded-full border border-white/10 transition-transform hover:scale-110 ${styleConfig.mainColor === c ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[#252525]' : ''}`}
                                                        style={{ backgroundColor: c }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-px bg-white/5" />

                                <div>
                                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Secondary Text (English)</h3>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] text-zinc-500 mb-1.5 block">Size</label>
                                                <input
                                                    type="number"
                                                    value={styleConfig.subFontSize}
                                                    onChange={(e) => setStyleConfig({ ...styleConfig, subFontSize: Number(e.target.value) })}
                                                    className="w-full bg-[#1e1e1e] border border-zinc-700 text-white rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-zinc-500 mb-1.5 block">Position Y (%)</label>
                                                <input
                                                    type="number"
                                                    value={styleConfig.subY}
                                                    onChange={(e) => setStyleConfig({ ...styleConfig, subY: Number(e.target.value) })}
                                                    className="w-full bg-[#1e1e1e] border border-zinc-700 text-white rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-zinc-500 mb-2 block">Color</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {['#FFFFFF', '#000000', '#FACC15', '#EF4444', '#3B82F6', '#10B981'].map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setStyleConfig({ ...styleConfig, subColor: c })}
                                                        className={`w-6 h-6 rounded-full border border-white/10 transition-transform hover:scale-110 ${styleConfig.subColor === c ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[#252525]' : ''}`}
                                                        style={{ backgroundColor: c }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'subtitles' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Transcript</h3>
                                    <button
                                        onClick={() => setSubtitles([...subtitles, { id: Date.now().toString(), time: currentTime, endTime: currentTime + 3, ko: '새 자막', en: 'New Subtitle' }].sort((a, b) => a.time - b.time))}
                                        className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white transition"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {subtitles.map((sub, index) => (
                                        <div key={sub.id} className={`group p-3 rounded-lg border border-transparent transition-all ${currentSubtitle?.id === sub.id ? 'bg-blue-500/10 border-blue-500/30' : 'bg-[#1e1e1e] hover:bg-[#2a2a2a]'
                                            }`}>
                                            <div className="flex justify-between items-center mb-2 gap-2">
                                                <div className="flex items-center gap-1.5 flex-1">
                                                    <div className="flex flex-col gap-1 w-20">
                                                        <label className="text-[9px] text-zinc-600 uppercase">Start</label>
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            value={sub.time}
                                                            onChange={(e) => handleTimeChange(index, 'time', e.target.value)}
                                                            className="bg-black/20 text-[10px] font-mono text-zinc-300 px-1.5 py-0.5 rounded border border-transparent focus:border-blue-500/50 focus:outline-none w-full"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1 w-20">
                                                        <label className="text-[9px] text-zinc-600 uppercase">End</label>
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            value={sub.endTime || sub.time + 5}
                                                            onChange={(e) => handleTimeChange(index, 'endTime', e.target.value)}
                                                            className="bg-black/20 text-[10px] font-mono text-zinc-300 px-1.5 py-0.5 rounded border border-transparent focus:border-blue-500/50 focus:outline-none w-full"
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setSubtitles(subtitles.filter(s => s.id !== sub.id))}
                                                    className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity self-end mb-1"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <div className="space-y-1.5">
                                                <input
                                                    value={sub.ko}
                                                    onChange={(e) => setSubtitles(subtitles.map(s => s.id === sub.id ? { ...s, ko: e.target.value } : s))}
                                                    className="w-full bg-transparent text-sm text-white focus:outline-none border-b border-transparent focus:border-zinc-700 placeholder-zinc-600"
                                                    placeholder="Korean text..."
                                                />
                                                <input
                                                    value={sub.en}
                                                    onChange={(e) => setSubtitles(subtitles.map(s => s.id === sub.id ? { ...s, en: e.target.value } : s))}
                                                    className="w-full bg-transparent text-xs text-zinc-400 focus:outline-none border-b border-transparent focus:border-zinc-700 placeholder-zinc-700"
                                                    placeholder="English text..."
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
