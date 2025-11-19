import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const audioFile = formData.get('audio') as File;
        const lyricsFile = formData.get('lyrics') as File;

        if (!audioFile) {
            return NextResponse.json({ error: 'No audio file uploaded' }, { status: 400 });
        }

        let userLyrics = '';
        if (lyricsFile) {
            userLyrics = await lyricsFile.text();
        }

        // 1. Transcribe Audio (Whisper) - Request Word-Level Timestamps
        console.log('Transcribing audio for timestamps...');
        const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
            response_format: 'verbose_json',
            timestamp_granularities: ['word'],
        });

        // Extract words with timing
        const rawWords = transcription.words?.map((w: any) => ({
            word: w.word,
            start: w.start,
            end: w.end
        })) || [];

        // 2. Smart Alignment & Segmentation (GPT-4)
        console.log('Aligning words and creating subtitles...');
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [
                {
                    role: "system",
                    content: `You are an expert subtitle synchronizer.

                     Input:
                     1. "Raw Words": A JSON array of words with precise start/end times from Whisper. Text may be phonetically approximate.
                     2. "Official Lyrics": The correct text.

                     Your Task:
                     1. **Alignment**: Match the "Official Lyrics" to the "Raw Words" based on phonetic similarity.
                     2. **Grouping (Segmentation)**:
                        - Group the aligned words into short, readable subtitles.
                        - **MAXIMUM 3-5 words per subtitle**.
                        - **MAXIMUM 20 characters per line** (unless a single long word).
                        - Break lines frequently to create a dynamic "music video" feel.
                     3. **Timing**:
                        - **Start Time**: Must be the 'start' of the FIRST word in the group.
                        - **End Time**: Must be the 'end' of the LAST word in the group.
                        - This ensures PERFECT synchronization.
                     4. **Translation**: Translate the English text to **Korean**.

                     Output JSON Format:
                     {
                         "subtitles": [
                             {
                                 "time": number, // Start time of the first word in the group
                                 "endTime": number, // End time of the last word in the group
                                 "en": "string", // Correct text from Official Lyrics
                                 "ko": "string"  // Korean translation
                             }
                         ]
                     }`
                },
                {
                    role: "user",
                    content: `Raw Words: ${JSON.stringify(rawWords)}\n\nOfficial Lyrics: ${userLyrics || "Not provided, rely on raw words."}`
                }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content || '{}');

        // Add IDs to subtitles
        const subtitles = result.subtitles?.map((sub: any, index: number) => ({
            id: index.toString(),
            time: sub.time,
            endTime: sub.endTime,
            en: sub.en,
            ko: sub.ko
        })) || [];

        return NextResponse.json({
            subtitles,
            title: audioFile.name.replace(/\.[^/.]+$/, ""),
        });

    } catch (error) {
        console.error('Error processing audio:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
