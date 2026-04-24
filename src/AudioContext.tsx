import { useState, createContext, useContext, ReactNode, useEffect, useMemo, useCallback, useRef } from 'react';
import { Track, Playlist } from './types';
import * as db from './db';
import { APP_HISTORY } from './constants/history';
import { useModal } from './components/SafeModal';
import { useSettings } from './SettingsContext';
import { useUIState } from './UIStateContext';

interface AudioContextType {
  tracks: Track[];
  subliminalTracks: Track[];
  playlists: Playlist[];
  addTrack: (file: File, targetPlaylistId?: string) => Promise<string | null>;
  addSubliminalTrack: (file: File) => void;
  removeTrack: (id: string) => void;
  removeSubliminalTrack: (id: string) => void;
  
  createPlaylist: (name: string, initialTrackIds?: string[]) => Promise<string>;
  deletePlaylist: (id: string) => Promise<void>;
  addTrackToPlaylist: (trackId: string, playlistId: string) => Promise<void>;
  addTracksToPlaylist: (trackIds: string[], playlistId: string) => Promise<void>;
  removeTrackFromPlaylist: (trackId: string, playlistId: string) => Promise<void>;
  removeTracksFromPlaylist: (trackIds: string[], playlistId: string) => Promise<void>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  
  playingPlaylistId: string | null;
  setPlayingPlaylistId: (id: string | null) => void;
  resumePlaylist: (id: string) => void;
  
  exportAppData: () => Promise<void>;
  importAppData: (file: File) => Promise<void>;
  relinkTrack: (trackId: string, file: File, isSubliminal: boolean) => Promise<void>;
  getTrackUrl: (id: string, forceRefresh?: boolean) => Promise<string | null>;
  
  currentTrackIndex: number | null;
  setCurrentTrackIndex: (index: number | null) => void;
  currentPlaybackList: Track[];
  playNext: (isAutoEnded?: boolean) => void;
  playPrevious: () => void;
  toggleShuffle: () => void;
  toggleLoop: () => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  
  seekTo: (time: number) => void;
  seekRequest: number | null;
  clearSeekRequest: () => void;
  
  resetServiceWorker: () => Promise<void>;
  clearCacheStorage: () => Promise<void>;
  clearDatabase: () => Promise<void>;
  fullAppReset: () => Promise<void>;
  clearAppCache: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: ReactNode }) {
  const modal = useModal();
  const { settings, updateSubliminalSettings, updateSettings } = useSettings();
  const { setIsLoading, setInitError, showToast, isLoading } = useUIState();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [subliminalTracks, setSubliminalTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [playingPlaylistId, setPlayingPlaylistId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekRequest, setSeekRequest] = useState<number | null>(null);
  
  const trackUrlCache = useRef<Record<string, string>>({});
  const cacheOrder = useRef<string[]>([]);

  const currentPlaybackList = useMemo(() => {
    if (playingPlaylistId) {
      const playlist = playlists.find(p => p.id === playingPlaylistId);
      if (playlist) {
        return playlist.trackIds.map(tid => tracks.find(t => t.id === tid)).filter(Boolean) as Track[];
      }
    }
    return tracks;
  }, [playingPlaylistId, playlists, tracks]);

  const currentTrack = useMemo(() => {
    if (currentTrackIndex === null) return null;
    return currentPlaybackList[currentTrackIndex] || null;
  }, [currentTrackIndex, currentPlaybackList]);

  // Auto-track last played
  useEffect(() => {
    if (currentTrack?.id && isPlaying) {
      const now = Date.now();
      db.saveTrack({ ...currentTrack, lastPlayedAt: now } as db.DBTrack, false);
      setTracks(prev => prev.map(t => t.id === currentTrack.id ? { ...t, lastPlayedAt: now } : t));
    }
  }, [currentTrack?.id, isPlaying]);

  // Initial Load
  useEffect(() => {
    let isMounted = true;
    const startupGuard = setTimeout(() => {
      if (isMounted && isLoading) {
        setInitError("Environment synchronization delay. Attempting system recovery.");
        setIsLoading(false);
      }
    }, 10000);

    async function loadData() {
      try {
        const [savedTracks, savedSubTracks, savedPlaylists] = await Promise.all([
          db.getTracks(false),
          db.getTracks(true),
          db.getPlaylists()
        ]);

        if (isMounted) {
          setTracks(savedTracks || []);
          setSubliminalTracks(savedSubTracks || []);
          setPlaylists(Array.isArray(savedPlaylists) ? savedPlaylists : []);
        }
      } catch (err) {
        console.warn("Defensive Load Trace:", err);
        if (isMounted) setInitError("Database sync issue.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
          clearTimeout(startupGuard);
        }
      }
    }
    loadData();
    return () => { 
      isMounted = false; 
      clearTimeout(startupGuard); 
      Object.values(trackUrlCache.current).forEach(url => URL.revokeObjectURL(url));
    };
  }, [setIsLoading, setInitError]);

  const getTrackUrl = useCallback(async (id: string, forceRefresh?: boolean) => {
    if (!forceRefresh && trackUrlCache.current[id]) {
      cacheOrder.current = cacheOrder.current.filter(item => item !== id);
      cacheOrder.current.push(id);
      return trackUrlCache.current[id];
    }
    
    if (trackUrlCache.current[id]) {
      URL.revokeObjectURL(trackUrlCache.current[id]);
      delete trackUrlCache.current[id];
      cacheOrder.current = cacheOrder.current.filter(item => item !== id);
    }

    if (cacheOrder.current.length >= 15) {
      const oldestId = cacheOrder.current.shift();
      if (oldestId && trackUrlCache.current[oldestId]) {
        URL.revokeObjectURL(trackUrlCache.current[oldestId]);
        delete trackUrlCache.current[oldestId];
      }
    }

    const blob = await db.getTrackBlob(id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      trackUrlCache.current[id] = url;
      cacheOrder.current.push(id);
      return url;
    }
    return null;
  }, []);

  const validateAudioFile = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const iOSCompatibleExts = ['mp3', 'm4a', 'aac', 'wav', 'mp4', 'm4p', 'm4b', 'aiff'];
      const audio = new Audio();
      const url = URL.createObjectURL(file);
      let timeoutId: any;
      let resolved = false;
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        URL.revokeObjectURL(url);
        audio.src = '';
      };
      audio.oncanplaythrough = () => { if (!resolved) { resolved = true; cleanup(); resolve(true); } };
      audio.onerror = () => { if (!resolved) { resolved = true; cleanup(); resolve(ext ? iOSCompatibleExts.includes(ext) : false); } };
      timeoutId = setTimeout(() => { if (!resolved) { resolved = true; cleanup(); resolve(ext ? iOSCompatibleExts.includes(ext) : false); } }, 3000);
      audio.src = url;
      audio.load();
    });
  };

  const addTrack = async (file: File, targetPlaylistId?: string) => {
    if (!(await validateAudioFile(file))) {
      showToast(`Unsupported format: ${file.name}`);
      return null;
    }
    const id = Math.random().toString(36).substr(2, 9);
    const newTrack: db.DBTrack = {
      id,
      name: file.name.replace(/\.[^/.]+$/, ""),
      url: '', 
      artist: 'Unknown Artist',
      blob: file,
      createdAt: Date.now()
    };
    await db.saveTrack(newTrack, false);
    const { blob, ...metadata } = newTrack;
    setTracks(prev => [...prev, metadata]);
    if (targetPlaylistId) await addTrackToPlaylist(id, targetPlaylistId);
    if (currentTrackIndex === null) setCurrentTrackIndex(0);
    return id;
  };

  const addSubliminalTrack = async (file: File) => {
    if (!(await validateAudioFile(file))) return;
    const id = Math.random().toString(36).substr(2, 9);
    const newTrack: db.DBTrack = { id, name: file.name.replace(/\.[^/.]+$/, ""), url: '', blob: file, createdAt: Date.now() };
    await db.saveTrack(newTrack, true);
    const { blob, ...metadata } = newTrack;
    setSubliminalTracks(prev => [...prev, metadata]);
    if (!settings.subliminal.selectedTrackId) updateSubliminalSettings({ selectedTrackId: id });
  };

  const removeTrack = async (id: string) => {
    await db.deleteTrack(id, false);
    setTracks(prev => prev.filter(t => t.id !== id));
  };

  const removeSubliminalTrack = async (id: string) => {
    await db.deleteTrack(id, true);
    setSubliminalTracks(prev => prev.filter(t => t.id !== id));
  };

  const createPlaylist = async (name: string, initialTrackIds: string[] = []) => {
    const id = Math.random().toString(36).substr(2, 9);
    const playlist: Playlist = { id, name, trackIds: initialTrackIds, createdAt: Date.now() };
    await db.savePlaylist(playlist);
    setPlaylists(prev => [...prev, playlist]);
    showToast(`Created playlist "${name}"`);
    return id;
  };

  const deletePlaylist = async (id: string) => {
    await db.deletePlaylist(id);
    setPlaylists(prev => prev.filter(p => p.id !== id));
  };

  const addTracksToPlaylist = async (trackIds: string[], playlistId: string) => {
    let updated: Playlist | null = null;
    setPlaylists(prev => {
      const p = prev.find(x => x.id === playlistId);
      if (!p) return prev;
      updated = { ...p, trackIds: Array.from(new Set([...p.trackIds, ...trackIds])) };
      return prev.map(x => x.id === playlistId ? updated! : x);
    });
    if (updated) await db.savePlaylist(updated);
  };

  const addTrackToPlaylist = (tid: string, pid: string) => addTracksToPlaylist([tid], pid);

  const removeTracksFromPlaylist = async (trackIds: string[], playlistId: string) => {
    let updated: Playlist | null = null;
    setPlaylists(prev => {
      const p = prev.find(x => x.id === playlistId);
      if (!p) return prev;
      updated = { ...p, trackIds: p.trackIds.filter(id => !trackIds.includes(id)) };
      return prev.map(x => x.id === playlistId ? updated! : x);
    });
    if (updated) await db.savePlaylist(updated);
  };

  const removeTrackFromPlaylist = (tid: string, pid: string) => removeTracksFromPlaylist([tid], pid);

  const renamePlaylist = async (id: string, name: string) => {
    setPlaylists(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    const p = playlists.find(x => x.id === id);
    if (p) await db.savePlaylist({ ...p, name });
  };

  const resumePlaylist = (id: string) => {
    const playlist = playlists.find(p => p.id === id);
    if (!playlist || playlist.trackIds.length === 0) return;
    const memory = settings.playlistMemory[id];
    let idx = 0;
    let pos = 0;
    if (memory) {
      const found = playlist.trackIds.indexOf(memory.trackId);
      if (found !== -1) { idx = found; pos = memory.position; }
    }
    setPlayingPlaylistId(id);
    setCurrentTrackIndex(idx);
    if (pos > 0) setTimeout(() => setSeekRequest(pos), 100);
    setIsPlaying(true);
  };

  const toggleShuffle = () => {
    updateSettings({ shuffle: !settings.shuffle });
    showToast(settings.shuffle ? "Shuffle off" : "Shuffle on");
  };

  const toggleLoop = () => {
    const modes: ('none' | 'one' | 'all')[] = ['none', 'one', 'all'];
    const nextMode = modes[(modes.indexOf(settings.loop) + 1) % modes.length];
    updateSettings({ loop: nextMode });
    showToast(`Loop: ${nextMode}`);
  };

  const playNext = useCallback((isAutoEnded = false) => {
    if (currentPlaybackList.length === 0) return;
    if (isAutoEnded && settings.loop === 'one') { setSeekRequest(0); setIsPlaying(true); return; }
    let nextIndex: number;
    if (settings.shuffle) {
      nextIndex = Math.floor(Math.random() * currentPlaybackList.length);
    } else {
      const isLast = currentTrackIndex === null || currentTrackIndex >= currentPlaybackList.length - 1;
      if (isAutoEnded && isLast && settings.loop !== 'all') { setIsPlaying(false); return; }
      nextIndex = isLast ? 0 : (currentTrackIndex || 0) + 1;
    }
    setCurrentTrackIndex(nextIndex);
    setIsPlaying(true);
  }, [currentPlaybackList, currentTrackIndex, settings.loop, settings.shuffle]);

  const playPrevious = useCallback(() => {
    if (currentPlaybackList.length === 0) return;
    const idx = (currentTrackIndex === null || currentTrackIndex === 0) ? currentPlaybackList.length - 1 : currentTrackIndex - 1;
    setCurrentTrackIndex(idx);
    setIsPlaying(true);
  }, [currentPlaybackList, currentTrackIndex]);

  const exportAppData = async () => {
    try {
      const [tData, sData, pData, sSet] = await Promise.all([db.getTracksWithBlobs(false), db.getTracksWithBlobs(true), db.getPlaylists(), db.getSettings()]);
      const blob = new Blob([JSON.stringify({ version: "Refactored", tracks: tData, subliminalTracks: sData, playlists: pData, settings: sSet })], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `mindful_backup_${Date.now()}.json`; a.click();
    } catch (e) { showToast("Export failed"); }
  };

  const importAppData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!data.tracks) throw new Error("Invalid");
      if (!(await modal.confirm({ title: "Import Data", subtitle: "Settings will be overwritten." }))) return;
      setIsLoading(true);
      if (data.settings) { await db.saveSettings(data.settings); updateSettings(data.settings); }
      for (const t of data.tracks) await db.saveTrack(t, false);
      for (const t of data.subliminalTracks || []) await db.saveTrack(t, true);
      for (const p of data.playlists || []) await db.savePlaylist(p);
      window.location.reload();
    } catch (e) { setIsLoading(false); showToast("Import failed"); }
  };

  const relinkTrack = async (id: string, file: File, sub: boolean) => {
    try {
      if (!(await validateAudioFile(file))) return;
      const track = (sub ? subliminalTracks : tracks).find(t => t.id === id);
      if (track) { await db.saveTrack({ ...track, blob: file } as any, sub); await getTrackUrl(id, true); showToast("Relinked"); }
    } catch (e) { showToast("Relink failed"); }
  };

  const resetServiceWorker = async () => { if ('serviceWorker' in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); for (const r of regs) await r.unregister(); showToast("SW Unregistered"); } };
  const clearCacheStorage = async () => { if ('caches' in window) { const keys = await caches.keys(); for (const k of keys) await caches.delete(k); showToast("Cache Cleared"); } };
  const clearDatabase = async () => { if (await modal.confirm({ title: "Clear Database", isDestructive: true })) { await db.clearAllData(); setTracks([]); setSubliminalTracks([]); setPlaylists([]); } };
  const fullAppReset = async () => { if (await modal.confirm({ title: "Factory Reset", isDestructive: true })) { await resetServiceWorker(); await clearCacheStorage(); await db.clearAllData(); localStorage.clear(); window.location.reload(); } };
  const clearAppCache = () => { trackUrlCache.current = {}; cacheOrder.current = []; showToast("Mem cache cleared"); };

  return (
    <AudioContext.Provider value={{
      tracks, subliminalTracks, playlists, addTrack, addSubliminalTrack, removeTrack, removeSubliminalTrack,
      createPlaylist, deletePlaylist, addTrackToPlaylist, addTracksToPlaylist, removeTrackFromPlaylist, removeTracksFromPlaylist, renamePlaylist,
      playingPlaylistId, setPlayingPlaylistId, resumePlaylist, exportAppData, importAppData, relinkTrack, getTrackUrl,
      currentTrackIndex, setCurrentTrackIndex, currentPlaybackList, playNext, playPrevious, toggleShuffle, toggleLoop, isPlaying, setIsPlaying,
      seekTo: setSeekRequest, seekRequest, clearSeekRequest: () => setSeekRequest(null),
      resetServiceWorker, clearCacheStorage, clearDatabase, fullAppReset, clearAppCache
    }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) throw new Error('useAudio must be used within an AudioProvider');
  return context;
}
