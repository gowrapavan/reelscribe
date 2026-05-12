import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import fs from 'fs';
import { Segment, Word } from './models.ts';

export async function transcribeAudio(audioPath: string, language?: string | null): Promise<{
  transcript: string;
  detected_language: string;
  segments: Segment[];
  words: Word[];
  confidence: number;
  summary?: string;
  sentiment?: string;
  keywords?: string[];
}> {
  const openAIKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!openAIKey && !geminiKey) {
    throw new Error("Neither OPENAI_API_KEY nor GEMINI_API_KEY is set in .env");
  }

  // Try OpenAI first if available
  if (openAIKey) {
    try {
      const openai = new OpenAI({ apiKey: openAIKey });
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["segment", "word"],
        language: language || undefined,
      });

      return {
        transcript: transcription.text,
        detected_language: (transcription as any).language || 'Auto',
        segments: transcription.segments?.map((s: any) => ({
          id: s.id,
          start: s.start,
          end: s.end,
          text: s.text,
          speaker: 'Speaker'
        })) || [],
        words: transcription.words?.map((w: any) => ({
          start: w.start,
          end: w.end,
          word: w.word,
          confidence: 0.99
        })) || [],
        confidence: 0.95,
      };
    } catch (error: any) {
      console.warn("OpenAI transcription failed or quota exceeded.", error?.message);
      if (!geminiKey) {
        if (error?.message?.includes("Incorrect API key")) {
           throw new Error("Invalid OpenAI API Key. Please add a valid OPENAI_API_KEY to your .env file.");
        }
        if (error?.status === 429 || error?.message?.includes("quota")) {
           throw new Error("OpenAI API Quota Exceeded. You have exceeded your current quota. Please check your plan and billing details at platform.openai.com.");
        }
        throw error;
      }
      console.log("Falling back to Gemini...");
    }
  }

  if (!geminiKey) {
    throw new Error("Cannot fallback, GEMINI_API_KEY is not set.");
  }

  // Fallback to Gemini
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const audioData = fs.readFileSync(audioPath).toString("base64");

  const prompt = `Transcribe the following audio precisely. 
  Include speaker labels if there are multiple speakers.
  Identify speakers simply as "MAN 1", "WOMAN 1", "MAN 2", etc., based on their voice characteristics. Do NOT attempt to guess specific names.
  Detect the primary language of the audio and provide the English TRANSLATION if it's not English.
  
  CRITICAL INSTRUCTION: You MUST include the PRECISE start and end timestamps in seconds (e.g. 1.5, 3.2) for every segment. Listen to the audio and mark the exact time each segment is spoken. DO NOT output 0.0 for every segment!

  Please provide the response in JSON format with the following structure:
  {
    "transcript": "full text here (translated to English if necessary)",
    "detected_language": "English",
    "summary": "Brief 1-3 sentence summary of the content",
    "sentiment": "Positive/Negative/Neutral/etc",
    "keywords": ["key", "words", "here"],
    "segments": [
      { "id": 0, "start": 0.5, "end": 2.3, "text": "...", "speaker": "MAN 1" },
      { "id": 1, "start": 2.5, "end": 4.1, "text": "...", "speaker": "WOMAN 1" }
    ],
    "confidence": 0.95
  }`;

  let attempt = 0;
  const maxAttempts = 8;

  while (attempt < maxAttempts) {
    try {
      const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { text: prompt },
        { inlineData: { data: audioData, mimeType: "audio/mp3" } }
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    let responseText = response.text || '{}';
    // Remove markdown json block if present
    if (responseText.startsWith('\`\`\`json')) {
      responseText = responseText.substring(7);
      if (responseText.endsWith('\`\`\`')) {
         responseText = responseText.substring(0, responseText.length - 3);
      }
    } else if (responseText.startsWith('\`\`\`')) {
      responseText = responseText.substring(3);
      if (responseText.endsWith('\`\`\`')) {
         responseText = responseText.substring(0, responseText.length - 3);
      }
    }

    const result = JSON.parse(responseText);

    return {
      transcript: result.transcript !== undefined ? result.transcript : (response.text || ''),
      detected_language: result.detected_language || 'Auto',
      segments: result.segments || [],
      words: [], 
      confidence: result.confidence || 0.9,
      summary: result.summary,
      sentiment: result.sentiment,
      keywords: result.keywords,
    };
  } catch (error: any) {
    attempt++;
    const isAuthError = error?.message?.includes("API key not valid");
    const isRateLimit = error?.message?.includes("429") || error?.message?.includes("503") || error?.message?.includes("high demand");
    
    if (attempt >= maxAttempts || isAuthError) {
      if (isAuthError) {
         throw new Error(`Invalid Gemini API Key. The AI Studio platform injected a proxy key or your Settings -> Secrets "GEMINI_API_KEY" might be set to an invalid placeholder (like "MY_GEMINI_API_KEY"). Please remove the secret or use a valid Google AI Studio key.`);
      }
      throw new Error(`Gemini API Error: ${error?.message || String(error)}`);
    }
    
    const delayMs = isRateLimit ? (attempt * 10000 + Math.floor(Math.random() * 5000)) : (attempt * 3000 + Math.floor(Math.random() * 2000));
    console.warn(`Gemini API error (attempt ${attempt}): ${error?.message}. Retrying in ${delayMs}ms...`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  }
  
  throw new Error("Failed to transcribe after maximum retries.");
}

