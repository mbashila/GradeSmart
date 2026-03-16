"""
GradeSmart Backend Server
FastAPI + OpenCV grading pipeline

Endpoints:
  GET  /health              — Server status check
  POST /preprocess           — Image preprocessing (grayscale, deskew, threshold)
  POST /detect-layout        — Layout detection (MCQ/written regions)
  POST /omr                  — MCQ bubble detection + grading
  POST /ocr                  — Text extraction from written regions
  POST /grade-mcq            — Full MCQ pipeline (preprocess → OMR → grade)
  POST /grade-written        — Full written pipeline (preprocess → OCR)
  POST /grade-full           — Full pipeline (preprocess → layout → OMR + OCR)

Run: uvicorn server:app --host 0.0.0.0 --port 8100 --reload
"""

import io
import base64
import time

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from preprocess import preprocess_image
from layout_detection import detect_layout, extract_region_image, REGION_MCQ, REGION_WRITTEN
from omr_detection import detect_bubbles, grade_mcq
from written_processing import process_written_regions, clean_written_region
from ocr_engine import ocr_image, ocr_region, check_tesseract

app = FastAPI(
    title="GradeSmart Grading Server",
    description="OpenCV-powered grading pipeline for MCQ and written answer sheets",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def encode_image_to_base64(image):
    """Encode an OpenCV image to base64 JPEG string."""
    _, buffer = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return base64.b64encode(buffer).decode('utf-8')


# ─── Health Check ────────────────────────────────────────────────────

@app.get("/health")
async def health():
    tesseract = check_tesseract()
    return {
        "status": "ok",
        "service": "GradeSmart Grading Server",
        "opencv_version": cv2.__version__,
        "tesseract": tesseract,
    }


# ─── Step 2: Preprocess ─────────────────────────────────────────────

@app.post("/preprocess")
async def preprocess_endpoint(file: UploadFile = File(...)):
    """Preprocess an image: grayscale, deskew, perspective transform, threshold."""
    start = time.time()
    contents = await file.read()
    result = preprocess_image(contents)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Preprocessing failed"))

    return {
        "success": True,
        "paper_found": result["paper_found"],
        "skew_angle": result["skew_angle"],
        "width": result["width"],
        "height": result["height"],
        "processing_time_ms": round((time.time() - start) * 1000),
        "preprocessed_image": encode_image_to_base64(result["enhanced"]),
        "thresh_image": encode_image_to_base64(result["thresh"]),
    }


# ─── Step 3: Layout Detection ───────────────────────────────────────

@app.post("/detect-layout")
async def detect_layout_endpoint(file: UploadFile = File(...)):
    """Detect layout regions (MCQ, written, header, blank) in an answer sheet."""
    start = time.time()
    contents = await file.read()
    preprocessed = preprocess_image(contents)

    if not preprocessed.get("success"):
        raise HTTPException(status_code=400, detail="Preprocessing failed")

    layout = detect_layout(preprocessed)

    return {
        "success": True,
        "regions": layout["regions"],
        "markers": layout["markers"],
        "dividing_lines": layout["dividing_lines"],
        "image_width": layout["image_width"],
        "image_height": layout["image_height"],
        "processing_time_ms": round((time.time() - start) * 1000),
    }


# ─── Step 4: MCQ OMR ────────────────────────────────────────────────

@app.post("/omr")
async def omr_endpoint(
    file: UploadFile = File(...),
    num_questions: int = Form(...),
    num_choices: int = Form(4),
):
    """Detect filled bubbles in an MCQ answer sheet."""
    start = time.time()
    contents = await file.read()
    preprocessed = preprocess_image(contents)

    if not preprocessed.get("success"):
        raise HTTPException(status_code=400, detail="Preprocessing failed")

    # Use full image as MCQ region
    h, w = preprocessed["gray"].shape[:2]
    region_bbox = {"x": 0, "y": 0, "width": w, "height": h}

    result = detect_bubbles(
        preprocessed["thresh"],
        preprocessed["gray"],
        region_bbox,
        num_questions,
        num_choices,
    )

    result["processing_time_ms"] = round((time.time() - start) * 1000)
    return result


# ─── Step 6: OCR ────────────────────────────────────────────────────

@app.post("/ocr")
async def ocr_endpoint(
    file: UploadFile = File(...),
    lang: str = Form("eng"),
):
    """Extract text from an image using Tesseract OCR."""
    start = time.time()
    contents = await file.read()

    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image")

    # Clean the image first
    cleaned = clean_written_region(img)
    if cleaned is None:
        cleaned = img

    result = ocr_image(cleaned, lang=lang, config="--psm 6")
    result["processing_time_ms"] = round((time.time() - start) * 1000)
    return result


# ─── Full MCQ Pipeline ──────────────────────────────────────────────

@app.post("/grade-mcq")
async def grade_mcq_endpoint(
    file: UploadFile = File(...),
    num_questions: int = Form(...),
    answer_key: str = Form(...),
    num_choices: int = Form(4),
    points_per_question: int = Form(1),
):
    """
    Full MCQ grading pipeline:
    1. Preprocess image
    2. Detect layout (find MCQ region)
    3. Run OMR on MCQ region
    4. Grade against answer key
    """
    start = time.time()
    contents = await file.read()

    # Step 1: Preprocess
    preprocessed = preprocess_image(contents)
    if not preprocessed.get("success"):
        raise HTTPException(status_code=400, detail="Could not process image")

    gray = preprocessed["gray"]
    thresh = preprocessed["thresh"]
    h, w = gray.shape[:2]

    # Step 2: Detect layout
    layout = detect_layout(preprocessed)

    # Find MCQ region(s)
    mcq_regions = [r for r in layout["regions"] if r["type"] == REGION_MCQ]

    if mcq_regions:
        # Use the largest MCQ region
        mcq_region = max(mcq_regions, key=lambda r: r["bbox"]["width"] * r["bbox"]["height"])
        region_bbox = mcq_region["bbox"]
    else:
        # Fallback: use full image
        region_bbox = {"x": 0, "y": 0, "width": w, "height": h}

    # Step 3: OMR detection
    omr_result = detect_bubbles(thresh, gray, region_bbox, num_questions, num_choices)

    # Step 4: Grade
    grading = grade_mcq(omr_result["answers"], answer_key, points_per_question)

    return {
        "success": True,
        "preprocessing": {
            "paper_found": preprocessed["paper_found"],
            "skew_angle": preprocessed["skew_angle"],
        },
        "layout": {
            "mcq_region_found": len(mcq_regions) > 0,
            "total_regions": len(layout["regions"]),
        },
        "omr": {
            "answers": omr_result["answers"],
            "confidence": omr_result["confidence"],
            "detected_count": omr_result["detected_count"],
            "method": omr_result["method"],
        },
        "grading": grading,
        "processing_time_ms": round((time.time() - start) * 1000),
    }


# ─── Full Written Pipeline ──────────────────────────────────────────

@app.post("/grade-written")
async def grade_written_endpoint(
    file: UploadFile = File(...),
    lang: str = Form("eng"),
):
    """
    Full written answer pipeline:
    1. Preprocess image
    2. Detect layout (find written regions)
    3. Clean and segment written regions
    4. Run OCR
    """
    start = time.time()
    contents = await file.read()

    # Step 1: Preprocess
    preprocessed = preprocess_image(contents)
    if not preprocessed.get("success"):
        raise HTTPException(status_code=400, detail="Could not process image")

    # Step 2: Detect layout
    layout = detect_layout(preprocessed)

    # Step 3: Process written regions
    written_regions = process_written_regions(preprocessed, layout)

    # Step 4: OCR each region
    ocr_results = []
    for region in written_regions:
        result = ocr_region(region)
        ocr_results.append({
            "bbox": region["bbox"],
            "text": result["text"],
            "confidence": result["confidence"],
            "method": result["method"],
            "line_count": result["line_count"],
        })

    # If no written regions found, try OCR on full image
    if not ocr_results:
        full_result = ocr_image(preprocessed["enhanced"], lang=lang, config="--psm 6")
        ocr_results.append({
            "bbox": {"x": 0, "y": 0, "width": preprocessed["width"], "height": preprocessed["height"]},
            "text": full_result["text"],
            "confidence": full_result["confidence"],
            "method": "full-image-fallback",
            "line_count": 0,
        })

    # Combine all text
    all_text = "\n\n".join(r["text"] for r in ocr_results if r["text"])
    avg_confidence = (sum(r["confidence"] for r in ocr_results) / len(ocr_results)) if ocr_results else 0

    return {
        "success": True,
        "preprocessing": {
            "paper_found": preprocessed["paper_found"],
            "skew_angle": preprocessed["skew_angle"],
        },
        "text": all_text,
        "confidence": round(avg_confidence, 1),
        "regions": ocr_results,
        "processing_time_ms": round((time.time() - start) * 1000),
    }


# ─── Full Combined Pipeline ─────────────────────────────────────────

@app.post("/grade-full")
async def grade_full_endpoint(
    file: UploadFile = File(...),
    num_questions: int = Form(0),
    answer_key: str = Form(""),
    num_choices: int = Form(4),
    points_per_question: int = Form(1),
    lang: str = Form("eng"),
):
    """
    Full grading pipeline for mixed papers (MCQ + written):
    1. Preprocess
    2. Detect layout
    3. OMR for MCQ regions
    4. OCR for written regions
    5. Aggregate results
    """
    start = time.time()
    contents = await file.read()

    # Step 1: Preprocess
    preprocessed = preprocess_image(contents)
    if not preprocessed.get("success"):
        raise HTTPException(status_code=400, detail="Could not process image")

    gray = preprocessed["gray"]
    thresh = preprocessed["thresh"]
    h, w = gray.shape[:2]

    # Step 2: Detect layout
    layout = detect_layout(preprocessed)

    result = {
        "success": True,
        "preprocessing": {
            "paper_found": preprocessed["paper_found"],
            "skew_angle": preprocessed["skew_angle"],
            "width": w,
            "height": h,
        },
        "layout": {
            "regions": layout["regions"],
            "markers": layout["markers"],
        },
        "mcq": None,
        "written": None,
        "processing_time_ms": 0,
    }

    # Step 3: MCQ OMR
    mcq_regions = [r for r in layout["regions"] if r["type"] == REGION_MCQ]
    if mcq_regions and num_questions > 0:
        mcq_region = max(mcq_regions, key=lambda r: r["bbox"]["width"] * r["bbox"]["height"])
        omr_result = detect_bubbles(thresh, gray, mcq_region["bbox"], num_questions, num_choices)

        mcq_data = {
            "answers": omr_result["answers"],
            "confidence": omr_result["confidence"],
            "detected_count": omr_result["detected_count"],
            "method": omr_result["method"],
        }

        if answer_key:
            grading = grade_mcq(omr_result["answers"], answer_key, points_per_question)
            mcq_data["grading"] = grading

        result["mcq"] = mcq_data

    # Step 4: Written OCR
    written_regions = process_written_regions(preprocessed, layout)
    if written_regions:
        ocr_results = []
        for region in written_regions:
            ocr_result = ocr_region(region)
            ocr_results.append({
                "bbox": region["bbox"],
                "text": ocr_result["text"],
                "confidence": ocr_result["confidence"],
                "line_count": ocr_result["line_count"],
            })

        all_text = "\n\n".join(r["text"] for r in ocr_results if r["text"])
        avg_conf = sum(r["confidence"] for r in ocr_results) / len(ocr_results) if ocr_results else 0

        result["written"] = {
            "text": all_text,
            "confidence": round(avg_conf, 1),
            "regions": ocr_results,
        }

    result["processing_time_ms"] = round((time.time() - start) * 1000)
    return result


if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("  GradeSmart Grading Server")
    print("  OpenCV + Tesseract pipeline")
    print("=" * 60)
    print()
    print("  Endpoints:")
    print("    GET  /health        — Server status")
    print("    POST /grade-mcq     — Full MCQ grading")
    print("    POST /grade-written — Full written grading")
    print("    POST /grade-full    — Combined MCQ + written")
    print("    POST /preprocess    — Image preprocessing only")
    print("    POST /detect-layout — Layout detection only")
    print("    POST /omr           — OMR detection only")
    print("    POST /ocr           — OCR extraction only")
    print()
    print("  Docs: http://0.0.0.0:8100/docs")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8100)
