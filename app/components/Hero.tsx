'use client';

import { useState, useRef } from 'react';
import { Music, Upload, Loader2, FileText, ArrowRight, Play } from 'lucide-react';
import { DEMO_TRACKS, Track } from '../lib/mockData';

interface HeroProps {
    onSelectTrack: (track: Track) => void;
    onUpload: (audioFile: File, processedData?: any) => void;
}

export default function Hero({ onSelectTrack, onUpload }: HeroProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [lyricsFile, setLyricsFile] = useState<File | null>(null);

    const audioInputRef = useRef<HTMLInputElement>(null);
    const lyricsInputRef = useRef<HTMLInputElement>(null);

    const handleProcess = async () => {
        if (!audioFile) return;

        setIsProcessing(true);
        try {
            const formData = new FormData();
            formData.append('audio', audioFile);
            if (lyricsFile) {
                formData.append('lyrics', lyricsFile);
            }

            const response = await fetch('/api/process-audio', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Processing failed');

            const data = await response.json();
            onUpload(audioFile, data);
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to process audio. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[90vh] px-6 text-center max-w-6xl mx-auto pt-32 pb-20">
            <div className="space-y-6 mb-16 animate-fade-in-up">
                <h1 className="text-6xl md:text-8xl font-semibold tracking-tighter text-black dark:text-white">
                    Cinematic <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-400 dark:to-violet-400">
                        Translation
                    </span>
                </h1>
                <p className="text-xl md:text-2xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto font-medium leading-relaxed">
                    Transform your music into a cinematic experience with AI-synchronized subtitles.
                </p>
            </div>

            <div className="w-full max-w-3xl glass-panel rounded-3xl p-8 md:p-12 animate-fade-in-up [animation-delay:200ms] transition-all duration-500 hover:shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Audio Input */}
                    <button
                        onClick={() => audioInputRef.current?.click()}
                        className={`group relative flex flex-col items-center justify-center p-8 rounded-2xl border transition-all duration-300 ${audioFile
                            ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                            : 'bg-gray-50/50 border-gray-200 dark:bg-white/5 dark:border-white/10 hover:bg-gray-100/50 dark:hover:bg-white/10'
                            }`}
                    >
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${audioFile ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' : 'bg-white dark:bg-white/10 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 shadow-sm'
                            }`}>
                            <Music className="w-8 h-8" />
                        </div>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                            {audioFile ? 'Audio Selected' : 'Upload Audio'}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                            {audioFile ? audioFile.name : 'MP3, WAV, or M4A'}
                        </span>
                        <input
                            ref={audioInputRef}
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && setAudioFile(e.target.files[0])}
                        />
                    </button>

                    {/* Lyrics Input */}
                    <button
                        onClick={() => lyricsInputRef.current?.click()}
                        className={`group relative flex flex-col items-center justify-center p-8 rounded-2xl border transition-all duration-300 ${lyricsFile
                            ? 'bg-green-50/50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                            : 'bg-gray-50/50 border-gray-200 dark:bg-white/5 dark:border-white/10 hover:bg-gray-100/50 dark:hover:bg-white/10'
                            }`}
                    >
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${lyricsFile ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' : 'bg-white dark:bg-white/10 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 shadow-sm'
                            }`}>
                            <FileText className="w-8 h-8" />
                        </div>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                            {lyricsFile ? 'Lyrics Selected' : 'Upload Lyrics'}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                            {lyricsFile ? lyricsFile.name : 'Optional .txt or .lrc'}
                        </span>
                        <input
                            ref={lyricsInputRef}
                            type="file"
                            accept=".txt,.lrc"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && setLyricsFile(e.target.files[0])}
                        />
                    </button>
                </div>

                <button
                    onClick={handleProcess}
                    disabled={!audioFile || isProcessing}
                    className="w-full py-5 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-300 flex items-center justify-center gap-3"
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="animate-spin" />
                            Processing Audio...
                        </>
                    ) : (
                        <>
                            Generate Project <ArrowRight size={20} />
                        </>
                    )}
                </button>
            </div>

            {/* Demo Section */}
            {DEMO_TRACKS.length > 0 && (
                <div className="mt-16 w-full max-w-3xl animate-fade-in-up [animation-delay:400ms]">
                    <div className="text-center mb-6">
                        <h3 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
                            Or Try Demo
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {DEMO_TRACKS.map((track) => (
                            <button
                                key={track.id}
                                onClick={() => onSelectTrack(track)}
                                className="group relative flex items-center gap-6 p-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <img
                                    src={track.coverUrl}
                                    alt={track.title}
                                    className="w-20 h-20 rounded-xl object-cover shadow-lg"
                                />
                                <div className="flex-1 text-left">
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                                        {track.title}
                                    </h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {track.artist}
                                    </p>
                                </div>
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 text-white group-hover:bg-blue-500 transition-colors">
                                    <Play size={20} fill="currentColor" className="ml-0.5" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
