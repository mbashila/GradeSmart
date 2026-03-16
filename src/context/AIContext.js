import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { checkOpenAIStatus, getOpenAIKey, setOpenAIKey as saveOpenAIKey } from '../utils/openaiService';

const AIContext = createContext({
  apiKey: '',
  aiStatus: null, // { ok, hasVision, error }
  checking: false,
  setApiKey: () => {},
  refreshStatus: () => {},
  // Legacy aliases so screens don't break
  ollamaStatus: null,
});

export function AIProvider({ children }) {
  const [apiKey, setApiKeyState] = useState('');
  const [aiStatus, setAiStatus] = useState(null);
  const [checking, setChecking] = useState(false);

  // Load saved key on startup
  useEffect(() => {
    (async () => {
      try {
        const key = await getOpenAIKey();
        setApiKeyState(key);
      } catch {}
    })();
  }, []);

  const setApiKey = useCallback(async (key) => {
    const cleaned = key.trim();
    setApiKeyState(cleaned);
    await saveOpenAIKey(cleaned);
  }, []);

  const refreshStatus = useCallback(async () => {
    setChecking(true);
    const status = await checkOpenAIStatus();
    setAiStatus(status);
    setChecking(false);
    return status;
  }, []);

  // Auto-check whenever key changes
  useEffect(() => {
    if (apiKey) {
      refreshStatus();
    }
  }, [apiKey]);

  const value = useMemo(() => ({
    apiKey,
    aiStatus,
    checking,
    setApiKey,
    refreshStatus,
    // Legacy alias — screens read ollamaStatus
    ollamaStatus: aiStatus,
  }), [apiKey, aiStatus, checking, setApiKey, refreshStatus]);

  return (
    <AIContext.Provider value={value}>
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  return useContext(AIContext);
}
