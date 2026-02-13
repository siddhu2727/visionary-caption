
import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { AnalysisResult, VisualInput } from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const analyzeVisual = async (input: VisualInput, isMedical: boolean): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const systemInstruction = `You are Visionary, a high-fidelity visual auditor and master storyteller. 
  ${isMedical ? "The user has flagged this as medical imagery. Be clinically precision-oriented, objective, and use formal medical terminology." : "Analyze the provided visual data for context, deep narrative, and technical details."}
  Provide your output strictly in JSON format. Ensure captions are evocative and accurate.`;

  const visualParts = Array.isArray(input.data) 
    ? input.data.map(d => ({ inlineData: { data: d, mimeType: 'image/jpeg' } }))
    : [{ inlineData: { data: input.data, mimeType: 'image/jpeg' } }];

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        ...visualParts,
        { text: "Perform a deep structural analysis. Provide a primary caption, exactly 5 distinct contextual variants (captions) of different styles (Creative, Technical, Social Media, Minimalist, and Detailed), followed by a comprehensive concluding narrative paragraph that ties everything together. Also include a structural breakdown of metadata (colors, mood, setting, actions, objects, sceneType) and estimate performance metrics (BLEU, METEOR, CIDEr)." }
      ]
    },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          primaryCaption: { type: Type.STRING },
          variants: { 
            type: Type.ARRAY,
            items: { type: Type.STRING },
            minItems: 5,
            maxItems: 5
          },
          narrative: { type: Type.STRING },
          metadata: {
            type: Type.OBJECT,
            properties: {
              colors: { type: Type.ARRAY, items: { type: Type.STRING } },
              mood: { type: Type.STRING },
              setting: { type: Type.STRING },
              actions: { type: Type.ARRAY, items: { type: Type.STRING } },
              objects: { type: Type.ARRAY, items: { type: Type.STRING } },
              sceneType: { type: Type.STRING }
            },
            required: ["colors", "mood", "setting", "actions", "objects", "sceneType"]
          },
          metrics: {
            type: Type.OBJECT,
            properties: {
              bleu: { type: Type.NUMBER },
              meteor: { type: Type.NUMBER },
              cider: { type: Type.NUMBER }
            },
            required: ["bleu", "meteor", "cider"]
          }
        },
        required: ["primaryCaption", "variants", "narrative", "metadata", "metrics"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const translateResult = async (result: AnalysisResult, targetLang: string): Promise<AnalysisResult> => {
  if (targetLang === 'en') return result;

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Translate the following JSON object's text values to ${targetLang}. Preserve all JSON keys and structural integrity.
    JSON: ${JSON.stringify(result)}`,
    config: {
      responseMimeType: "application/json"
    }
  });

  return JSON.parse(response.text || "{}");
};

export const generateSpeech = async (text: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Speak clearly and at a natural pace: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio generated");
  return base64Audio;
};

export const askVisionary = async (query: string, resultContext: AnalysisResult | null): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const contextText = resultContext 
    ? `The user has analyzed an image/video. Here are the results: 
       Primary Caption: ${resultContext.primaryCaption}
       Variants: ${resultContext.variants.join(", ")}
       Narrative: ${resultContext.narrative}
       Metadata: ${JSON.stringify(resultContext.metadata)}
       Fidelity Metrics: ${JSON.stringify(resultContext.metrics)}`
    : "No analysis has been performed yet.";

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `You are the Visionary Assistant, a helpful AI guide for the Visionary Image & Video Analysis app.
    Context of current session: ${contextText}
    User Query: ${query}
    Provide a concise, helpful, and technically insightful answer.`,
  });

  return response.text || "I'm sorry, I couldn't process that request.";
};
