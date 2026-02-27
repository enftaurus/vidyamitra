# Vidyamitra Frontend

Minimalist classical React UI for the FastAPI backend.

## Features
- Login and Register
- Profile fetch and Resume upload
- Technical / Manager / HR interview rounds
- Coding round with Monaco editor and backend evaluation
- Interview hub with round progress cards
- Cookie-based auth (`withCredentials`)
- Question read-out using browser TTS (`speechSynthesis`)
- Candidate voice input using browser speech-to-text (`SpeechRecognition` / `webkitSpeechRecognition`) with language control

## Setup
1. Open terminal in `frontend`
2. Install dependencies:
   - `npm install`
3. Create env file:
   - copy `.env.example` to `.env`
4. Start app:
   - `npm run dev`

## Environment
- `VITE_API_BASE_URL=http://localhost:8000`

## Backend requirements
- Start backend on `localhost:8000`
- Ensure CORS allows frontend origin and `allow_credentials=True`
- Login endpoint must set `user_id` cookie

## Notes
- Speech recognition works best in Chromium-based browsers.
- If microphone permission is blocked, type answer manually in the textarea.
