'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Clapperboard, MessageSquare, Check, Plus, Trash2, Download, AlertCircle, Film, Type, ChevronLeft, Settings2, MonitorPlay, Volume2, VolumeX, Scissors } from 'lucide-react';
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

interface VideoClip {
    id: string;
    url: string;
    name: string;
    startTime: number; // Trim start (offset in the video file)
    endTime: number;   // Trim end (offset in the video file)
    originalDuration: number;
}

export default function Editor({ track, onBack }: EditorProps) {
    // State
    const [clips, setClips] = useState<VideoClip[]>([]);
    const [activeClipId, setActiveClipId] = useState<string | null>(null);
    
    // Derived state for total visual duration
    const totalVisualDuration = clips.reduce((acc, clip) => acc + (clip.endTime - clip.startTime), 0);

    const [audioDuration, setAudioDuration] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const [subtitles, setSubtitles] = useState<Subtitle[]>(track.subtitles);
    const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'scene' | 'style' | 'subtitles'>('scene');
    const [isExporting, setIsExporting] = useState(false);
    
    // Sync toggle state (must be declared before useEffect that uses it)
    const [isSyncEnabled, setIsSyncEnabled] = useState(true);
    const [editingTimeField, setEditingTimeField] = useState<{index: number, field: 'time' | 'endTime', originalValue: number} | null>(null);

    // Volume State
    const [bgmVolume, setBgmVolume] = useState(0.5);
    const [videoVolume, setVideoVolume] = useState(1);
    const [isBgmMuted, setIsBgmMuted] = useState(false);
    const [isVideoMuted, setIsVideoMuted] = useState(false);

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

    // Track previous audio time to detect stalling
    const lastAudioTimeRef = useRef<number>(0);

    // Refs for render loop to avoid stale closures
    const clipsRef = useRef(clips);
    const subtitlesRef = useRef(subtitles);
    const isPlayingRef = useRef(isPlaying);
    const isExportingRef = useRef(isExporting);
    
    useEffect(() => { clipsRef.current = clips; }, [clips]);
    useEffect(() => { subtitlesRef.current = subtitles; }, [subtitles]);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    useEffect(() => { isExportingRef.current = isExporting; }, [isExporting]);

    // Helper to find active clip and local time
    const getActiveClipInfo = (globalTime: number) => {
        let accumulatedTime = 0;
        for (const clip of clipsRef.current) {
            const duration = clip.endTime - clip.startTime;
            if (globalTime >= accumulatedTime && globalTime < accumulatedTime + duration) {
                return { 
                    clip, 
                    localTime: clip.startTime + (globalTime - accumulatedTime),
                    offsetInTimeline: accumulatedTime
                };
            }
            accumulatedTime += duration;
        }
        return null;
    };

    // Initialize
    useEffect(() => {
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    // Render Loop
    const renderFrame = (timestamp: number) => {
        if (audioRef.current && videoRef.current && canvasRef.current) {
            const rawTime = audioRef.current.currentTime;
            
            // Detect Audio Stalling
            // If isPlaying is true, but rawTime hasn't moved since last frame, audio might be buffering/stalled.
            // However, requestAnimationFrame runs much faster than timeupdate, so rawTime might be same for a few frames.
            // We use a small threshold or check paused state.
            
            // If audio is ended, pause everything
            if (audioRef.current.ended) {
                setIsPlaying(false);
                return;
            }

            const time = rawTime;
            setCurrentTime(time);

            // Manage Clips Playback
            const clipInfo = getActiveClipInfo(time);
            
            if (clipInfo) {
                const { clip, localTime } = clipInfo;
                
                // Switch source if needed
                if (videoRef.current.src !== clip.url) {
                    console.log("Switching clip:", clip.name);
                    videoRef.current.src = clip.url;
                    videoRef.current.load(); 
                    setActiveClipId(clip.id);
                    videoRef.current.currentTime = localTime;
                    
                    if (isPlayingRef.current || isExportingRef.current) {
                        const playPromise = videoRef.current.play();
                        if (playPromise !== undefined) {
                            playPromise.catch(e => {
                                console.warn("Auto-play prevented or interrupted", e);
                            });
                        }
                    }
                }

                // Sync video logic (Improved)
                if (videoRef.current.readyState >= 1 && !videoRef.current.seeking) {
                    const diff = Math.abs(videoRef.current.currentTime - localTime);
                    
                    // Only force sync if:
                    // 1. Drift is significant (> 0.2s)
                    // 2. Audio is actually progressing (rawTime > lastAudioTimeRef.current) OR we just started
                    // This prevents the "Infinite Loop" where audio is stuck at 0, video plays to 0.2, gets reset to 0.
                    const audioIsProgressing = rawTime > lastAudioTimeRef.current || (rawTime === 0 && isPlayingRef.current);
                    
                    if (diff > 0.2 && audioIsProgressing) {
                         // console.log("Syncing video", diff, videoRef.current.currentTime, localTime);
                         videoRef.current.currentTime = localTime;
                    }
                }
                
                // Ensure play state matches
                // Pause video if audio is stalled (not progressing significantly over frames)
                // But simple check: if audioRef.paused is true, video should pause.
                if (audioRef.current.paused && !videoRef.current.paused) {
                    videoRef.current.pause();
                } else if (!audioRef.current.paused && videoRef.current.paused && videoRef.current.readyState >= 3) {
                    videoRef.current.play().catch(() => {});
                }
            } else if (clipsRef.current.length > 0) {
                // End of clips
            }

            // Update refs for next frame
            lastAudioTimeRef.current = rawTime;

            // Find Subtitle based on adjusted time
            const activeSub = subtitlesRef.current.find((sub, index) => {
                if (sub.endTime) {
                    return time >= sub.time && time < sub.endTime;
                }
                // Fallback for legacy data
                const nextSub = subtitlesRef.current[index + 1];
                const endTime = nextSub ? nextSub.time : sub.time + 5; // Default 5s duration
                return time >= sub.time && time < endTime;
            });
            setCurrentSubtitle(activeSub || null);

            // Draw Canvas
            drawCanvas(activeSub || null);

            if (isPlayingRef.current || isExportingRef.current) {
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

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only trigger if not typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            // Spacebar: Play/Pause
            if (e.code === 'Space') {
                e.preventDefault();
                togglePlay();
                return;
            }

            // Arrow Up/Down: Navigate between subtitles or seek to subtitle time
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                
                const currentIndex = subtitles.findIndex(sub => sub.id === selectedSubtitleId);
                let newIndex: number;
                
                if (currentIndex === -1) {
                    // No subtitle selected, select first
                    newIndex = 0;
                } else {
                    newIndex = e.key === 'ArrowDown' 
                        ? Math.min(currentIndex + 1, subtitles.length - 1)
                        : Math.max(currentIndex - 1, 0);
                }
                
                const targetSubtitle = subtitles[newIndex];
                if (targetSubtitle) {
                    setSelectedSubtitleId(targetSubtitle.id);
                    
                    // Shift + Arrow: Seek to subtitle start time
                    if (e.shiftKey && audioRef.current) {
                        audioRef.current.currentTime = targetSubtitle.time;
                        if (!isPlaying) {
                            renderFrame(performance.now());
                        }
                    }
                }
                return;
            }

            // Left/Right arrows: Adjust subtitle timing (only if subtitle is selected)
            if (!selectedSubtitleId) return;

            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const offset = e.key === 'ArrowRight' ? 0.5 : -0.5;
                const isShift = e.shiftKey; // Shift key for End Time, Normal for Start Time
                
                setSubtitles(prev => {
                    const newSubtitles = [...prev];
                    const selectedIndex = newSubtitles.findIndex(sub => sub.id === selectedSubtitleId);
                    
                    if (selectedIndex === -1) return prev;
                    
                    const sub = newSubtitles[selectedIndex];
                    let newTime = sub.time;
                    let newEndTime = sub.endTime || sub.time + 5;
                    const originalEnd = newEndTime;

                    if (isShift) {
                        // Adjust End Time
                        newEndTime = Math.max(newTime + 0.5, newEndTime + offset);
                        
                        // If sync is enabled, shift all following subtitles
                        if (isSyncEnabled) {
                            const delta = newEndTime - originalEnd;
                            for (let i = selectedIndex + 1; i < newSubtitles.length; i++) {
                                newSubtitles[i].time += delta;
                                if (newSubtitles[i].time < 0) newSubtitles[i].time = 0;
                                
                                if (newSubtitles[i].endTime !== undefined) {
                                    newSubtitles[i].endTime += delta;
                                    if (newSubtitles[i].endTime < newSubtitles[i].time + 0.1) {
                                        newSubtitles[i].endTime = newSubtitles[i].time + 0.1;
                                    }
                                }
                            }
                        }
                    } else {
                        // Adjust Start Time
                        newTime = Math.max(0, newTime + offset);
                        if (newTime >= newEndTime) {
                            newEndTime = newTime + 0.5; 
                        }
                    }
                    
                    newSubtitles[selectedIndex] = {
                        ...sub,
                        time: newTime,
                        endTime: newEndTime
                    };
                    
                    return newSubtitles.sort((a, b) => a.time - b.time);
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedSubtitleId, isSyncEnabled, isPlaying, subtitles]);

    // Volume Control Effect (direct DOM control)
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = isBgmMuted ? 0 : bgmVolume;
            audioRef.current.muted = isBgmMuted;
        }
    }, [bgmVolume, isBgmMuted]);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = isVideoMuted ? 0 : videoVolume;
            videoRef.current.muted = isVideoMuted;
        }
    }, [videoVolume, isVideoMuted]);

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
            
            const tempVideo = document.createElement('video');
            tempVideo.src = url;
            tempVideo.onloadedmetadata = () => {
                const duration = tempVideo.duration;
                
                const newClip: VideoClip = {
                    id: Date.now().toString(),
                    url,
                    name: file.name,
                    startTime: 0,
                    endTime: duration,
                    originalDuration: duration
                };

                setClips(prev => [...prev, newClip]);
                
                // Check duration (sum of clips vs audio)
                const totalDuration = clips.reduce((acc, c) => acc + (c.endTime - c.startTime), 0) + duration;
                if (audioRef.current && totalDuration < audioRef.current.duration) {
                    // setError(`Video is too short! Music is ${Math.round(audioRef.current.duration)}s, but video is only ${Math.round(totalDuration)}s.`);
                } else {
                    setError(null);
                }
            };
        }
    };

    const handleClipUpdate = (id: string, updates: Partial<VideoClip>) => {
        setClips(prev => prev.map(clip => {
            if (clip.id === id) {
                // Validate updates
                let newClip = { ...clip, ...updates };
                
                // Ensure start < end
                if (newClip.startTime >= newClip.endTime) {
                    newClip.startTime = clip.startTime; // Revert if invalid
                }
                // Ensure within bounds
                newClip.startTime = Math.max(0, newClip.startTime);
                newClip.endTime = Math.min(newClip.originalDuration, newClip.endTime);
                
                return newClip;
            }
            return clip;
        }));
    };

    const handleClipRemove = (id: string) => {
        setClips(prev => prev.filter(c => c.id !== id));
    };

    const handleExport = async () => {
        if (!canvasRef.current || !audioRef.current || !videoRef.current) return;

        setIsExporting(true);
        setIsPlaying(false); // Stop playback first

        // Reset both audio and video to start, also reset offset handling
        audioRef.current.currentTime = 0;
        videoRef.current.currentTime = 0;


        const stream = canvasRef.current.captureStream(60); // 60 FPS

        // Attach BGM audio track
        const attachTracks = (mediaStream?: MediaStream | null) => {
            if (!mediaStream) return;
            mediaStream.getAudioTracks().forEach(track => {
                stream.addTrack(track);
            });
        };

        try {
            if (audioRef.current?.captureStream) {
                attachTracks(audioRef.current.captureStream());
            } else if ((audioRef.current as any)?.mozCaptureStream) {
                attachTracks((audioRef.current as any).mozCaptureStream());
            } else {
                console.warn("BGM captureStream not supported");
            }
        } catch (e) {
            console.warn("Unable to capture BGM audio", e);
        }

        // Attach video clip audio (if not muted)
        if (!isVideoMuted) {
            try {
                if (videoRef.current?.captureStream) {
                    attachTracks(videoRef.current.captureStream());
                } else if ((videoRef.current as any)?.mozCaptureStream) {
                    attachTracks((videoRef.current as any).mozCaptureStream());
                } else {
                    console.warn("Video captureStream not supported");
                }
            } catch (e) {
                console.warn("Unable to capture clip audio", e);
            }
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
            // Trigger one frame render to set up video src if needed
            renderFrame(performance.now());
            if (videoRef.current.src) {
                await videoRef.current.play();
            }
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
            // START 시간 조정: 해당 자막만 변경
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
            // END 시간 조정: 일단 현재 자막만 변경 (다른 자막은 나중에 조정)
            sub.endTime = numValue;
            
            // Ensure start time is valid
            if (sub.time >= numValue) {
                sub.time = numValue - 0.5;
                if (sub.time < 0) sub.time = 0;
            }
        }

        setSubtitles(newSubtitles);
    };

    const handleTimeCommit = (index: number, field: 'time' | 'endTime') => {
        if (field !== 'endTime' || !editingTimeField || !isSyncEnabled) {
            setEditingTimeField(null);
            return;
        }

        const newSubtitles = [...subtitles];
        const sub = newSubtitles[index];
        const currentEnd = sub.endTime ?? (newSubtitles[index + 1]?.time ?? sub.time + 5);
        const originalEnd = editingTimeField.originalValue;
        const delta = currentEnd - originalEnd;

        // 이후 모든 자막을 delta만큼 이동
        if (delta !== 0) {
            for (let i = index + 1; i < newSubtitles.length; i++) {
                newSubtitles[i].time += delta;
                if (newSubtitles[i].time < 0) newSubtitles[i].time = 0;
                
                if (newSubtitles[i].endTime !== undefined) {
                    newSubtitles[i].endTime += delta;
                    if (newSubtitles[i].endTime < newSubtitles[i].time + 0.1) {
                        newSubtitles[i].endTime = newSubtitles[i].time + 0.1;
                    }
                }
            }
            setSubtitles(newSubtitles);
        }

        setEditingTimeField(null);
    };

    const handleTimeFocus = (index: number, field: 'time' | 'endTime') => {
        if (field === 'endTime') {
            const sub = subtitles[index];
            const originalEnd = sub.endTime ?? (subtitles[index + 1]?.time ?? sub.time + 5);
            setEditingTimeField({ index, field, originalValue: originalEnd });
        }
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
                        disabled={isExporting || !!error || clips.length === 0}
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
                                // src set dynamically
                                className="hidden"
                                // muted removed: we handle volume via AudioContext GainNode.
                                // However, to prevent double audio (if not connected to AudioContext yet), we might need caution.
                                // But crossOrigin needs to be set for Web Audio API to work with some sources, though blob: is usually fine.
                                crossOrigin="anonymous"
                                playsInline
                                // loop removed as we manage clips
                            />
                            {clips.length === 0 && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 bg-zinc-900/50 backdrop-blur-sm">
                                    <Film size={48} className="mb-4 opacity-50" />
                                    <p className="text-sm font-medium">No clips loaded</p>
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

                            {/* BGM Volume Controls */}
                            <div className="flex items-center gap-2 group/vol relative">
                                <button 
                                    onClick={() => setIsBgmMuted(!isBgmMuted)}
                                    className={`transition ${isBgmMuted || bgmVolume === 0 ? 'text-zinc-600' : 'text-blue-400 hover:text-blue-300'}`}
                                    title="BGM Volume"
                                >
                                    {isBgmMuted || bgmVolume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                </button>
                                <span className="text-[10px] font-bold text-blue-500/50 absolute -top-2 left-0 w-full text-center pointer-events-none">BGM</span>
                                <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-300 flex items-center">
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={isBgmMuted ? 0 : bgmVolume}
                                        onChange={(e) => {
                                            setBgmVolume(parseFloat(e.target.value));
                                            setIsBgmMuted(parseFloat(e.target.value) === 0);
                                        }}
                                        className="w-20 h-1 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Video Volume Controls */}
                            <div className="flex items-center gap-2 group/vol2 relative ml-2">
                                <button 
                                    onClick={() => setIsVideoMuted(!isVideoMuted)}
                                    className={`transition ${isVideoMuted || videoVolume === 0 ? 'text-zinc-600' : 'text-green-400 hover:text-green-300'}`}
                                    title="Video Sound"
                                >
                                    {isVideoMuted || videoVolume === 0 ? <VolumeX size={18} /> : <Film size={18} />}
                                </button>
                                <span className="text-[10px] font-bold text-green-500/50 absolute -top-2 left-0 w-full text-center pointer-events-none">CLIP</span>
                                <div className="w-0 overflow-hidden group-hover/vol2:w-20 transition-all duration-300 flex items-center">
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={isVideoMuted ? 0 : videoVolume}
                                        onChange={(e) => {
                                            setVideoVolume(parseFloat(e.target.value));
                                            setIsVideoMuted(parseFloat(e.target.value) === 0);
                                        }}
                                        className="w-20 h-1 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-green-500"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 h-8 relative group cursor-pointer" onClick={(e) => {
                                if (audioRef.current) {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const pos = (e.clientX - rect.left) / rect.width;
                                    audioRef.current.currentTime = pos * audioRef.current.duration;
                                    renderFrame(performance.now());
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
                                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Video Clips</h3>
                                    
                                    {/* Clip List */}
                                    <div className="space-y-3 mb-4">
                                        {clips.map((clip, index) => (
                                            <div key={clip.id} className="bg-[#1e1e1e] rounded-lg p-3 border border-zinc-700">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <div className="w-4 h-4 flex items-center justify-center bg-zinc-700 rounded text-[10px] font-mono text-zinc-400 shrink-0">
                                                            {index + 1}
                                                        </div>
                                                        <span className="text-xs font-medium text-zinc-300 truncate" title={clip.name}>
                                                            {clip.name}
                                                        </span>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleClipRemove(clip.id)}
                                                        className="text-zinc-500 hover:text-red-400 transition"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                                
                                                {/* Trim Controls */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[9px] text-zinc-600 uppercase block mb-1">Start (Trim)</label>
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            min="0"
                                                            max={clip.endTime}
                                                            value={clip.startTime}
                                                            onChange={(e) => handleClipUpdate(clip.id, { startTime: parseFloat(e.target.value) })}
                                                            className="w-full bg-black/20 text-[10px] font-mono text-zinc-300 px-1.5 py-1 rounded border border-transparent focus:border-blue-500/50 focus:outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] text-zinc-600 uppercase block mb-1">End (Trim)</label>
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            min={clip.startTime}
                                                            max={clip.originalDuration}
                                                            value={clip.endTime}
                                                            onChange={(e) => handleClipUpdate(clip.id, { endTime: parseFloat(e.target.value) })}
                                                            className="w-full bg-black/20 text-[10px] font-mono text-zinc-300 px-1.5 py-1 rounded border border-transparent focus:border-blue-500/50 focus:outline-none"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="mt-1.5 flex justify-between text-[9px] text-zinc-500">
                                                    <span>Duration: {Math.round((clip.endTime - clip.startTime) * 10) / 10}s</span>
                                                    <span>Total: {Math.round(clip.originalDuration)}s</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-4 border border-dashed border-zinc-700 rounded-lg hover:border-zinc-500 hover:bg-white/5 transition-all text-center group cursor-pointer relative z-10">
                                        <label className="absolute inset-0 cursor-pointer z-20">
                                            <input
                                                type="file"
                                                accept="video/*"
                                                onChange={handleVideoUpload}
                                                className="hidden"
                                            />
                                        </label>
                                        <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform relative z-10 pointer-events-none">
                                            <Plus className="text-zinc-400" size={16} />
                                        </div>
                                        <span className="text-xs font-medium text-zinc-300 block relative z-10 pointer-events-none">Add Video Clip</span>
                                    </div>
                                    
                                    {clips.length > 0 && (
                                        <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
                                            <div className="w-8 h-8 bg-green-500/20 rounded flex items-center justify-center text-green-500">
                                                <Check size={14} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-medium text-green-400 truncate">Sequence Ready</div>
                                                <div className="text-[10px] text-green-500/70">{Math.round(totalVisualDuration)}s total visual duration</div>
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
                                <div className="sticky top-0 z-10 bg-[#1e1e1e] pb-2 pt-1 -mt-1 flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Transcript</h3>
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    checked={isSyncEnabled}
                                                    onChange={(e) => setIsSyncEnabled(e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                            </div>
                                            <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 transition uppercase tracking-wide">
                                                {isSyncEnabled ? 'Sync ON' : 'Sync OFF'}
                                            </span>
                                        </label>
                                    </div>
                                    <button
                                        onClick={() => setSubtitles([...subtitles, { id: Date.now().toString(), time: currentTime, endTime: currentTime + 3, ko: '새 자막', en: 'New Subtitle' }].sort((a, b) => a.time - b.time))}
                                        className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white transition"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {subtitles.map((sub, index) => (
                                        <div 
                                            key={sub.id} 
                                            onClick={() => setSelectedSubtitleId(sub.id)}
                                            className={`group p-3 rounded-lg border transition-all cursor-pointer ${
                                                selectedSubtitleId === sub.id 
                                                    ? 'bg-blue-500/20 border-blue-500/50 ring-1 ring-blue-500/30' 
                                                    : currentSubtitle?.id === sub.id 
                                                        ? 'bg-blue-500/10 border-blue-500/30' 
                                                        : 'bg-[#1e1e1e] border-transparent hover:bg-[#2a2a2a]'
                                            }`}
                                        >
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
                                                            onFocus={() => handleTimeFocus(index, 'endTime')}
                                                            onChange={(e) => handleTimeChange(index, 'endTime', e.target.value)}
                                                            onBlur={() => handleTimeCommit(index, 'endTime')}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleTimeCommit(index, 'endTime');
                                                                    e.currentTarget.blur();
                                                                }
                                                            }}
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
