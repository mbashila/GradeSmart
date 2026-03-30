# GradeSmart Mobile App

A modern mobile application for teachers to scan, grade, and analyze exam papers using a smartphone. Built with React Native, Expo, and an optional Python backend for robust computer vision grading.

## Features

- **Authentication Flow**: Signup/login, session persistence via Supabase
- **Dashboard**: Create tests, scan papers, and check recent results
- **Test Creation**: Define test name, subject, class, question type, answer key
- **Paper Scanning**: Camera interface with alignment frame, flash toggle, and quality feedback
- **Smart Grading**: OMR for MCQs and optional OCR for written answers
- **Results View**: Score breakdown, per-question answers, and confidence indicators
- **Review & Correction**: Manually adjust scores before saving final results
- **History**: Saved scan history with timestamps and stats
- **Sync**: Local cache + Supabase sync for cross-device access
- **Notifications**: In-app notifications for results and reminders

## Technology Stack

- React Native + Expo
- React Navigation (stack-based app routing)
- Supabase (auth + optional data persistence)
- Expo Camera, Image Picker, Secure Store
- Python FastAPI backend (OpenCV + pytesseract) for OMR/OCR pipelines

## Project Structure

```
GradeSmart/
├── App.js                     # Main entrypoint and navigation setup
├── package.json
├── app.json
├── README.md
├── CONTEXT.md                 # Auto-generated project summary
├── backend/                   # Optional local grading server
│   ├── server.py
│   ├── preprocess.py
│   ├── layout_detection.py
│   ├── omr_detection.py
│   ├── ocr_engine.py
│   ├── written_processing.py
│   ├── requirements.txt
│   └── README.md
└── src/
    ├── components/            # Reusable UI components (Button, Card, Input, etc.)
    ├── screens/               # UI screens (Scan, Results, History, etc.)
    ├── lib/                   # Supabase client and helpers
    ├── theme/                 # Color palette and typography styles
    └── utils/                 # Grading, imageQuality, openaiService, storage helpers
```

## Getting Started

sseract OCR (for backend image pipelines)

### Mobile Setup (Expo)

1. Install dependencies:

```bash
npm install
```

2. Start Expo:

```bash
npm start
```

3. Open app via QR in Expo Go, or run:

```bash
npm run android
npm run ios
npm run web
```

### Backend Setup (optional)

1. `cd backend`
2. Install Python dependencies:

3. Run the API:

```bash
python server.py
```

## Supabase Configuration

Set these values in `app.json` extras or environment variables:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

The app handles token persistence via `expo-secure-store` and chunking for large session data.

## Core Flows

1. User signs in through `AuthContext`.
2. Create a test using `CreateTestScreen`.
3. Scan paper pages in `ScanScreen`, or choose images from gallery.
4. App sends images to backend endpoint (e.g., `/grade-full`) for OMR/OCR.
5. Display results in `ResultsScreen`; allow correction in `ReviewCorrectionScreen`.
6. Save final scan via `ScansContext` and optional Supabase.

## Backend API Summary

- `/health` - status and service versions
- `/preprocess` - deskew and threshold image
- `/detect-layout` - find regions (MCQ/written)
- `/omr` - bubble detection and answer extraction
- `/ocr` - Tesseract text extraction
- `/grade-mcq` - full MCQ pipeline + scoring
- `/grade-written` - written pipeline + OCR
- `/grade-full` - mixed MCQ + written grading

## License

Educational purpose project. Feel free to adapt and extend responsibly.
