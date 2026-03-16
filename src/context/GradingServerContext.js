import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  checkGradingServer,
  getGradingServerUrl,
  setGradingServerUrl as saveUrl,
  initGradingServer,
} from '../utils/gradingServerService';

const GradingServerContext = createContext({
  serverUrl: '',
  serverStatus: null,
  checking: false,
  setServerUrl: () => {},
  refreshStatus: () => {},
});

export function GradingServerProvider({ children }) {
  const [serverUrl, setUrlState] = useState('');
  const [serverStatus, setServerStatus] = useState(null);
  const [checking, setChecking] = useState(false);

  // Load saved URL and auto-check on startup
  useEffect(() => {
    (async () => {
      await initGradingServer();
      const url = getGradingServerUrl();
      setUrlState(url);
    })();
  }, []);

  const setServerUrl = useCallback(async (url) => {
    const cleaned = url.replace(/\/+$/, '');
    setUrlState(cleaned);
    await saveUrl(cleaned);
  }, []);

  const refreshStatus = useCallback(async () => {
    setChecking(true);
    const status = await checkGradingServer();
    setServerStatus(status);
    setChecking(false);
    return status;
  }, []);

  // Auto-check whenever URL changes
  useEffect(() => {
    if (serverUrl) {
      refreshStatus();
    }
  }, [serverUrl]);

  const value = useMemo(() => ({
    serverUrl,
    serverStatus,
    checking,
    setServerUrl,
    refreshStatus,
  }), [serverUrl, serverStatus, checking, setServerUrl, refreshStatus]);

  return (
    <GradingServerContext.Provider value={value}>
      {children}
    </GradingServerContext.Provider>
  );
}

export function useGradingServer() {
  return useContext(GradingServerContext);
}
