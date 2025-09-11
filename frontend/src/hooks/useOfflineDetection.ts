import { useState, useEffect } from "react";

interface OfflineState {
  isOnline: boolean;
  wasOffline: boolean;
}

export const useOfflineDetection = () => {
  const [state, setState] = useState<OfflineState>({
    isOnline: navigator.onLine,
    wasOffline: false,
  });

  useEffect(() => {
    const handleOnline = () => {
      setState(prevState => ({
        isOnline: true,
        wasOffline: prevState.wasOffline || !prevState.isOnline,
      }));
    };

    const handleOffline = () => {
      setState(prevState => ({
        ...prevState,
        isOnline: false,
        wasOffline: true,
      }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const resetOfflineState = () => {
    setState(prevState => ({
      ...prevState,
      wasOffline: false,
    }));
  };

  return {
    isOnline: state.isOnline,
    wasOffline: state.wasOffline,
    resetOfflineState,
  };
};