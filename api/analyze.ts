import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { input, isMedical } = req.body;

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const systemInstruction = `You are Visionary, a high-fidelity visual auditor and master storyteller.`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        { role: "system", parts: [{ text: systemInstruction }] },
        { role: "user", parts: [{ text: JSON.stringify(input) }] },
      ],
    });

    return res.status(200).json(response);
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Server error",
    });
  }
}
