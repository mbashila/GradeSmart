"""
Step 5: Written Answer Processing
- Crop written-answer regions
- Clean region (threshold + denoise)
- Line segmentation (optional)
"""

import cv2
import numpy as np


def clean_written_region(gray_region):
    """
    Clean a written answer region for OCR.
    - Denoise
    - Adaptive threshold
    - Remove small noise
    - Enhance text contrast
    """
    if gray_region is None or gray_region.size == 0:
        return None

    # Denoise
    denoised = cv2.GaussianBlur(gray_region, (3, 3), 0)

    # Adaptive threshold to get clean binary text
    binary = cv2.adaptiveThreshold(
        denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 15, 10
    )

    # Remove small noise blobs
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    cleaned = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)

    # Slight dilation to connect broken strokes
    dilate_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 1))
    cleaned = cv2.dilate(cleaned, dilate_kernel, iterations=1)

    return cleaned


def segment_lines(binary_region):
    """
    Segment a written region into individual text lines using
    horizontal projection profile.
    
    Returns list of (y_start, y_end) tuples for each line.
    """
    if binary_region is None or binary_region.size == 0:
        return []

    h, w = binary_region.shape[:2]

    # Horizontal projection: count white pixels per row
    # (binary is white text on black, or black text on white)
    # Invert if needed so text is white
    inv = cv2.bitwise_not(binary_region)
    projection = np.sum(inv, axis=1) / 255

    # Threshold: a row is "text" if it has more than 1% dark pixels
    threshold = w * 0.01
    is_text = projection > threshold

    # Find contiguous text regions
    lines = []
    in_line = False
    line_start = 0

    for y in range(h):
        if is_text[y] and not in_line:
            line_start = y
            in_line = True
        elif not is_text[y] and in_line:
            line_h = y - line_start
            if line_h > 5:  # Minimum line height
                lines.append((line_start, y))
            in_line = False

    if in_line:
        lines.append((line_start, h))

    # Merge lines that are very close (likely same line with gap)
    merged = []
    for start, end in lines:
        if merged and start - merged[-1][1] < 5:
            merged[-1] = (merged[-1][0], end)
        else:
            merged.append((start, end))

    return merged


def process_written_regions(preprocessed, layout):
    """
    Process all written-answer regions from the layout detection.
    
    Args:
        preprocessed: dict from preprocess.py
        layout: dict from layout_detection.py
    
    Returns:
        list of processed written regions with cleaned images and line segments
    """
    gray = preprocessed["gray"]
    results = []

    for region in layout.get("regions", []):
        if region["type"] != "written":
            continue

        bbox = region["bbox"]
        x = bbox["x"]
        y = bbox["y"]
        w = bbox["width"]
        h = bbox["height"]

        # Extract region
        region_gray = gray[y:y+h, x:x+w]

        # Clean for OCR
        cleaned = clean_written_region(region_gray)
        if cleaned is None:
            continue

        # Segment into lines
        lines = segment_lines(cleaned)

        # Extract individual line images
        line_images = []
        for ly_start, ly_end in lines:
            line_img = cleaned[ly_start:ly_end, :]
            if line_img.size > 0:
                line_images.append({
                    "image": line_img,
                    "y_start": int(ly_start),
                    "y_end": int(ly_end),
                    "height": int(ly_end - ly_start),
                })

        results.append({
            "bbox": bbox,
            "cleaned": cleaned,
            "original_gray": region_gray,
            "lines": line_images,
            "line_count": len(line_images),
            "confidence": region.get("confidence", 0),
        })

    return results
