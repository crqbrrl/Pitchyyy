import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set. AI features will not work.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export type Verdict = "HARD PASS" | "SKEPTICAL" | "INTRIGUED" | "EXCITED" | "ALL IN";

export interface VCReaction {
  vcName: string;
  verdict: Verdict;
  summary: string;
  scores: { label: string; score: number }[];
  pros: string[];
  cons: string[];
  toughQuestion: string;
  tailoringTips: string[];
  error?: string;
}

export async function analyzePitch(vcName: string, pitch: string): Promise<VCReaction> {
  const model = "gemini-3.1-pro-preview";
  
  const prompt = `
    You are Pitchyyy, an AI that predicts exactly how a specific VC will react to a startup pitch.
    
    VC Name: ${vcName}
    Startup Pitch: ${pitch}
    
    Step 1: Research this VC using Google Search. Look for:
    - Their investment thesis and stage (Seed, Series A, etc.)
    - Recent portfolio companies
    - Public statements, tweets, blog posts
    - What they look for in founders and markets
    - Their specific "pet peeves" or things they hate
    
    Step 2: Respond AS that VC would. Be specific, direct, and honest.
    
    Return the response in JSON format with the following structure:
    {
      "vcName": "Full Name of the VC",
      "summary": "One-line summary of the verdict",
      "scores": [
        { "label": "Criterion 1 (specific to this VC)", "score": 8 },
        ... (4-5 criteria)
      ],
      "pros": ["Specific thing they'd love 1", "Specific thing they'd love 2"],
      "cons": ["Specific objection 1", "Specific objection 2"],
      "toughQuestion": "The single toughest question they'd ask",
      "tailoringTips": ["Change 1", "Change 2"],
      "error": "Only include this field if you cannot find enough information about the VC to provide a realistic simulation."
    }
    
    Rules:
    - Reference real portfolio companies or quotes if possible.
    - Be dense and specific.
    - Ensure all text in the JSON response has proper spaces between words and is grammatically correct.
    - If you can't find enough info, set the "error" field with a helpful message.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
    },
  });

  try {
    const data = JSON.parse(response.text || "{}");
    if (data.error) {
      throw new Error(data.error);
    }

    // Calculate verdict based on average of scores
    const scores = data.scores || [];
    const average = scores.length > 0 
      ? scores.reduce((acc: number, s: any) => acc + s.score, 0) / scores.length 
      : 0;

    let calculatedVerdict: Verdict = "HARD PASS";
    if (average >= 9) calculatedVerdict = "ALL IN";
    else if (average >= 7) calculatedVerdict = "EXCITED";
    else if (average >= 5) calculatedVerdict = "INTRIGUED";
    else if (average >= 3) calculatedVerdict = "SKEPTICAL";
    else calculatedVerdict = "HARD PASS";

    return {
      ...data,
      verdict: calculatedVerdict
    } as VCReaction;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    if (error instanceof Error) throw error;
    throw new Error("Failed to analyze pitch. Please try again.");
  }
}

export async function extractPitchFromImage(base64Image: string, mimeType: string): Promise<string> {
  const model = "gemini-3.1-pro-preview";
  
  const prompt = "Analyze this pitch deck slide and extract the key information into a concise elevator pitch. Focus on the problem, solution, and value proposition shown.";

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { text: prompt },
        { inlineData: { data: base64Image, mimeType } }
      ]
    },
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
    }
  });

  return response.text || "";
}
