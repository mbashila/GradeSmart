"""
Step 3: Layout Detection (OpenCV)
- Detect anchor markers / reference points
- Align to template
- Segment regions: MCQ region, Written-answer region, Student info region
"""

import cv2
import numpy as np


# Region types
REGION_MCQ = "mcq"
REGION_WRITTEN = "written"
REGION_STUDENT_INFO = "student_info"
REGION_HEADER = "header"
REGION_BLANK = "blank"
REGION_UNKNOWN = "unknown"


def find_anchor_markers(thresh, img_w, img_h):
    """
    Detect filled square/circle anchor markers typically found at corners
    of standardized answer sheets. These are used for alignment.
    
    Returns list of (x, y, w, h) for detected markers.
    """
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    markers = []
    min_marker = int(min(img_w, img_h) * 0.01)  # At least 1% of image
    max_marker = int(min(img_w, img_h) * 0.06)   # At most 6% of image
    
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        # Markers are roughly square and filled
        aspect = w / max(h, 1)
        area = cv2.contourArea(c)
        rect_area = w * h
        fill_ratio = area / max(rect_area, 1)
        
        if (min_marker < w < max_marker and
            min_marker < h < max_marker and
            0.7 < aspect < 1.3 and
            fill_ratio > 0.6):
            markers.append((x, y, w, h))
    
    # Sort by position: top-left first
    markers.sort(key=lambda m: m[0] + m[1])
    return markers


def detect_horizontal_lines(gray, img_w):
    """Detect horizontal lines that separate sections."""
    # Use morphological operations to isolate horizontal lines
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (img_w // 4, 1))
    detect_horizontal = cv2.morphologyEx(
        cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                              cv2.THRESH_BINARY_INV, 15, 8),
        cv2.MORPH_OPEN, horizontal_kernel, iterations=2
    )
    
    contours, _ = cv2.findContours(detect_horizontal, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    lines = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if w > img_w * 0.3:  # Line must span at least 30% of width
            lines.append(y + h // 2)
    
    lines.sort()
    return lines


def classify_region(thresh_region, gray_region, region_h, region_w):
    """
    Classify a region as MCQ, written, blank, or header based on its content.
    
    MCQ regions have:
    - Regular grid of small circular/oval marks
    - High density of small contours in rows
    
    Written regions have:
    - Irregular text-like contours
    - Lines of varying width
    
    Blank regions have:
    - Very few dark pixels
    """
    if thresh_region.size == 0:
        return REGION_BLANK, 0.0
    
    # Check if mostly blank
    dark_ratio = np.count_nonzero(thresh_region) / thresh_region.size
    if dark_ratio < 0.02:
        return REGION_BLANK, 0.95
    
    # Find contours in the region
    contours, _ = cv2.findContours(thresh_region, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if len(contours) == 0:
        return REGION_BLANK, 0.9
    
    # Analyze contour properties
    areas = [cv2.contourArea(c) for c in contours]
    bboxes = [cv2.boundingRect(c) for c in contours]
    
    # MCQ detection: look for grid of similarly-sized small contours
    small_contours = [(x, y, w, h) for (x, y, w, h) in bboxes 
                      if 5 < w < region_w * 0.15 and 5 < h < region_h * 0.15]
    
    if len(small_contours) > 10:
        # Check if they form rows (similar y-coordinates)
        y_coords = [y for (x, y, w, h) in small_contours]
        y_coords.sort()
        
        # Group by proximity (within 10px = same row)
        rows = []
        current_row = [y_coords[0]]
        for y in y_coords[1:]:
            if y - current_row[-1] < max(10, region_h * 0.03):
                current_row.append(y)
            else:
                rows.append(current_row)
                current_row = [y]
        rows.append(current_row)
        
        # MCQ: multiple rows with similar number of items
        row_counts = [len(r) for r in rows if len(r) >= 3]
        if len(row_counts) >= 3:
            # Check consistency of items per row
            avg_count = np.mean(row_counts)
            std_count = np.std(row_counts)
            if std_count < avg_count * 0.5:  # Fairly consistent
                return REGION_MCQ, min(0.95, 0.5 + len(row_counts) * 0.05)
    
    # Header detection: region at top with text but not many lines
    if dark_ratio < 0.10 and len(contours) < 30:
        return REGION_HEADER, 0.6
    
    # Written answer: irregular contours, text-like patterns
    if dark_ratio > 0.03 and len(contours) > 5:
        return REGION_WRITTEN, 0.7
    
    return REGION_UNKNOWN, 0.3


def detect_layout(preprocessed):
    """
    Detect the layout of a preprocessed answer sheet.
    
    Input: preprocessed dict from preprocess.py
    Output: dict with detected regions
    """
    gray = preprocessed["gray"]
    thresh = preprocessed["thresh"]
    h, w = gray.shape[:2]
    
    # Step 1: Find anchor markers
    markers = find_anchor_markers(thresh, w, h)
    
    # Step 2: Find horizontal dividing lines
    h_lines = detect_horizontal_lines(gray, w)
    
    # Step 3: Divide image into horizontal strips based on lines
    # Add image boundaries
    boundaries = [0] + h_lines + [h]
    # Remove duplicates and sort
    boundaries = sorted(set(boundaries))
    # Merge boundaries that are too close
    merged = [boundaries[0]]
    for b in boundaries[1:]:
        if b - merged[-1] > h * 0.03:  # At least 3% of image height
            merged.append(b)
    if merged[-1] != h:
        merged.append(h)
    boundaries = merged
    
    # Step 4: Classify each strip
    regions = []
    for i in range(len(boundaries) - 1):
        y_start = boundaries[i]
        y_end = boundaries[i + 1]
        strip_h = y_end - y_start
        
        if strip_h < h * 0.03:  # Skip very thin strips
            continue
        
        # Extract strip
        strip_thresh = thresh[y_start:y_end, :]
        strip_gray = gray[y_start:y_end, :]
        
        region_type, confidence = classify_region(strip_thresh, strip_gray, strip_h, w)
        
        regions.append({
            "type": region_type,
            "confidence": float(confidence),
            "bbox": {
                "x": 0,
                "y": int(y_start),
                "width": int(w),
                "height": int(strip_h),
            },
        })
    
    # Step 5: Merge adjacent regions of the same type
    merged_regions = []
    for region in regions:
        if (merged_regions and 
            merged_regions[-1]["type"] == region["type"] and
            region["type"] != REGION_BLANK):
            # Merge with previous
            prev = merged_regions[-1]
            new_y = prev["bbox"]["y"]
            new_h = (region["bbox"]["y"] + region["bbox"]["height"]) - new_y
            prev["bbox"]["height"] = new_h
            prev["confidence"] = max(prev["confidence"], region["confidence"])
        else:
            merged_regions.append(region)
    
    return {
        "regions": merged_regions,
        "markers": [{"x": int(x), "y": int(y), "width": int(mw), "height": int(mh)} 
                     for (x, y, mw, mh) in markers],
        "dividing_lines": [int(l) for l in h_lines],
        "image_width": int(w),
        "image_height": int(h),
    }


def extract_region_image(image, region_bbox):
    """Extract a sub-image for a specific region."""
    x = region_bbox["x"]
    y = region_bbox["y"]
    w = region_bbox["width"]
    h = region_bbox["height"]
    return image[y:y+h, x:x+w]
