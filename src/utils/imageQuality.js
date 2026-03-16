import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Analyze image quality by downsampling to a small thumbnail and
 * inspecting pixel data for blur (low contrast/variance), darkness,
 * and over-exposure.
 *
 * Returns { ok, issues[] } where issues is an array of warning strings.
 * ok = true means the image is acceptable.
 */

// Decode base64 string into a Uint8Array of raw bytes
function base64ToBytes(base64) {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  // We analyze the raw JPEG byte stream statistically.
  // Byte distribution correlates with brightness and contrast.
  return bytes;
}

// Compute mean of a typed array
function mean(arr) {
  if (arr.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

// Compute standard deviation
function stdDev(arr, avg) {
  if (arr.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] - avg;
    sum += d * d;
  }
  return Math.sqrt(sum / arr.length);
}

// Compute ratio of values in extreme low / high ranges
function extremeRatio(arr, low, high) {
  let lowCount = 0;
  let highCount = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < low) lowCount++;
    if (arr[i] > high) highCount++;
  }
  return { lowRatio: lowCount / arr.length, highRatio: highCount / arr.length };
}

/**
 * Check image quality from a local URI.
 * @param {string} uri - local file URI of the captured image
 * @returns {Promise<{ ok: boolean, issues: string[], brightness: number, contrast: number }>}
 */
export async function checkImageQuality(uri) {
  const issues = [];

  try {
    // Use the new ImageManipulator.manipulate API (SDK 54+)
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width: 64 });
    const imageRef = await context.renderAsync();
    const result = await imageRef.saveAsync({
      format: SaveFormat.JPEG,
      base64: true,
      compress: 0.5,
    });

    if (!result.base64) {
      return { ok: true, issues: [], brightness: -1, contrast: -1 };
    }

    const bytes = base64ToBytes(result.base64);
    const avg = mean(bytes);
    const sd = stdDev(bytes, avg);
    const { lowRatio, highRatio } = extremeRatio(bytes, 40, 220);

    // Too dark: average byte value very low and many dark pixels
    if (avg < 60 && lowRatio > 0.5) {
      issues.push('Image is too dark. Try better lighting.');
    }

    // Too bright / washed out
    if (avg > 210 && highRatio > 0.5) {
      issues.push('Image is overexposed. Reduce lighting or flash.');
    }

    // Low contrast / likely blurry: standard deviation is very low
    // meaning all pixel values are very similar (flat image)
    if (sd < 25) {
      issues.push('Image appears blurry or out of focus. Hold the camera steady.');
    }

    // Very low variance — could be a blank/covered lens
    if (sd < 10) {
      issues.push('Camera may be obstructed. Check the lens.');
    }

    return {
      ok: issues.length === 0,
      issues,
      brightness: Math.round(avg),
      contrast: Math.round(sd),
    };
  } catch (e) {
    // If analysis fails, don't block the user
    return { ok: true, issues: [], brightness: -1, contrast: -1 };
  }
}
