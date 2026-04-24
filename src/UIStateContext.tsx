import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { CURRENT_VERSION } from './constants/history';

export type TabType = 'library' | 'player' | 'settings';

interface UIStateContextType {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  initError: string | null;
  setInitError: (error: string | null) => void;
  toast: string | null;
  showToast: (message: string) => void;
  isOffline: boolean;
  swStatus: 'active' | 'waiting' | 'installing' | 'none';
  swSupported: boolean;
  activeTabRequest: string | null;
  clearTabRequest: () => void;
  navigateTo: (tab: string) => void;
}

const UIStateContext = createContext<UIStateContextType | undefined>(undefined);

export function UIStateProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabType>('library');
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [activeTabRequest, setActiveTabRequest] = useState<string | null>(null);
  const [swStatus, setSwStatus] = useState<'active' | 'waiting' | 'installing' | 'none'>('none');
  const swSupported = 'serviceWorker' in navigator;

  const navigateTo = useCallback((tab: string) => setActiveTabRequest(tab), []);
  const clearTabRequest = useCallback(() => setActiveTabRequest(null), []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor Service Worker Status
  useEffect(() => {
    if (!swSupported) return;
    
    // Defensive: Version Check & Cache Busting
    const lastVersion = localStorage.getItem('app_version');
    if (lastVersion && lastVersion !== CURRENT_VERSION) {
      console.warn("System Update: Version mismatch detected. Stabilizing environment.");
      localStorage.clear(); 
      localStorage.setItem('app_version', CURRENT_VERSION);
      window.location.reload();
      return;
    }
    localStorage.setItem('app_version', CURRENT_VERSION);

    const updateStatus = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          setSwStatus('none');
          return;
        }

        if (registration.installing) {
          setSwStatus('installing');
        } else if (registration.waiting) {
          setSwStatus('waiting');
        } else if (registration.active) {
          setSwStatus('active');
        }

        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  setSwStatus('waiting');
                } else {
                  setSwStatus('active');
                }
              }
            };
          }
        };
      } catch (err) {
        console.error('[SW] Status check failed:', err);
      }
    };

    updateStatus();
    navigator.serviceWorker.addEventListener('controllerchange', updateStatus);
    const interval = setInterval(updateStatus, 5000);
    return () => {
      clearInterval(interval);
      navigator.serviceWorker.removeEventListener('controllerchange', updateStatus);
    };
  }, [swSupported]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => {
      setToast(prev => prev === message ? null : prev);
    }, 4000);
  }, []);

  return (
    <UIStateContext.Provider value={{
      activeTab,
      setActiveTab,
      isLoading,
      setIsLoading,
      initError,
      setInitError,
      toast,
      showToast,
      isOffline,
      swStatus,
      swSupported,
      activeTabRequest,
      clearTabRequest,
      navigateTo
    }}>
      {children}
    </UIStateContext.Provider>
  );
}

export function useUIState() {
  const context = useContext(UIStateContext);
  if (context === undefined) {
    throw new Error('useUIState must be used within a UIStateProvider');
  }
  return context;
}
