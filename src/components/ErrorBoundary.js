import React from 'react';
import { View } from 'react-native';
import ErrorState from './ErrorState';
import { useColors } from '../context/ThemeContext';
import { logError } from '../utils/errors';

function Fallback({ onRetry, secondaryAction }) {
  const colors = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ErrorState
        fullScreen
        icon="alert-circle-outline"
        title="Something went wrong"
        message="We're having trouble displaying this page. Try again, or go back."
        onRetry={onRetry}
        secondaryAction={secondaryAction}
      />
    </View>
  );
}

/**
 * Catches render errors so a crashing screen shows a recoverable fallback
 * instead of a blank/red screen. "Try Again" re-mounts the children.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    logError('RENDER', error, {
      screen: this.props.name,
      ...(typeof __DEV__ !== 'undefined' && __DEV__ ? { componentStack: String(info?.componentStack || '').slice(0, 500) } : null),
    });
  }

  reset() {
    this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const secondary = this.props.getSecondaryAction?.(this.reset);
    return <Fallback onRetry={this.reset} secondaryAction={secondary} />;
  }
}

/** Wraps a navigator screen; the fallback keeps a way back out of the screen. */
export function withScreenErrorBoundary(Screen, name) {
  function Guarded(props) {
    const { navigation } = props;
    const getSecondaryAction = (reset) => {
      if (navigation?.canGoBack?.()) {
        return { label: 'Go Back', icon: 'arrow-back', onPress: () => { reset(); navigation.goBack(); } };
      }
      return null;
    };
    return (
      <ErrorBoundary name={name} getSecondaryAction={getSecondaryAction}>
        <Screen {...props} />
      </ErrorBoundary>
    );
  }
  Guarded.displayName = `Guarded(${name || Screen.displayName || Screen.name || 'Screen'})`;
  return Guarded;
}
