'use client';

import { useState } from 'react';
import Hero from './components/Hero';
import Editor from './components/Editor';
import { Track } from './lib/mockData';

export default function Home() {
    const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    const handleTrackSelect = (track: Track) => {
        setSelectedTrack(track);
        setIsEditorOpen(true);
    };

    const handleFileUpload = (file: File, processedData: any) => {
        // Create a track object from the processed data
        const newTrack: Track = {
            id: Date.now().toString(),
            title: processedData.title || file.name.replace(/\.[^/.]+$/, ""),
            artist: 'Unknown Artist',
            coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=60',
            videoUrl: URL.createObjectURL(file), // Use the uploaded AUDIO file as the source for the audio element
            subtitles: processedData.subtitles || []
        };

        setSelectedTrack(newTrack);
        setIsEditorOpen(true);
    };

    return (
        <main className="min-h-screen flex flex-col bg-white dark:bg-black text-black dark:text-white selection:bg-blue-500/30">
            {isEditorOpen && selectedTrack ? (
                <Editor
                    track={selectedTrack}
                    onBack={() => setIsEditorOpen(false)}
                />
            ) : (
                <>
                    {/* Header / Nav */}
                    <header className="fixed top-0 left-0 right-0 p-6 z-40 flex justify-between items-center">
                        <div className="glass px-4 py-2 rounded-full flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <span className="ml-2 text-sm font-semibold tracking-tight text-gray-900 dark:text-white">
                                CineMusic
                            </span>
                        </div>
                    </header>

                    {/* Main Content */}
                    <Hero
                        onSelectTrack={handleTrackSelect}
                        onUpload={handleFileUpload}
                    />

                    {/* Background Ambient */}
                    <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-50 via-white to-white dark:from-blue-950/30 dark:via-black dark:to-black" />
                    <div className="fixed inset-0 -z-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150" />
                </>
            )}
        </main>
    );
}
