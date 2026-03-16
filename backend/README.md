# GradeSmart Grading Server

Python FastAPI server with OpenCV for real image processing, OMR bubble detection, and OCR.

## Requirements

- Python 3.9+
- Tesseract OCR installed on your system

## Setup

### 1. Install Tesseract OCR

**Windows:**
- Download installer from: https://github.com/UB-Mannheim/tesseract/wiki
- Install and add to PATH (default: `C:\Program Files\Tesseract-OCR`)

**macOS:**
```bash
brew install tesseract
```

**Linux:**
```bash
sudo apt install tesseract-ocr
```

### 2. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Run the server

```bash
python server.py
```

Or with uvicorn directly:
```bash
uvicorn server:app --host 0.0.0.0 --port 8100 --reload
```

The server runs on **port 8100** (Ollama uses 11434, so no conflict).

### 4. Verify

Open http://localhost:8100/docs for the interactive API docs.

Check health: `GET http://localhost:8100/health`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server status + OpenCV/Tesseract versions |
| POST | `/preprocess` | Image preprocessing (deskew, perspective, threshold) |
| POST | `/detect-layout` | Detect MCQ/written/header regions |
| POST | `/omr` | MCQ bubble detection |
| POST | `/ocr` | Text extraction (Tesseract) |
| POST | `/grade-mcq` | Full MCQ pipeline: preprocess → layout → OMR → grade |
| POST | `/grade-written` | Full written pipeline: preprocess → layout → OCR |
| POST | `/grade-full` | Combined MCQ + written pipeline |

## How it works

```
Phone captures image
  → POST /grade-mcq or /grade-written or /grade-full
  → Server preprocesses with OpenCV (grayscale, deskew, perspective transform)
  → Server detects layout (MCQ regions, written regions)
  → Server runs OMR on bubble regions (contour detection, fill analysis)
  → Server runs Tesseract OCR on written regions
  → Returns structured JSON with answers, scores, text, confidence
  → Phone displays results for teacher review
```

## Network Access

The server binds to `0.0.0.0:8100` so your phone can reach it over WiFi.
Find your PC's IP with `ipconfig` (Windows) or `ifconfig` (Mac/Linux).
The app will connect to `http://<your-pc-ip>:8100`.
