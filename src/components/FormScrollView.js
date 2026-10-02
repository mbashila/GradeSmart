import React, { createContext, forwardRef, useCallback, useContext, useMemo, useRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

export const KEYBOARD_AVOIDING_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';

const VISIBILITY_MARGIN = 24;

const FormScrollContext = createContext(null);

export function useFormScroll() {
  return useContext(FormScrollContext);
}

/**
 * Keyboard-aware scroll container for forms.
 * Shrinks with the keyboard, lets taps on buttons through while the keyboard is
 * open, dismisses the keyboard on taps elsewhere, and keeps the focused Input
 * (including its error/helper text) inside the visible area.
 */
const FormScrollView = forwardRef(function FormScrollView(
  {
    children,
    style,
    contentContainerStyle,
    keyboardVerticalOffset = 0,
    onScroll,
    onLayout,
    ...props
  },
  ref,
) {
  const scrollRef = useRef(null);
  const scrollY = useRef(0);
  const viewportHeight = useRef(0);
  const focusedNode = useRef(null);

  const setScrollRef = useCallback((node) => {
    scrollRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  const scrollIntoView = useCallback((node) => {
    const scroll = scrollRef.current;
    const inner = scroll?.getInnerViewRef?.();
    if (!scroll || !inner || !node || !viewportHeight.current) return;
    node.measureLayout(
      inner,
      (x, y, width, height) => {
        const top = Math.max(0, y - VISIBILITY_MARGIN);
        const bottom = y + height + VISIBILITY_MARGIN;
        const visibleTop = scrollY.current;
        const visibleBottom = visibleTop + viewportHeight.current;
        if (bottom > visibleBottom) {
          scroll.scrollTo({ y: Math.min(top, bottom - viewportHeight.current), animated: true });
        } else if (top < visibleTop) {
          scroll.scrollTo({ y: top, animated: true });
        }
      },
      () => {},
    );
  }, []);

  const contextValue = useMemo(() => ({
    focus(node) {
      focusedNode.current = node;
      scrollIntoView(node);
    },
    blur(node) {
      if (focusedNode.current === node) focusedNode.current = null;
    },
    scrollIntoView,
  }), [scrollIntoView]);

  const handleScroll = useCallback((event) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
    onScroll?.(event);
  }, [onScroll]);

  const handleLayout = useCallback((event) => {
    const height = event.nativeEvent.layout.height;
    const shrank = height < viewportHeight.current;
    viewportHeight.current = height;
    if (shrank && focusedNode.current) scrollIntoView(focusedNode.current);
    onLayout?.(event);
  }, [onLayout, scrollIntoView]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={KEYBOARD_AVOIDING_BEHAVIOR}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <FormScrollContext.Provider value={contextValue}>
        <ScrollView
          ref={setScrollRef}
          style={style}
          contentContainerStyle={contentContainerStyle}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onLayout={handleLayout}
          {...props}
        >
          {children}
        </ScrollView>
      </FormScrollContext.Provider>
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

export default FormScrollView;
