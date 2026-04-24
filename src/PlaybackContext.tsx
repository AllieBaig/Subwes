import { createContext, useContext, useState, ReactNode, useCallback, useRef, useEffect } from 'react';

interface PlaybackContextType {
  currentTime: number;
  duration: number;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  // Progress normalized (0-100)
  progress: number;
}

const PlaybackContext = createContext<PlaybackContextType | undefined>(undefined);

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const [currentTime, setCurrentTimeState] = useState(0);
  const [duration, setDurationState] = useState(0);
  
  // Throttle updates for performance
  const lastUpdateRef = useRef<number>(0);
  
  const setCurrentTime = useCallback((time: number) => {
    const now = Date.now();
    // Allow updates at most every 100ms for UI but throttle the actual state if needed
    // However, for smooth progress bars, 100-250ms is good.
    // HTML5 timeupdate is usually 250ms anyway.
    if (now - lastUpdateRef.current > 100 || Math.abs(time - currentTime) > 1) {
      setCurrentTimeState(time);
      lastUpdateRef.current = now;
    }
  }, [currentTime]);

  const setDuration = useCallback((d: number) => {
    setDurationState(d);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <PlaybackContext.Provider value={{
      currentTime,
      duration,
      setCurrentTime,
      setDuration,
      progress
    }}>
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  const context = useContext(PlaybackContext);
  if (context === undefined) {
    throw new Error('usePlayback must be used within a PlaybackProvider');
  }
  return context;
}
