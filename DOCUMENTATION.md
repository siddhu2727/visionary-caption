
# Visionary AI - Project Documentation

## 1. Project Overview
Visionary is a state-of-the-art web application designed to bridge the gap between visual pixels and human-like narrative. Utilizing the Google Gemini 3 series, it performs deep structural analysis of images and video frames to generate context-aware, accurate, and multi-lingual captions.

## 2. Core Features
- **Multi-Modal Input:** 
    - Standard Image Upload (JPG, PNG, WebP).
    - Live Camera Capture (Integrated WebRTC).
    - Video Frame Analysis (Temporal extraction at 20%, 50%, and 80% marks).
- **Deep AI Insight:**
    - Primary High-Fidelity Caption generation.
    - 8 Distinct Contextual Variants (Creative, Technical, Social, Minimal, Narrative, Atmospheric, Action, Philosophical).
    - Comprehensive Narrative storytelling.
    - Structural Metadata breakdown (Colors, Mood, Setting, Actions).
- **Advanced Capabilities:**
    - **Detailed Caption Mode:** Focused on clinical and technical precision.
    - **Global Accessibility:** Built-in translation to 12+ languages.
    - **Voice Synthesis:** Text-to-Speech (TTS) using Gemini 2.5 series.
    - **Performance Metrics:** Estimated BLEU, METEOR, and CIDEr scores.
- **Visionary Assistant:** An interactive AI bot to guide users through their analysis.

## 3. Technical Architecture
- **Frontend:** React 19 + Tailwind CSS for a modern, responsive, dashboard UI.
- **Data Visualization:** Recharts for fidelity metric rendering.
- **AI Engine:** Google Gemini API (@google/genai SDK).
- **Models Utilized:**
    - `gemini-3-pro-preview`: Primary engine for high-quality visual reasoning.
    - `gemini-3-flash-preview`: Efficient engine for real-time translation and bot assistant.
    - `gemini-2.5-flash-preview-tts`: Specialized engine for high-quality audio synthesis.

## 4. Implementation Details
- **Schema-First AI:** Uses strict response schemas to ensure valid JSON output.
- **Memory Efficiency:** Samples video frames to provide temporal context.
- **PCM Audio Decoding:** Custom implementation for 24kHz raw PCM data.

## 5. Deployment & Configuration
- **API Key:** Managed via `process.env.API_KEY`.
- **Permissions:** Requires `camera` access.
