import { GoogleGenAI } from "@google/genai";

// Initialize Gemini
// Note: In a real app, ensure API key is available via process.env.API_KEY
// The environment must provide this.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeMarket = async (symbol: string, currentPrice: number, recentTrend: string) => {
  try {
    if (!process.env.API_KEY) {
      throw new Error("API Key not found");
    }

    const model = 'gemini-3-flash-preview';
    const prompt = `
      You are a professional high-frequency trading advisor.
      Analyze the following crypto asset: ${symbol}.
      Current Price: ${currentPrice} USDT.
      Recent Context: ${recentTrend}.
      
      Provide a concise market sentiment analysis (max 3 sentences) and a suggested immediate action (Buy/Sell/Hold) based on general technical analysis principles for this type of volatility.
      
      Format the output as JSON:
      {
        "sentiment": "Bullish/Bearish/Neutral",
        "analysis": "...",
        "action": "LONG" | "SHORT" | "WAIT"
      }
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      sentiment: "Unknown",
      analysis: "Unable to connect to AI advisor at this moment.",
      action: "WAIT"
    };
  }
};