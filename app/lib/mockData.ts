export type Subtitle = {
    id: string;
    time: number; // seconds
    endTime?: number; // seconds (optional, for precise duration)
    ko: string;
    en: string;
};

export type SubtitleStyle = {
    id: string;
    name: string;
    fontFamily: string;
    fontSize: string;
    color: string;
    position: 'bottom' | 'center' | 'top';
    textShadow: string;
};

export type Scene = {
    id: string;
    name: string;
    videoUrl: string;
    thumbnailUrl: string;
    tags: string[];
};

export type Track = {
    id: string;
    title: string;
    artist: string;
    coverUrl: string;
    videoUrl: string;
    subtitles: Subtitle[];
};

export const SCENES: Scene[] = [
    {
        id: 'la-la-land',
        name: 'Romantic City Night',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', // Placeholder
        thumbnailUrl: 'https://upload.wikimedia.org/wikipedia/en/e/e2/La_La_Land_%28film%29.png',
        tags: ['Romantic', 'Night', 'City'],
    },
    {
        id: 'interstellar',
        name: 'Space Journey',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', // Placeholder
        thumbnailUrl: 'https://upload.wikimedia.org/wikipedia/en/b/bc/Interstellar_film_poster.jpg',
        tags: ['Sci-Fi', 'Space', 'Epic'],
    },
    {
        id: 'drive',
        name: 'Night Drive',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', // Placeholder
        thumbnailUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Drive_-_Movie_Poster.jpg/440px-Drive_-_Movie_Poster.jpg', // Placeholder
        tags: ['Neon', 'Drive', 'Dark'],
    },
];

export const SUBTITLE_STYLES: SubtitleStyle[] = [
    {
        id: 'modern',
        name: 'Modern Clean',
        fontFamily: 'var(--font-inter)',
        fontSize: 'text-2xl md:text-4xl',
        color: 'text-white',
        position: 'bottom',
        textShadow: 'drop-shadow-lg',
    },
    {
        id: 'cinematic',
        name: 'Cinematic Yellow',
        fontFamily: 'serif',
        fontSize: 'text-2xl md:text-4xl',
        color: 'text-yellow-400',
        position: 'bottom',
        textShadow: 'drop-shadow-md',
    },
    {
        id: 'minimal',
        name: 'Minimal Black',
        fontFamily: 'sans-serif',
        fontSize: 'text-xl md:text-3xl',
        color: 'text-black bg-white/80 px-2',
        position: 'bottom',
        textShadow: 'none',
    },
];

import demoDataRaw from './demoData.json';

// Type assertion for imported JSON
const demoData = demoDataRaw as {
    title: string;
    videoUrl: string;
    subtitles: Subtitle[];
};

export const DEMO_TRACKS: Track[] = [
    {
        id: 'sugar-demo',
        title: demoData.title,
        artist: 'Maroon 5',
        coverUrl: 'https://upload.wikimedia.org/wikipedia/en/a/a0/Maroon_5_V.png',
        videoUrl: demoData.videoUrl,
        subtitles: demoData.subtitles,
    },
];
