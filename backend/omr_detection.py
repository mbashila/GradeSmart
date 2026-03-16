"""
Step 4: MCQ OMR — Deterministic bubble detection using OpenCV
- Detect bubble contours (circles/ovals)
- Filter by size and shape
- Calculate fill intensity per bubble
- Determine selected option per question
- Compare with answer key
- Compute MCQ score
"""

import cv2
import numpy as np


CHOICES = ["A", "B", "C", "D"]
CHOICES_5 = ["A", "B", "C", "D", "E"]


def detect_bubbles(thresh, gray, region_bbox, num_questions, num_choices=4):
    """
    Detect filled bubbles in an MCQ region using contour analysis.
    
    Args:
        thresh: thresholded (binary inverse) image
        gray: grayscale image
        region_bbox: dict with x, y, width, height of MCQ region
        num_questions: expected number of questions
        num_choices: number of choices per question (4 or 5)
    
    Returns:
        dict with detected answers, confidence, and debug info
    """
    choices = CHOICES_5[:num_choices]
    
    # Extract the MCQ region
    x = region_bbox["x"]
    y = region_bbox["y"]
    w = region_bbox["width"]
    h = region_bbox["height"]
    
    roi_thresh = thresh[y:y+h, x:x+w]
    roi_gray = gray[y:y+h, x:x+w]
    
    # Step 1: Find all contours in the MCQ region
    contours, _ = cv2.findContours(roi_thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Step 2: Filter contours that look like bubbles
    # Bubbles are roughly circular, similar size, and within expected size range
    bubble_candidates = []
    
    # Expected bubble size: roughly (region_width / num_choices) * 0.5
    expected_bubble_w = w / (num_choices + 1) * 0.6
    min_bubble = max(8, int(expected_bubble_w * 0.3))
    max_bubble = int(expected_bubble_w * 2.5)
    
    for c in contours:
        bx, by, bw, bh = cv2.boundingRect(c)
        aspect = bw / max(bh, 1)
        area = cv2.contourArea(c)
        rect_area = bw * bh
        circularity = area / max(rect_area, 1)
        
        # Bubble criteria: roughly circular, right size range
        if (min_bubble < bw < max_bubble and
            min_bubble < bh < max_bubble and
            0.5 < aspect < 2.0 and
            circularity > 0.3):
            
            # Calculate fill intensity (how dark the bubble is)
            mask = np.zeros(roi_gray.shape, dtype=np.uint8)
            cv2.drawContours(mask, [c], -1, 255, -1)
            mean_val = cv2.mean(roi_gray, mask=mask)[0]
            fill_intensity = 1.0 - (mean_val / 255.0)  # 0=empty, 1=fully filled
            
            bubble_candidates.append({
                "x": int(bx),
                "y": int(by),
                "w": int(bw),
                "h": int(bh),
                "cx": int(bx + bw // 2),
                "cy": int(by + bh // 2),
                "fill": float(fill_intensity),
                "area": float(area),
                "contour": c,
            })
    
    if len(bubble_candidates) == 0:
        return _empty_result(num_questions, "No bubble contours found")
    
    # Step 3: Group bubbles into rows (questions) by y-coordinate
    bubble_candidates.sort(key=lambda b: b["cy"])
    
    rows = []
    current_row = [bubble_candidates[0]]
    row_threshold = h / max(num_questions, 1) * 0.4
    
    for b in bubble_candidates[1:]:
        if abs(b["cy"] - current_row[-1]["cy"]) < row_threshold:
            current_row.append(b)
        else:
            rows.append(current_row)
            current_row = [b]
    rows.append(current_row)
    
    # Step 4: Filter rows — keep only rows with approximately the right number of bubbles
    valid_rows = []
    for row in rows:
        if num_choices - 1 <= len(row) <= num_choices + 2:
            # Sort by x-coordinate (left to right = A, B, C, D)
            row.sort(key=lambda b: b["cx"])
            valid_rows.append(row[:num_choices])  # Take first num_choices
    
    # If we don't have enough rows, try a grid-based approach
    if len(valid_rows) < num_questions * 0.5:
        return _grid_based_detection(roi_thresh, roi_gray, w, h, num_questions, num_choices)
    
    # Step 5: For each row, determine which bubble is filled
    answers = []
    confidences = []
    fill_data = []
    
    for i in range(num_questions):
        if i < len(valid_rows):
            row = valid_rows[i]
            fills = [b["fill"] for b in row]
            fill_data.append(fills)
            
            max_fill = max(fills)
            min_fill = min(fills)
            best_idx = fills.index(max_fill)
            
            # Second highest fill
            sorted_fills = sorted(fills, reverse=True)
            second_fill = sorted_fills[1] if len(sorted_fills) > 1 else 0
            
            # Confidence based on separation between best and second
            separation = max_fill - second_fill
            
            if max_fill > 0.25 and separation > 0.08:
                # Clear winner
                conf = min(99, int(50 + separation * 200 + max_fill * 50))
                answers.append(choices[best_idx] if best_idx < len(choices) else "?")
                confidences.append(conf)
            elif max_fill > 0.15:
                # Weak detection
                conf = max(15, int(max_fill * 100))
                answers.append(choices[best_idx] if best_idx < len(choices) else "?")
                confidences.append(conf)
            else:
                # No clear mark
                answers.append("?")
                confidences.append(0)
        else:
            answers.append("?")
            confidences.append(0)
            fill_data.append([])
    
    detected_count = sum(1 for a in answers if a != "?")
    
    return {
        "answers": answers,
        "confidence": confidences,
        "fill_data": fill_data,
        "detected_count": detected_count,
        "total_questions": num_questions,
        "bubble_count": len(bubble_candidates),
        "row_count": len(valid_rows),
        "method": "contour",
        "success": detected_count > 0,
    }


def _grid_based_detection(roi_thresh, roi_gray, w, h, num_questions, num_choices):
    """
    Fallback: divide the region into a grid and measure fill intensity per cell.
    Used when contour-based detection doesn't find enough bubbles.
    """
    choices = CHOICES_5[:num_choices]
    
    # Divide into grid
    row_h = h / num_questions
    col_w = w / (num_choices + 1)  # +1 for question number column
    
    answers = []
    confidences = []
    fill_data = []
    
    for q in range(num_questions):
        y_start = int(q * row_h + row_h * 0.1)
        y_end = int((q + 1) * row_h - row_h * 0.1)
        
        fills = []
        for c in range(num_choices):
            # Skip first column (question numbers)
            x_start = int((c + 1) * col_w + col_w * 0.15)
            x_end = int((c + 2) * col_w - col_w * 0.15)
            
            x_start = max(0, min(x_start, w - 1))
            x_end = max(x_start + 1, min(x_end, w))
            y_start_c = max(0, min(y_start, h - 1))
            y_end_c = max(y_start_c + 1, min(y_end, h))
            
            cell = roi_gray[y_start_c:y_end_c, x_start:x_end]
            if cell.size > 0:
                mean_val = np.mean(cell)
                fill = 1.0 - (mean_val / 255.0)
                fills.append(float(fill))
            else:
                fills.append(0.0)
        
        fill_data.append(fills)
        
        max_fill = max(fills)
        best_idx = fills.index(max_fill)
        sorted_fills = sorted(fills, reverse=True)
        second_fill = sorted_fills[1] if len(sorted_fills) > 1 else 0
        separation = max_fill - second_fill
        
        if max_fill > 0.20 and separation > 0.05:
            conf = min(80, int(30 + separation * 150 + max_fill * 40))
            answers.append(choices[best_idx] if best_idx < len(choices) else "?")
            confidences.append(conf)
        else:
            answers.append("?")
            confidences.append(0)
    
    detected_count = sum(1 for a in answers if a != "?")
    
    return {
        "answers": answers,
        "confidence": confidences,
        "fill_data": fill_data,
        "detected_count": detected_count,
        "total_questions": num_questions,
        "bubble_count": 0,
        "row_count": 0,
        "method": "grid",
        "success": detected_count > 0,
    }


def _empty_result(num_questions, reason=""):
    return {
        "answers": ["?"] * num_questions,
        "confidence": [0] * num_questions,
        "fill_data": [],
        "detected_count": 0,
        "total_questions": num_questions,
        "bubble_count": 0,
        "row_count": 0,
        "method": "none",
        "success": False,
        "error": reason,
    }


def grade_mcq(detected_answers, answer_key, points_per_question=1):
    """
    Compare detected answers with the answer key.
    
    Args:
        detected_answers: list of detected answers (e.g., ["A", "B", "C", "?"])
        answer_key: string or list of correct answers (e.g., "ABCD" or ["A","B","C","D"])
        points_per_question: points awarded per correct answer
    
    Returns:
        dict with score, percentage, and per-question results
    """
    if isinstance(answer_key, str):
        answer_key = list(answer_key.upper())
    
    results = []
    score = 0
    total = len(answer_key) * points_per_question
    
    for i in range(len(answer_key)):
        detected = detected_answers[i] if i < len(detected_answers) else "?"
        correct = answer_key[i].upper() if i < len(answer_key) else "?"
        
        is_correct = detected.upper() == correct
        if is_correct:
            score += points_per_question
        
        results.append({
            "question": i + 1,
            "detected": detected,
            "correct": correct,
            "is_correct": is_correct,
            "points": points_per_question if is_correct else 0,
        })
    
    percentage = round((score / max(total, 1)) * 100, 1)
    
    return {
        "score": score,
        "total": total,
        "percentage": percentage,
        "results": results,
    }
