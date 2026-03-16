"""
Step 2: Image Preprocessing (OpenCV)
- Convert to grayscale
- Noise reduction (Gaussian blur)
- Edge detection (Canny)
- Detect paper contour
- Perspective transform (flatten page)
- Deskew correction
- Adaptive thresholding
- Contrast normalization
"""

import cv2
import numpy as np
import math


def order_points(pts):
    """Order 4 points as: top-left, top-right, bottom-right, bottom-left."""
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def four_point_transform(image, pts):
    """Apply perspective transform to flatten a quadrilateral region."""
    rect = order_points(pts)
    (tl, tr, br, bl) = rect

    widthA = np.linalg.norm(br - bl)
    widthB = np.linalg.norm(tr - tl)
    maxWidth = max(int(widthA), int(widthB))

    heightA = np.linalg.norm(tr - br)
    heightB = np.linalg.norm(tl - bl)
    maxHeight = max(int(heightA), int(heightB))

    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]
    ], dtype="float32")

    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    return warped


def detect_paper_contour(image):
    """
    Detect the largest rectangular contour in the image (the paper).
    Returns the 4 corner points or None if not found.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 50, 200)

    # Dilate to close gaps in edges
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edged = cv2.dilate(edged, kernel, iterations=1)

    contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

    paper_contour = None
    for c in contours:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            area = cv2.contourArea(approx)
            img_area = image.shape[0] * image.shape[1]
            # Paper should be at least 15% of the image
            if area > img_area * 0.15:
                paper_contour = approx
                break

    return paper_contour


def compute_skew_angle(gray):
    """Compute the skew angle of text lines using Hough transform."""
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=100,
                            minLineLength=gray.shape[1] // 4, maxLineGap=10)
    if lines is None or len(lines) == 0:
        return 0.0

    angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
        # Only consider near-horizontal lines (±15°)
        if abs(angle) < 15:
            angles.append(angle)

    if not angles:
        return 0.0

    return np.median(angles)


def deskew(image, angle):
    """Rotate image to correct skew."""
    if abs(angle) < 0.3:
        return image
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(image, M, (w, h),
                              flags=cv2.INTER_CUBIC,
                              borderMode=cv2.BORDER_REPLICATE)
    return rotated


def preprocess_image(image_bytes):
    """
    Full preprocessing pipeline.
    
    Input: raw image bytes (from uploaded file)
    Output: dict with processed image and metadata
    """
    # Decode image
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {"error": "Could not decode image", "success": False}

    original = img.copy()
    h, w = img.shape[:2]

    # Step 1: Detect paper contour and perspective transform
    paper_found = False
    contour = detect_paper_contour(img)
    if contour is not None:
        pts = contour.reshape(4, 2).astype("float32")
        img = four_point_transform(img, pts)
        paper_found = True
        h, w = img.shape[:2]

    # Step 2: Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Step 3: Noise reduction
    denoised = cv2.GaussianBlur(gray, (3, 3), 0)

    # Step 4: Deskew
    skew_angle = compute_skew_angle(denoised)
    if abs(skew_angle) > 0.3:
        img = deskew(img, skew_angle)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        denoised = cv2.GaussianBlur(gray, (3, 3), 0)

    # Step 5: Adaptive thresholding (for OMR and OCR)
    thresh = cv2.adaptiveThreshold(
        denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 15, 8
    )

    # Step 6: Contrast normalization
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)

    return {
        "success": True,
        "original": original,
        "color": img,
        "gray": gray,
        "denoised": denoised,
        "thresh": thresh,
        "enhanced": enhanced,
        "paper_found": paper_found,
        "skew_angle": float(skew_angle),
        "width": w,
        "height": h,
    }
