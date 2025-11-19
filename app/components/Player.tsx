'use client';

import { useRef, useState, useEffect } from 'react';
import { X, Play, Pause, Maximize, Volume2, VolumeX } from 'lucide-react';
import { Track, Subtitle } from '../lib/mockData';

interface PlayerProps {
    track: Track;
    onClose: () => void;
}

export default function Player({ track, onClose }: PlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [currentSubtitle, setCurrentSubtitle] = useState<Subtitle | null>(null);
    const [isHovering, setIsHovering] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.play().catch(() => {
                setIsPlaying(false);
            });
            setIsPlaying(true);
        }
    }, []);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const time = videoRef.current.currentTime;
            setCurrentTime(time);

            const activeSub = track.subtitles.find((sub, index) => {
                const nextSub = track.subtitles[index + 1];
                const endTime = nextSub ? nextSub.time : sub.time + 4;
                return time >= sub.time && time < endTime;
            });

            setCurrentSubtitle(activeSub || null);
        }
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (videoRef.current) {
            const progressBar = e.currentTarget;
            const rect = progressBar.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = x / rect.width;
            const newTime = percentage * videoRef.current.duration;
            videoRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center animate-scale-in"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {/* Close Button */}
            <button
                onClick={onClose}
                className={`absolute top-6 right-6 z-50 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all duration-300 hover:rotate-90 ${isHovering ? 'opacity-100' : 'opacity-0'}`}
            >
                <X className="w-6 h-6" />
            </button>

            <div className="relative w-full h-full max-w-6xl max-h-[85vh] aspect-video bg-black shadow-2xl rounded-2xl overflow-hidden ring-1 ring-white/10">
                <video
                    ref={videoRef}
                    src={track.videoUrl}
                    className="w-full h-full object-contain"
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={() => setIsPlaying(false)}
                    onClick={togglePlay}
                />

                {/* Subtitles Overlay */}
                <div className="absolute bottom-24 left-0 right-0 text-center px-4 transition-all duration-500 pointer-events-none">
                    {currentSubtitle && (
                        <div className="flex flex-col gap-2 animate-fade-in-up">
                            <p className="text-3xl md:text-5xl font-bold text-white drop-shadow-lg tracking-wide">
                                {currentSubtitle.ko}
                            </p>
                            <p className="text-xl md:text-2xl font-medium text-white/80 drop-shadow-md">
                                {currentSubtitle.en}
                            </p>
                        </div>
                    )}
                </div>

                {/* Controls Overlay */}
                <div
                    className={`absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${isHovering || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
                >
                    {/* Progress Bar */}
                    <div
                        className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer group mb-6"
                        onClick={handleSeek}
                    >
                        <div
                            className="h-full bg-white rounded-full relative group-hover:h-2 transition-all duration-200"
                            style={{ width: `${(currentTime / (videoRef.current?.duration || 1)) * 100}%` }}
                        >
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-8">
                        <button
                            onClick={toggleMute}
                            className="p-2 text-white/70 hover:text-white transition-colors"
                        >
                            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                        </button>

                        <button
                            onClick={togglePlay}
                            className="p-4 bg-white text-black rounded-full hover:scale-105 transition-all shadow-lg hover:shadow-white/20"
                        >
                            {isPlaying ? (
                                <Pause className="w-6 h-6 fill-current" />
                            ) : (
                                <Play className="w-6 h-6 fill-current ml-1" />
                            )}
                        </button>

                        <button className="p-2 text-white/70 hover:text-white transition-colors">
                            <Maximize className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
