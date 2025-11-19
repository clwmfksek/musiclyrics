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
            model: "gpt-4o",
            max_tokens: 16000,
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
                        - Create ONE subtitle for EACH LINE in the Official Lyrics.
                        - Each line from the lyrics should become a separate subtitle.
                        - DO NOT combine multiple lines into one subtitle.
                        - Break lines frequently to create a dynamic "music video" feel.
                     3. **Timing**:
                        - **Start Time**: Must be the 'start' of the FIRST word in that line.
                        - **End Time**: Must be the 'end' of the LAST word in that line.
                        - This ensures PERFECT synchronization.
                     4. **Translation**: Translate the English text to **Korean**.
                     5. **IMPORTANT**: Process ALL lines from the Official Lyrics. Do not stop early.

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

        const completionContent = completion.choices[0].message?.content?.trim();

        if (!completionContent) {
            console.error('Empty response from alignment model');
            return NextResponse.json({ error: 'Failed to align subtitles (empty response)' }, { status: 502 });
        }

        let result;
        try {
            result = JSON.parse(completionContent);
        } catch (parseError) {
            console.error('Failed to parse alignment JSON:', parseError);
            console.error('Model response preview (truncated):', completionContent.slice(0, 2000));
            return NextResponse.json({
                error: 'Failed to align subtitles (invalid JSON response)',
                preview: completionContent.slice(0, 500)
            }, { status: 502 });
        }

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
