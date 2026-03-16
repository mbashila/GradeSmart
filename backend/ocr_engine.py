"""
Step 6: OCR Stage
- Send cleaned image to OCR engine (Tesseract)
- Return extracted text with confidence score

Step 7: Text Post-Processing
- Remove OCR artifacts
- Fix spacing issues
- Normalize punctuation
"""

import cv2
import numpy as np
import re

import platform
import os

try:
    import pytesseract
    # Auto-detect Tesseract on Windows
    if platform.system() == 'Windows':
        win_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        if os.path.exists(win_path):
            pytesseract.pytesseract.tesseract_cmd = win_path
except ImportError:
    pytesseract = None


def check_tesseract():
    """Check if Tesseract is available."""
    if pytesseract is None:
        return {"available": False, "error": "pytesseract not installed"}
    try:
        version = pytesseract.get_tesseract_version()
        return {"available": True, "version": str(version)}
    except Exception as e:
        return {"available": False, "error": str(e)}


def ocr_image(image, lang="eng", config=""):
    """
    Run Tesseract OCR on an image.
    
    Args:
        image: OpenCV image (grayscale or color)
        lang: Tesseract language code
        config: additional Tesseract config flags
    
    Returns:
        dict with text, confidence, and word-level details
    """
    if pytesseract is None:
        return {"text": "", "confidence": 0, "error": "pytesseract not installed", "words": []}

    try:
        # Get detailed data including confidence per word
        data = pytesseract.image_to_data(image, lang=lang, config=config,
                                          output_type=pytesseract.Output.DICT)

        words = []
        full_text_parts = []
        confidences = []
        last_block = -1
        last_par = -1
        last_line = -1

        for i in range(len(data["text"])):
            text = data["text"][i].strip()
            conf = int(data["conf"][i])
            block = data["block_num"][i]
            par = data["par_num"][i]
            line = data["line_num"][i]

            if not text:
                continue

            # Add line/paragraph breaks
            if last_line >= 0 and (block != last_block or par != last_par or line != last_line):
                full_text_parts.append("\n")

            full_text_parts.append(text + " ")
            last_block = block
            last_par = par
            last_line = line

            if conf > 0:
                confidences.append(conf)
                words.append({
                    "text": text,
                    "confidence": conf,
                    "x": int(data["left"][i]),
                    "y": int(data["top"][i]),
                    "width": int(data["width"][i]),
                    "height": int(data["height"][i]),
                })

        raw_text = "".join(full_text_parts).strip()
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0

        # Post-process the text
        cleaned_text = post_process_text(raw_text)

        return {
            "raw_text": raw_text,
            "text": cleaned_text,
            "confidence": round(avg_confidence, 1),
            "word_count": len(words),
            "words": words,
        }

    except Exception as e:
        return {"text": "", "confidence": 0, "error": str(e), "words": []}


def ocr_region(written_region):
    """
    Run OCR on a processed written region.
    Can process line-by-line for better accuracy.
    
    Args:
        written_region: dict from written_processing.py
    
    Returns:
        dict with full text and per-line results
    """
    lines_text = []
    all_confidences = []

    # Try line-by-line OCR first (often more accurate)
    if written_region.get("lines") and len(written_region["lines"]) > 0:
        for line_data in written_region["lines"]:
            line_img = line_data["image"]
            # Add padding around the line for better OCR
            padded = cv2.copyMakeBorder(line_img, 10, 10, 10, 10,
                                         cv2.BORDER_CONSTANT, value=255)
            result = ocr_image(padded, config="--psm 7")  # Single line mode
            if result["text"]:
                lines_text.append(result["text"])
                if result["confidence"] > 0:
                    all_confidences.append(result["confidence"])

    # Also run OCR on the full region as backup
    full_result = ocr_image(written_region["cleaned"], config="--psm 6")  # Block of text

    # Use whichever has better confidence
    line_text = "\n".join(lines_text)
    line_conf = sum(all_confidences) / len(all_confidences) if all_confidences else 0

    if line_conf > full_result["confidence"] and line_text:
        return {
            "text": line_text,
            "confidence": round(line_conf, 1),
            "method": "line-by-line",
            "line_count": len(lines_text),
            "full_text_backup": full_result["text"],
        }
    else:
        return {
            "text": full_result["text"],
            "confidence": full_result["confidence"],
            "method": "full-region",
            "line_count": len(lines_text),
            "line_text_backup": line_text,
        }


# ─── Text Post-Processing (Step 7) ──────────────────────────────────

def post_process_text(text):
    """
    Clean up OCR output:
    - Remove artifacts
    - Fix spacing
    - Normalize punctuation
    """
    if not text:
        return ""

    # Remove common OCR artifacts
    text = re.sub(r'[|\\}{~`]', '', text)

    # Fix multiple spaces
    text = re.sub(r' {2,}', ' ', text)

    # Fix spacing around punctuation
    text = re.sub(r'\s+([.,;:!?])', r'\1', text)
    text = re.sub(r'([.,;:!?])(\w)', r'\1 \2', text)

    # Normalize quotes
    text = text.replace('"', '"').replace('"', '"')
    text = text.replace(''', "'").replace(''', "'")

    # Remove leading/trailing whitespace per line
    lines = [line.strip() for line in text.split('\n')]
    text = '\n'.join(line for line in lines if line)

    # Fix common OCR misreads
    text = re.sub(r'\bl\b', 'I', text)  # lone 'l' is usually 'I'
    text = re.sub(r'(?<=[a-z])0(?=[a-z])', 'o', text)  # 0 between letters is 'o'
    text = re.sub(r'(?<=[A-Z])0(?=[a-z])', 'O', text)  # 0 after capital is 'O'

    return text.strip()
