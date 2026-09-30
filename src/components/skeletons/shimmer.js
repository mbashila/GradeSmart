import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

export const SHIMMER_DURATION_MS = 1500;
const SHIMMER_PAUSE_MS = 250;

// One Animated.Value drives every skeleton on screen, so all placeholders
// shimmer in sync and only a single native animation loop runs at a time.
const progress = new Animated.Value(0);
let loop = null;
let subscribers = 0;

function startLoop() {
  if (loop) return;
  progress.setValue(0);
  loop = Animated.loop(
    Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: SHIMMER_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.delay(SHIMMER_PAUSE_MS),
    ])
  );
  loop.start();
}

function stopLoop() {
  if (!loop) return;
  loop.stop();
  loop = null;
}

export function useShimmerProgress(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    subscribers += 1;
    startLoop();
    return () => {
      subscribers -= 1;
      if (subscribers <= 0) {
        subscribers = 0;
        stopLoop();
      }
    };
  }, [enabled]);
  return progress;
}

let reduceMotionEnabled = false;
const reduceMotionListeners = new Set();

function setReduceMotion(value) {
  reduceMotionEnabled = !!value;
  reduceMotionListeners.forEach((listener) => listener(reduceMotionEnabled));
}

AccessibilityInfo.isReduceMotionEnabled?.()
  .then(setReduceMotion)
  .catch(() => {});
AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);

export function useReducedMotion() {
  const [value, setValue] = useState(reduceMotionEnabled);
  useEffect(() => {
    reduceMotionListeners.add(setValue);
    setValue(reduceMotionEnabled);
    return () => {
      reduceMotionListeners.delete(setValue);
    };
  }, []);
  return value;
}
