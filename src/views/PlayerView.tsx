import React, { useState, useMemo } from 'react';
import { useAudio } from '../AudioContext';
import { usePlayback } from '../PlaybackContext';
import { useSettings } from '../SettingsContext';
import { useUIState } from '../UIStateContext';
import { NATURE_SOUNDS } from '../constants';
import { AnimationStyle } from '../types';
import { 
  Play, Pause, SkipBack, SkipForward, 
  Volume2, Activity, Wind, CloudRain, 
  Sliders, ChevronDown, Check, X, 
  Moon, Zap, Focus as FocusIcon, List, Plus,
  Shuffle, Repeat, Repeat1, MoreHorizontal,
  ChevronLeft, ChevronRight, Music as MusicIcon, Flame, Droplets, Waves, Trees,
  Timer, Monitor, Ear
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { ArtworkImage } from '../components/ArtworkImage';

interface PlayerViewProps {
  onBack?: () => void;
}

const WaveformAnimation = ({ isPlaying }: { isPlaying: boolean }) => {
  const { currentTime } = usePlayback();
  return (
    <motion.div 
      key="waveform"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="w-full max-w-[280px] h-32 flex items-center justify-center gap-1.5"
    >
      {[...Array(24)].map((_, i) => (
        <motion.div
          key={i}
          animate={{ 
            height: isPlaying ? [12, 48, 24, 64, 16][(i + Math.floor(currentTime)) % 5] : 8,
            opacity: isPlaying ? [0.2, 0.5, 0.3, 0.6, 0.4][(i + Math.floor(currentTime)) % 5] : 0.1
          }}
          transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
          className="w-1 bg-apple-blue rounded-full"
        />
      ))}
    </motion.div>
  );
};

const PlaybackControls = ({ settings, seekTo }: { settings: any, seekTo: (t: number) => void }) => {
  const { currentTime, duration } = usePlayback();
  
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex flex-col gap-2 ${!settings.showArtwork ? 'mb-8' : ''}`}>
      <div className="relative h-6 flex items-center">
        <input 
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={(e) => seekTo(parseFloat(e.target.value))}
          className={`w-full ${settings.bigTouchMode ? (settings.showArtwork ? 'h-2' : 'h-3') : (settings.showArtwork ? 'h-1' : 'h-2')} bg-secondary-system-background rounded-full appearance-none cursor-pointer accent-system-label`}
        />
      </div>
      <div className={`flex justify-between font-bold text-system-secondary-label tabular-nums ${settings.bigTouchMode ? (!settings.showArtwork ? 'text-sm' : 'text-[11px]') : (!settings.showArtwork ? 'text-xs' : 'text-[10px]')}`}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
};

const PresetButton = ({ icon: Icon, label, color, onClick }: any) => (
  <button 
    onClick={onClick}
    className="flex flex-col items-center gap-3 p-5 bg-system-background border border-apple-border rounded-[2.5rem] hover:bg-secondary-system-background active:scale-95 transition-all shadow-sm"
  >
    <div className={`w-12 h-12 flex-shrink-0 ${color} text-white rounded-2xl flex items-center justify-center shadow-lg shadow-black/5`}>
      <Icon size={22} />
    </div>
    <span className="text-[10px] font-bold uppercase tracking-widest text-system-secondary-label truncate w-full text-center">{label}</span>
  </button>
);

const LayerAccordion = ({ 
  icon: Icon, label, isEnabled, onToggle, vol, setVol, 
  gainDb, setGainDb, normalize, setNormalize, 
  color, subtitle, children, onApplyPreset 
}: any) => {
  const [isToolsExpanded, setIsToolsExpanded] = useState(false);

  return (
    <div className="bg-secondary-system-background border border-apple-border rounded-[2rem] overflow-hidden transition-all shadow-sm">
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div className={`w-10 h-10 ${isEnabled ? 'bg-system-background shadow-sm' : 'bg-system-background/50'} rounded-2xl flex-shrink-0 flex items-center justify-center ${isEnabled ? color : 'text-system-tertiary-label'} transition-all`}>
            <Icon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h5 className="text-sm font-black tracking-tight truncate text-system-label">{label}</h5>
            {subtitle && <p className="text-[9px] text-system-secondary-label uppercase font-black tracking-widest truncate">{subtitle}</p>}
          </div>
        </div>
        <button 
          onClick={() => onToggle(!isEnabled)}
          className={`flex-shrink-0 w-10 h-6 rounded-full relative transition-colors ${isEnabled ? (color.includes('blue') ? 'bg-apple-blue' : color.includes('purple') ? 'bg-purple-500' : color.includes('green') ? 'bg-green-500' : color.includes('amber') ? 'bg-amber-800' : color.includes('rose') ? 'bg-rose-600' : 'bg-orange-500') : 'bg-system-tertiary-label'}`}
        >
          <motion.div className="absolute top-1 left-1 bg-white w-4 h-4 rounded-full" animate={{ x: isEnabled ? 16 : 0 }} />
        </button>
      </div>
      
      <AnimatePresence>
        {isEnabled && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-5 pb-6 space-y-6"
          >
            {/* Volume Section */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-black text-system-tertiary-label uppercase tracking-widest">Volume (%)</span>
                <input 
                  type="number"
                  value={Math.round(vol * 100)}
                  onChange={(e) => setVol(Math.min(1, Math.max(0, (parseInt(e.target.value) || 0) / 100)))}
                  className="w-12 h-6 bg-system-background border border-apple-border rounded-md text-[10px] font-black text-center focus:outline-none tabular-nums"
                />
              </div>
              <div className="flex items-center gap-4">
                <input 
                  type="range" min={0} max={1} step={0.01} value={vol}
                  onChange={(e) => setVol(parseFloat(e.target.value))}
                  className="flex-1 h-1 bg-apple-border rounded-full appearance-none accent-system-label"
                />
              </div>
            </div>

            {/* Gain Section */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-black text-system-tertiary-label uppercase tracking-widest">Gain (dB)</span>
                <input 
                  type="number"
                  value={gainDb}
                  onChange={(e) => setGainDb(Math.min(0, Math.max(-60, parseInt(e.target.value) || 0)))}
                  className="w-12 h-6 bg-system-background border border-apple-border rounded-md text-[10px] font-black text-center focus:outline-none tabular-nums"
                />
              </div>
              <div className="flex items-center gap-4">
                <input 
                  type="range" min={-60} max={0} step={1} value={gainDb}
                  onChange={(e) => setGainDb(parseInt(e.target.value))}
                  className="flex-1 h-1 bg-apple-border rounded-full appearance-none accent-apple-blue"
                />
              </div>
            </div>

            {/* Layer Specific Children (e.g. Hz inputs) */}
            {children && (
              <div className="pt-2 border-t border-apple-border/50">
                {children}
              </div>
            )}

            {/* Audio Tools Nested Section */}
            <div className="pt-2 border-t border-apple-border/50">
              <button 
                onClick={() => setIsToolsExpanded(!isToolsExpanded)}
                className="w-full flex items-center justify-between py-2 group"
              >
                <div className="flex items-center gap-3">
                   <div className="w-6 h-6 bg-apple-blue/10 text-apple-blue rounded-lg flex items-center justify-center">
                      <Sliders size={12} />
                   </div>
                   <span className="text-[10px] font-black text-system-label uppercase tracking-widest">Audio Tools</span>
                </div>
                <ChevronRight size={14} className={`text-system-tertiary-label transition-transform ${isToolsExpanded ? 'rotate-90 text-apple-blue' : ''}`} />
              </button>

              <AnimatePresence>
                {isToolsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-4 pt-4"
                  >
                     <div className="flex items-center justify-between p-3 bg-system-background rounded-xl border border-apple-border">
                        <div className="flex flex-col">
                           <span className="text-[9px] font-black text-system-label uppercase">Normalization</span>
                           <span className="text-[8px] font-bold text-system-secondary-label uppercase">{normalize ? 'Enabled' : 'Disabled'}</span>
                        </div>
                        <button 
                          onClick={() => setNormalize(!normalize)}
                          className={`w-8 h-5 rounded-full relative transition-colors ${normalize ? 'bg-apple-blue' : 'bg-system-tertiary-label'}`}
                        >
                          <motion.div className="absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full" animate={{ x: normalize ? 12 : 0 }} />
                        </button>
                     </div>

                     <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => onApplyPreset('soft')} className="py-2.5 bg-system-background border border-apple-border rounded-xl text-[9px] font-black uppercase text-system-secondary-label active:scale-95 transition-transform">Soft Safe</button>
                        <button onClick={() => onApplyPreset('night')} className="py-2.5 bg-system-background border border-apple-border rounded-xl text-[9px] font-black uppercase text-system-secondary-label active:scale-95 transition-transform">Night</button>
                        <button onClick={() => onApplyPreset('focus')} className="py-2.5 bg-system-background border border-apple-border rounded-xl text-[9px] font-black uppercase text-system-secondary-label active:scale-95 transition-transform col-span-2">Focus Preset</button>
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const HzSelector = ({ value, onChange, color, presets }: { value: number, onChange: (v: number) => void, color: string, presets?: number[] }) => {
  const { settings } = useSettings();
  const inputMode = settings.hzInputMode || 'slider';
  
  const handleScroll = (deltaY: number) => {
    const step = 1;
    const newVal = Math.min(1900, Math.max(20, value + (deltaY > 0 ? -step : step)));
    onChange(newVal);
  };

  const colorClass = color === 'rose' ? 'accent-rose-500 text-rose-600' : 
                     color === 'purple' ? 'accent-purple-500 text-purple-600' :
                     color === 'amber' ? 'accent-amber-500 text-amber-600' :
                     color === 'indigo' ? 'accent-indigo-500 text-indigo-600' :
                     'accent-apple-blue text-apple-blue';

  const borderColorClass = color === 'rose' ? 'border-rose-500/20' : 
                           color === 'purple' ? 'border-purple-500/20' :
                           color === 'amber' ? 'border-amber-500/20' :
                           color === 'indigo' ? 'border-indigo-500/20' :
                           'border-apple-blue/20';

  const bgActiveColorClass = color === 'rose' ? 'bg-rose-500' : 
                             color === 'purple' ? 'bg-purple-500' :
                             color === 'amber' ? 'bg-amber-500' :
                             color === 'indigo' ? 'bg-indigo-500' :
                             'bg-apple-blue';

  return (
    <div className="space-y-4">
      {inputMode === 'slider' ? (
        <div className="flex items-center gap-4">
          <input 
            type="range" min={20} max={1900} step={1} value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className={`flex-1 h-1 bg-apple-border rounded-full appearance-none ${colorClass.split(' ')[0]}`}
          />
          <div className="flex items-center gap-2">
            <input 
              type="number"
              value={value}
              onChange={(e) => onChange(Math.min(1900, Math.max(20, parseInt(e.target.value) || 0)))}
              className="w-16 h-8 bg-system-background border border-apple-border rounded-xl text-xs font-black text-center focus:outline-none tabular-nums shadow-inner"
            />
            <span className="text-[9px] font-black text-system-tertiary-label uppercase">Hz</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div 
            className={`w-full max-w-[200px] h-32 bg-system-background border-2 ${borderColorClass} rounded-[2rem] relative flex flex-col items-center justify-center overflow-hidden touch-none shadow-inner`}
            onWheel={(e) => {
              e.preventDefault();
              handleScroll(e.deltaY);
            }}
          >
            <div className="absolute inset-x-0 h-10 border-y border-apple-border/30 top-1/2 -translate-y-1/2 bg-secondary-system-background/20" />
            
            <motion.div 
              className="flex flex-col items-center gap-1 py-10"
              animate={{ y: -(value % 100) / 4 }}
            >
              {[value + 2, value + 1, value, value - 1, value - 2].map((v, i) => (
                <div 
                  key={i} 
                  className={`text-center transition-all duration-200 tabular-nums ${i === 2 ? `text-2xl font-black ${colorClass.split(' ')[1]}` : 'text-sm font-bold text-system-tertiary-label opacity-30 scale-90'}`}
                >
                  {v > 1900 || v < 20 ? '---' : `${v}Hz`}
                </div>
              ))}
            </motion.div>

            {/* Gesture Overlay for mobile */}
            <div 
              className="absolute inset-0 z-10"
              onTouchMove={(e) => {
                // Simplified touch handling for demo/mobile scroll wheel feel
                const touch = e.touches[0];
                const rect = e.currentTarget.getBoundingClientRect();
                const relativeY = (touch.clientY - rect.top) / rect.height;
                const delta = relativeY > 0.5 ? -1 : 1; 
                if (Math.random() > 0.7) handleScroll(delta);
              }}
            />
          </div>
          <p className="text-[8px] font-black text-system-tertiary-label uppercase tracking-widest mt-3">Scroll or Swipe to Adjust</p>
        </div>
      )}

      {presets && presets.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 mt-2">
          {presets.map(fq => (
            <button 
              key={fq}
              onClick={() => onChange(fq)}
              className={`py-2 rounded-xl border text-[9px] font-black transition-all active:scale-95 ${value === fq ? `${bgActiveColorClass} text-white border-transparent shadow-md` : 'bg-system-background border-apple-border text-system-secondary-label'}`}
            >
              {fq}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function PlayerView({ onBack }: PlayerViewProps) {
  const { 
    tracks, 
    subliminalTracks,
    playlists,
    currentTrackIndex, 
    isPlaying, 
    setIsPlaying, 
    seekTo,
    playNext,
    playPrevious,
    toggleShuffle,
    toggleLoop,
    playingPlaylistId,
    currentPlaybackList,
    addTrack
  } = useAudio();

  const { settings, updateSettings, updateSubliminalSettings, updateBinauralSettings, updateNatureSettings, updateNoiseSettings, updateDidgeridooSettings, updatePureHzSettings, updateIsochronicSettings, updateSolfeggioSettings, updateAudioTools, updateSleepTimer } = useSettings();
  const { showToast } = useUIState();

  const { currentTime, duration, progress } = usePlayback();

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const toggleGroup = (groupId: string) => {
    setExpandedGroup(prev => prev === groupId ? null : groupId);
  };

  const currentTrack = currentTrackIndex !== null ? currentPlaybackList[currentTrackIndex] : null;

  const currentPlaylist = playingPlaylistId ? playlists.find(p => p.id === playingPlaylistId) : null;
  const currentPosition = currentTrackIndex !== null ? `${currentTrackIndex + 1}/${currentPlaybackList.length}` : "";

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const activeLayersLabel = useMemo(() => {
    const layers = [
      settings.subliminal.isEnabled && "Subliminal",
      settings.binaural.isEnabled && "Binaural",
      settings.nature.isEnabled && settings.nature.type,
      settings.noise.isEnabled && `${settings.noise.type} Noise`,
      settings.didgeridoo.isEnabled && "Didgeridoo",
      settings.pureHz.isEnabled && "Pure Hz",
      settings.isochronic.isEnabled && "Isochronic",
      settings.solfeggio.isEnabled && "Solfeggio"
    ].filter(Boolean) as string[];
    
    if (layers.length === 0) return "Standard Audio";
    return layers.join(' • ');
  }, [settings]);

  const applyPreset = (mode: 'sleep' | 'focus' | 'relax') => {
    if (mode === 'sleep') {
      updateSubliminalSettings({ isEnabled: true, volume: 0.08 });
      updateBinauralSettings({ isEnabled: true, leftFreq: 150, rightFreq: 152, volume: 0.03 });
      updateNatureSettings({ isEnabled: true, type: 'rain', volume: 0.4 });
      updateNoiseSettings({ isEnabled: false });
    } else if (mode === 'focus') {
      updateSubliminalSettings({ isEnabled: true, volume: 0.12 });
      updateBinauralSettings({ isEnabled: true, leftFreq: 200, rightFreq: 214, volume: 0.06 });
      updateNatureSettings({ isEnabled: false });
      updateNoiseSettings({ isEnabled: true, type: 'white', volume: 0.15 });
    } else if (mode === 'relax') {
      updateSubliminalSettings({ isEnabled: true, volume: 0.1 });
      updateBinauralSettings({ isEnabled: true, leftFreq: 200, rightFreq: 208, volume: 0.05 });
      updateNatureSettings({ isEnabled: true, type: 'ocean', volume: 0.5 });
      updateNoiseSettings({ isEnabled: false });
    }
  };

  const getAnimationProps = (style: AnimationStyle) => {
    if (style === 'off' || !style) return { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } };
    
    let currentStyle: AnimationStyle = style;
    if (style === 'random') {
      const styles: AnimationStyle[] = ['slide-up', 'slide-down', 'slide-left', 'slide-right'];
      currentStyle = styles[Math.floor(Math.random() * styles.length)];
    }

    switch (currentStyle) {
      case 'slide-up': return { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } };
      case 'slide-down': return { initial: { y: '-100%' }, animate: { y: 0 }, exit: { y: '-100%' } };
      case 'slide-left': return { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } };
      case 'slide-right': return { initial: { x: '-100%' }, animate: { x: 0 }, exit: { x: '-100%' } };
      default: return { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } };
    }
  };

  const getPanelAnimationProps = () => {
    if (settings.animationStyle === 'off') return { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } };
    
    // Panel always slides from top or bottom based on setting
    if (settings.hiddenLayersPosition === 'top') {
      return { initial: { y: '-100%' }, animate: { y: 0 }, exit: { y: '-100%' } };
    }
    return { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } };
  };

  const animationProps = useMemo(() => getAnimationProps(settings.animationStyle), [settings.animationStyle]);
  const panelAnimationProps = useMemo(() => getPanelAnimationProps(), [settings.hiddenLayersPosition, settings.animationStyle]);

  // Initial Artwork Visibility Logic
  React.useEffect(() => {
    if (settings.alwaysHideArtworkByDefault && settings.showArtwork) {
      updateSettings({ showArtwork: false });
    }
  }, []);

  const applyLayerPreset = (layer: string, preset: 'soft' | 'night' | 'focus') => {
    const configs = {
      soft: { volume: 0.1, gainDb: -12, normalize: true },
      night: { volume: 0.05, gainDb: -24, normalize: true },
      focus: { volume: 0.15, gainDb: -6, normalize: false }
    };
    const config = configs[preset as keyof typeof configs];
    
    switch(layer) {
      case 'subliminal': updateSubliminalSettings(config); break;
      case 'binaural': updateBinauralSettings(config); break;
      case 'nature': updateNatureSettings(config); break;
      case 'noise': updateNoiseSettings(config); break;
      case 'didgeridoo': updateDidgeridooSettings(config); break;
      case 'pureHz': updatePureHzSettings(config); break;
      case 'isochronic': updateIsochronicSettings(config); break;
      case 'solfeggio': updateSolfeggioSettings(config); break;
    }
  };

  if (!currentTrack) return null;

  return (
    <div className={`h-full flex flex-col items-center justify-between select-none relative w-full max-w-2xl mx-auto bg-system-background overflow-hidden ${settings.bigTouchMode ? 'pb-16' : 'pb-12'}`}>
      {/* Top Bar */}
      <header className={`w-full flex items-center justify-between ${settings.bigTouchMode ? 'px-8 h-24' : 'px-6 h-20'} flex-shrink-0`}>
        <button 
          onClick={onBack}
          className={`${settings.bigTouchMode ? 'w-14 h-14' : 'w-10 h-10'} -ml-2 flex items-center justify-center text-system-label hover:bg-secondary-system-background rounded-full transition-colors`}
        >
          <ChevronDown size={settings.bigTouchMode ? 32 : 28} />
        </button>
        <h1 className={`font-bold uppercase tracking-[0.25em] text-system-secondary-label ${settings.bigTouchMode ? 'text-xs' : 'text-[10px]'}`}>Now Playing</h1>
        <button className={`${settings.bigTouchMode ? 'w-14 h-14' : 'w-10 h-10'} -mr-2 flex items-center justify-center text-system-label hover:bg-secondary-system-background rounded-full transition-colors`}>
          <MoreHorizontal size={settings.bigTouchMode ? 28 : 24} />
        </button>
      </header>

      {/* Main Art & Info */}
      <div className={`flex-1 flex flex-col items-center justify-center w-full px-8 ${settings.bigTouchMode ? 'gap-12' : 'gap-10'} ${!settings.showArtwork ? 'py-4' : ''}`}>
        {/* Album Art */}
        <AnimatePresence mode="wait">
          {settings.showArtwork ? (
            <motion.div 
              key="artwork"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: isPlaying ? 1 : 0.92 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
              className={`w-full ${settings.bigTouchMode ? 'max-w-[400px]' : 'max-w-[340px]'} aspect-square bg-system-background rounded-[2.5rem] shadow-[0_20px_40px_rgba(0,0,0,0.06)] border border-apple-border overflow-hidden relative`}
            >
              <ArtworkImage 
                src={currentTrack.artwork} 
                className="w-full h-full" 
                iconSize={settings.bigTouchMode ? 140 : 120} 
              />
            </motion.div>
          ) : (
            <WaveformAnimation isPlaying={isPlaying} />
          )}
        </AnimatePresence>
        
        {/* Track Title & Artist */}
        <div className={`text-center w-full transition-all duration-500 ${settings.showArtwork ? 'max-w-sm' : 'max-w-xl'}`}>
          <h2 className={`font-extrabold tracking-tight text-system-label line-clamp-1 mb-2 transition-all ${!settings.showArtwork ? (settings.bigTouchMode ? 'text-6xl mb-4' : 'text-5xl mb-3') : (settings.bigTouchMode ? 'text-4xl' : 'text-3xl')}`}>
            {currentTrack.name}
          </h2>
          <p className={`text-system-secondary-label font-bold mb-8 transition-all ${!settings.showArtwork ? (settings.bigTouchMode ? 'text-2xl' : 'text-xl') : (settings.bigTouchMode ? 'text-xl' : 'text-lg')}`}>
            {currentTrack.artist}
          </p>

          <button 
            onClick={() => setIsPanelOpen(true)}
            className={`inline-flex items-center gap-3 bg-secondary-system-background hover:bg-secondary-system-background/80 rounded-full transition-colors active:scale-95 border border-apple-border ${settings.bigTouchMode ? 'px-8 py-4' : 'px-6 py-3'}`}
          >
              <div className="flex gap-1.5">
                {settings.subliminal.isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-apple-blue" />}
                {settings.binaural.isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
                {settings.nature.isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                {settings.noise.isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                {settings.didgeridoo.isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-amber-800" />}
                {settings.pureHz.isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                {settings.isochronic.isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                {settings.solfeggio.isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
              </div>
            <span className={`font-bold uppercase tracking-[0.1em] text-system-secondary-label ${settings.bigTouchMode ? 'text-[11px]' : 'text-[10px]'}`}>{activeLayersLabel}</span>
          </button>
        </div>
      </div>

      <div className={`w-full flex flex-col px-8 transition-all duration-500 ${!settings.showArtwork ? 'max-w-xl flex-1 justify-center' : 'max-w-sm mb-4'} ${settings.bigTouchMode ? 'gap-10 mb-8' : 'gap-8'}`}>
        <PlaybackControls settings={settings} seekTo={seekTo} />

        <div className={`flex items-center justify-between px-2 pb-2 transition-all duration-500 ${!settings.showArtwork ? 'scale-110 mt-8' : ''}`}>
          <button onClick={() => playPrevious()} className={`${settings.bigTouchMode ? 'p-6' : 'p-4'} text-system-label hover:bg-secondary-system-background rounded-full active:scale-90 transition-all`}>
            <SkipBack size={settings.bigTouchMode ? (!settings.showArtwork ? 64 : 48) : (!settings.showArtwork ? 52 : 40)} fill="currentColor" stroke="none" />
          </button>
          
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className={`${settings.bigTouchMode ? (!settings.showArtwork ? 'w-32 h-32' : 'w-24 h-24') : (!settings.showArtwork ? 'w-28 h-28' : 'w-20 h-20')} bg-system-label text-system-background rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all`}
          >
            {isPlaying ? (
              <Pause size={settings.bigTouchMode ? (!settings.showArtwork ? 60 : 44) : (!settings.showArtwork ? 52 : 36)} fill="currentColor" stroke="none" />
            ) : (
              <Play size={settings.bigTouchMode ? (!settings.showArtwork ? 60 : 44) : (!settings.showArtwork ? 52 : 36)} fill="currentColor" stroke="none" className="ml-1" />
            )}
          </button>
          
          <button onClick={() => playNext()} className={`${settings.bigTouchMode ? 'p-6' : 'p-4'} text-system-label hover:bg-secondary-system-background rounded-full active:scale-90 transition-all`}>
            <SkipForward size={settings.bigTouchMode ? (!settings.showArtwork ? 64 : 48) : (!settings.showArtwork ? 52 : 40)} fill="currentColor" stroke="none" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isPanelOpen && (
          <div className="fixed inset-0 z-[200]">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPanelOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
            />
            
            <motion.div 
              key="layer-panel"
              {...panelAnimationProps}
              transition={{ duration: settings.animationStyle === 'off' ? 0 : 0.4, ease: [0.32, 0.72, 0, 1] }}
              className={`absolute left-0 right-0 max-w-2xl mx-auto bg-system-background shadow-[0_-8px_40px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col max-h-[85vh] z-[210] ${settings.hiddenLayersPosition === 'top' ? 'top-0 rounded-b-[3rem]' : 'bottom-0 rounded-t-[3rem]'}`}
            >
              <div className={`w-12 h-1 bg-secondary-system-background rounded-full mx-auto ${settings.hiddenLayersPosition === 'top' ? 'mt-6 mb-1' : 'mt-3 mb-1'}`} />
              
              <div className={`px-8 border-b border-apple-border flex items-center justify-between ${settings.bigTouchMode ? 'py-6' : 'py-4'}`}>
                <h3 className={`font-bold tracking-tight text-system-label ${settings.bigTouchMode ? 'text-2xl' : 'text-xl'}`}>Audio Layers</h3>
                <button 
                  onClick={() => setIsPanelOpen(false)}
                  className={`${settings.bigTouchMode ? 'w-12 h-12' : 'w-10 h-10'} -mr-2 flex items-center justify-center text-system-secondary-label hover:bg-secondary-system-background rounded-full`}
                >
                  <X size={24} />
                </button>
              </div>

              <div className={`flex-1 overflow-y-auto no-scrollbar pb-32 space-y-8 ${settings.bigTouchMode ? 'p-10' : 'p-6'}`}>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-system-secondary-label px-2">Quick Presets</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <PresetButton icon={Moon} label="Sleep" color="bg-apple-blue" onClick={() => applyPreset('sleep')} />
                    <PresetButton icon={Zap} label="Focus" color="bg-orange-500" onClick={() => applyPreset('focus')} />
                    <PresetButton icon={FocusIcon} label="Relax" color="bg-green-500" onClick={() => applyPreset('relax')} />
                  </div>
                </div>

                <div className="space-y-3">
                  <button 
                    onClick={() => toggleGroup('layers')}
                    className="w-full flex items-center justify-between p-4 bg-secondary-system-background border border-apple-border rounded-2xl shadow-sm transition-all active:scale-[0.99] group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-apple-blue/10 text-apple-blue rounded-xl flex items-center justify-center transition-transform group-hover:scale-105">
                        <Ear size={20} />
                      </div>
                      <h3 className="text-sm font-black tracking-tight text-system-label">1. Audio Layers</h3>
                    </div>
                    <ChevronRight size={18} className={`text-system-tertiary-label transition-transform duration-300 ${expandedGroup === 'layers' ? 'rotate-90 text-apple-blue' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {expandedGroup === 'layers' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-3 pt-1"
                      >
                        <LayerAccordion 
                          icon={Volume2} 
                          label="Subliminal Audio" 
                          isEnabled={settings.subliminal.isEnabled} 
                          onToggle={(v: boolean) => updateSubliminalSettings({ isEnabled: v })}
                          vol={settings.subliminal.volume}
                          setVol={(v: number) => updateSubliminalSettings({ volume: v })}
                          gainDb={settings.subliminal.gainDb}
                          setGainDb={(v: number) => updateSubliminalSettings({ gainDb: v })}
                          normalize={settings.subliminal.normalize}
                          setNormalize={(v: boolean) => updateSubliminalSettings({ normalize: v })}
                          color="text-apple-blue"
                          subtitle={settings.subliminal.isPlaylistMode ? 'Playlist Mode' : 'Track Mode'}
                          onApplyPreset={(p: any) => applyLayerPreset('subliminal', p)}
                        >
                          <div className="flex flex-col gap-4">
                            <div className="bg-secondary-system-background p-1 rounded-xl flex items-center h-8">
                              <button 
                                onClick={() => updateSubliminalSettings({ isPlaylistMode: false })}
                                className={`flex-1 h-full text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${!settings.subliminal.isPlaylistMode ? 'bg-system-background shadow-sm text-apple-blue' : 'text-system-secondary-label'}`}
                              >
                                Track
                              </button>
                              <button 
                                onClick={() => updateSubliminalSettings({ isPlaylistMode: true })}
                                className={`flex-1 h-full text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${settings.subliminal.isPlaylistMode ? 'bg-system-background shadow-sm text-apple-blue' : 'text-system-secondary-label'}`}
                              >
                                Playlist
                              </button>
                            </div>
                          </div>
                        </LayerAccordion>

                        <LayerAccordion 
                          icon={Activity} 
                          label="Binaural Beats" 
                          isEnabled={settings.binaural.isEnabled} 
                          onToggle={(v: boolean) => updateBinauralSettings({ isEnabled: v })}
                          vol={settings.binaural.volume}
                          setVol={(v: number) => updateBinauralSettings({ volume: v })}
                          gainDb={settings.binaural.gainDb}
                          setGainDb={(v: number) => updateBinauralSettings({ gainDb: v })}
                          normalize={settings.binaural.normalize}
                          setNormalize={(v: boolean) => updateBinauralSettings({ normalize: v })}
                          color="text-purple-500"
                          subtitle={`${settings.binaural.leftFreq}Hz / ${settings.binaural.rightFreq}Hz`}
                          onApplyPreset={(p: any) => applyLayerPreset('binaural', p)}
                        >
                          <div className="flex flex-col gap-6">
                             <div className="space-y-4">
                                <div className="space-y-2">
                                   <div className="flex justify-between items-center px-1">
                                      <span className="text-[9px] font-black text-system-tertiary-label uppercase">Left Channel (Hz)</span>
                                   </div>
                                   <HzSelector 
                                     value={settings.binaural.leftFreq} 
                                     onChange={(v) => updateBinauralSettings({ leftFreq: v })} 
                                     color="purple"
                                     presets={[200, 432]}
                                   />
                                </div>
                                <div className="space-y-2">
                                   <div className="flex justify-between items-center px-1">
                                      <span className="text-[9px] font-black text-system-tertiary-label uppercase">Right Channel (Hz)</span>
                                   </div>
                                   <HzSelector 
                                     value={settings.binaural.rightFreq} 
                                     onChange={(v) => updateBinauralSettings({ rightFreq: v })} 
                                     color="purple"
                                     presets={[210, 440]}
                                   />
                                </div>
                             </div>
                             <div className="grid grid-cols-3 gap-2">
                               {[
                                 { label: 'Theta', l: 200, r: 204 },
                                 { label: 'Alpha', l: 200, r: 210 },
                                 { label: 'Gamma', l: 200, r: 240 }
                               ].map(p => (
                                 <button 
                                   key={p.label}
                                   onClick={() => updateBinauralSettings({ leftFreq: p.l, rightFreq: p.r })}
                                   className="py-2.5 rounded-xl text-[9px] font-bold uppercase bg-system-background border border-apple-border text-purple-600 active:scale-95 transition-transform shadow-sm"
                                 >
                                   {p.label}
                                 </button>
                               ))}
                             </div>
                          </div>
                        </LayerAccordion>

                        <LayerAccordion 
                          icon={CloudRain} 
                          label="Nature Ambience" 
                          isEnabled={settings.nature.isEnabled} 
                          onToggle={(v: boolean) => updateNatureSettings({ isEnabled: v })}
                          vol={settings.nature.volume}
                          setVol={(v: number) => updateNatureSettings({ volume: v })}
                          gainDb={settings.nature.gainDb}
                          setGainDb={(v: number) => updateNatureSettings({ gainDb: v })}
                          normalize={settings.nature.normalize}
                          setNormalize={(v: boolean) => updateNatureSettings({ normalize: v })}
                          color="text-green-500"
                          subtitle={settings.nature.type}
                          onApplyPreset={(p: any) => applyLayerPreset('nature', p)}
                        >
                          <div className="grid grid-cols-3 gap-2">
                            {NATURE_SOUNDS.map(sound => (
                              <button 
                                key={sound.id}
                                onClick={() => updateNatureSettings({ type: sound.id as any })}
                                className={`py-2 px-1 rounded-xl text-[9px] font-bold uppercase transition-all border ${settings.nature.type === sound.id ? 'bg-green-500 text-white border-green-500 shadow-sm' : 'bg-system-background border-apple-border text-system-secondary-label'}`}
                              >
                                {sound.name}
                              </button>
                            ))}
                          </div>
                        </LayerAccordion>

                        <LayerAccordion 
                          icon={Wind} 
                          label="Noise Colors" 
                          isEnabled={settings.noise.isEnabled} 
                          onToggle={(v: boolean) => updateNoiseSettings({ isEnabled: v })}
                          vol={settings.noise.volume}
                          setVol={(v: number) => updateNoiseSettings({ volume: v })}
                          gainDb={settings.noise.gainDb}
                          setGainDb={(v: number) => updateNoiseSettings({ gainDb: v })}
                          normalize={settings.noise.normalize}
                          setNormalize={(v: boolean) => updateNoiseSettings({ normalize: v })}
                          color="text-orange-500"
                          subtitle={`${settings.noise.type} noise`}
                          onApplyPreset={(p: any) => applyLayerPreset('noise', p)}
                        >
                          <div className="grid grid-cols-3 gap-2">
                              {['white', 'pink', 'brown'].map(type => (
                                <button 
                                  key={type}
                                  onClick={() => updateNoiseSettings({ type: type as any })}
                                  className={`py-2 px-1 rounded-xl text-[9px] font-bold uppercase transition-all border ${settings.noise.type === type ? 'bg-orange-500 text-white border-orange-500 shadow-sm' : 'bg-system-background border-apple-border text-system-secondary-label'}`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                        </LayerAccordion>

                        <LayerAccordion 
                          icon={MusicIcon} 
                          label="Didgeridoo" 
                          isEnabled={settings.didgeridoo.isEnabled} 
                          onToggle={(v: boolean) => updateDidgeridooSettings({ isEnabled: v })}
                          vol={settings.didgeridoo.volume}
                          setVol={(v: number) => updateDidgeridooSettings({ volume: v })}
                          gainDb={settings.didgeridoo.gainDb}
                          setGainDb={(v: number) => updateDidgeridooSettings({ gainDb: v })}
                          normalize={settings.didgeridoo.normalize}
                          setNormalize={(v: boolean) => updateDidgeridooSettings({ normalize: v })}
                          color="text-amber-800"
                          subtitle="Drone oscillation"
                          onApplyPreset={(p: any) => applyLayerPreset('didgeridoo', p)}
                        >
                          <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-center px-1">
                              <p className="text-[9px] font-bold text-system-tertiary-label uppercase tracking-widest">Base Freq</p>
                              <span className="text-[10px] font-black text-amber-800 tabular-nums">{Math.round(65 * settings.didgeridoo.playbackRate)}Hz</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <input 
                                type="range" min={0.5} max={2.0} step={0.1} 
                                value={settings.didgeridoo.playbackRate} 
                                onChange={(e) => updateDidgeridooSettings({ playbackRate: parseFloat(e.target.value) })}
                                className="flex-1 h-1 bg-apple-border rounded-full appearance-none accent-amber-800"
                              />
                            </div>
                          </div>
                        </LayerAccordion>

                        <LayerAccordion 
                          icon={Activity} 
                          label="Pure Hz" 
                          isEnabled={settings.pureHz.isEnabled} 
                          onToggle={(v: boolean) => updatePureHzSettings({ isEnabled: v })}
                          vol={settings.pureHz.volume}
                          setVol={(v: number) => updatePureHzSettings({ volume: v })}
                          gainDb={settings.pureHz.gainDb}
                          setGainDb={(v: number) => updatePureHzSettings({ gainDb: v })}
                          normalize={settings.pureHz.normalize}
                          setNormalize={(v: boolean) => updatePureHzSettings({ normalize: v })}
                          color="text-rose-600"
                          subtitle={`${settings.pureHz.frequency}Hz`}
                          onApplyPreset={(p: any) => applyLayerPreset('pureHz', p)}
                        >
                          <HzSelector 
                            value={settings.pureHz.frequency} 
                            onChange={(v) => updatePureHzSettings({ frequency: v })} 
                            color="rose"
                            presets={[174, 432, 528, 852]}
                          />
                        </LayerAccordion>

                        <LayerAccordion 
                          icon={Zap} 
                          label="Isochronic Tones" 
                          isEnabled={settings.isochronic.isEnabled} 
                          onToggle={(v: boolean) => updateIsochronicSettings({ isEnabled: v })}
                          vol={settings.isochronic.volume}
                          setVol={(v: number) => updateIsochronicSettings({ volume: v })}
                          gainDb={settings.isochronic.gainDb}
                          setGainDb={(v: number) => updateIsochronicSettings({ gainDb: v })}
                          normalize={settings.isochronic.normalize}
                          setNormalize={(v: boolean) => updateIsochronicSettings({ normalize: v })}
                          color="text-amber-500"
                          subtitle={`${settings.isochronic.frequency}Hz @ ${settings.isochronic.pulseRate}Hz`}
                          onApplyPreset={(p: any) => applyLayerPreset('isochronic', p)}
                        >
                          <div className="space-y-4">
                             <div className="space-y-2">
                               <p className="text-[9px] font-black text-system-tertiary-label uppercase tracking-widest pl-1">Carrier Frequency (Hz)</p>
                               <HzSelector 
                                 value={settings.isochronic.frequency} 
                                 onChange={(v) => updateIsochronicSettings({ frequency: v })} 
                                 color="amber"
                                 presets={[396, 417, 528]}
                               />
                             </div>
                             <div className="space-y-2">
                               <p className="text-[9px] font-black text-system-tertiary-label uppercase tracking-widest pl-1">Pulse Rate (Hz)</p>
                               <div className="flex items-center gap-3">
                                 <input 
                                   type="range" min={0.5} max={20} step={0.1} 
                                   value={settings.isochronic.pulseRate} 
                                   onChange={(e) => updateIsochronicSettings({ pulseRate: parseFloat(e.target.value) })}
                                   className="flex-1 h-1 bg-apple-border rounded-full appearance-none accent-amber-500"
                                 />
                                 <span className="text-[10px] font-mono font-black text-amber-600 w-10 text-right tabular-nums">{settings.isochronic.pulseRate}Hz</span>
                               </div>
                             </div>
                          </div>
                        </LayerAccordion>

                        <LayerAccordion 
                          icon={FocusIcon} 
                          label="Solfeggio Frequencies" 
                          isEnabled={settings.solfeggio.isEnabled} 
                          onToggle={(v: boolean) => updateSolfeggioSettings({ isEnabled: v })}
                          vol={settings.solfeggio.volume}
                          setVol={(v: number) => updateSolfeggioSettings({ volume: v })}
                          gainDb={settings.solfeggio.gainDb}
                          setGainDb={(v: number) => updateSolfeggioSettings({ gainDb: v })}
                          normalize={settings.solfeggio.normalize}
                          setNormalize={(v: boolean) => updateSolfeggioSettings({ normalize: v })}
                          color="text-indigo-600"
                          subtitle={`${settings.solfeggio.frequency}Hz`}
                          onApplyPreset={(p: any) => applyLayerPreset('solfeggio', p)}
                        >
                          <HzSelector 
                            value={settings.solfeggio.frequency} 
                            onChange={(v) => updateSolfeggioSettings({ frequency: v })} 
                            color="indigo"
                            presets={[174, 285, 396, 417, 528, 639, 741, 852, 963]}
                          />
                        </LayerAccordion>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-3">
                  <button 
                    onClick={() => toggleGroup('playback')}
                    className="w-full flex items-center justify-between p-4 bg-secondary-system-background border border-apple-border rounded-2xl shadow-sm transition-all active:scale-[0.99] group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105">
                        <Repeat size={20} />
                      </div>
                      <h3 className="text-sm font-black tracking-tight text-system-label">2. Playback & Control</h3>
                    </div>
                    <ChevronRight size={18} className={`text-system-tertiary-label transition-transform duration-300 ${expandedGroup === 'playback' ? 'rotate-90 text-indigo-500' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {expandedGroup === 'playback' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden pt-1"
                      >
                        <div className="bg-secondary-system-background border border-apple-border p-6 rounded-[2rem] flex flex-col gap-6">
                            <div className="space-y-3">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-system-secondary-label px-1">Loop Mode</p>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => updateSettings({ loop: settings.loop === 'all' ? 'none' : 'all' })}
                                  className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl border transition-all ${settings.loop === 'all' ? 'bg-blue-500 border-blue-500 text-white shadow-md' : 'bg-system-background border-apple-border text-system-secondary-label'}`}
                                >
                                  <Repeat size={16} />
                                  <span className="text-[9px] font-black uppercase">Playlist</span>
                                </button>
                                <button 
                                  onClick={() => updateSettings({ loop: settings.loop === 'one' ? 'none' : 'one' })}
                                  className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl border transition-all ${settings.loop === 'one' ? 'bg-blue-500 border-blue-500 text-white shadow-md' : 'bg-system-background border-apple-border text-system-secondary-label'}`}
                                >
                                  <Repeat1 size={16} />
                                  <span className="text-[9px] font-black uppercase">Single</span>
                                </button>
                                <button 
                                  onClick={() => toggleShuffle()}
                                  className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl border transition-all ${settings.shuffle ? 'bg-orange-500 border-orange-500 text-white shadow-md' : 'bg-system-background border-apple-border text-system-secondary-label'}`}
                                >
                                  <Shuffle size={16} />
                                  <span className="text-[9px] font-black uppercase">Shuffle</span>
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-col gap-3">
                              <button 
                                onClick={() => updateSettings({ displayAlwaysOn: !settings.displayAlwaysOn })}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${settings.displayAlwaysOn ? 'bg-amber-500/10 border-amber-500/20' : 'bg-system-background border-apple-border'}`}
                              >
                                <div className="flex items-center gap-3">
                                  <Monitor size={16} className={settings.displayAlwaysOn ? 'text-amber-500' : 'text-system-secondary-label'} />
                                  <span className={`text-[10px] font-black uppercase tracking-tight ${settings.displayAlwaysOn ? 'text-amber-600' : 'text-system-label'}`}>Always ON</span>
                                </div>
                                <div className={`w-8 h-4 rounded-full relative transition-colors ${settings.displayAlwaysOn ? 'bg-amber-500' : 'bg-system-tertiary-label'}`}>
                                  <motion.div className="absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full" animate={{ x: settings.displayAlwaysOn ? 16 : 0 }} />
                                </div>
                              </button>

                              <div className={`flex flex-col gap-4 p-4 rounded-2xl border transition-all ${settings.sleepTimer.isEnabled ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-system-background border-apple-border'}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <Moon size={16} className={settings.sleepTimer.isEnabled ? 'text-indigo-500' : 'text-system-secondary-label'} />
                                    <span className={`text-[10px] font-black uppercase tracking-tight ${settings.sleepTimer.isEnabled ? 'text-indigo-600' : 'text-system-label'}`}>Sleep Timer</span>
                                  </div>
                                  <button 
                                    onClick={() => updateSleepTimer({ isEnabled: !settings.sleepTimer.isEnabled, remainingSeconds: !settings.sleepTimer.isEnabled ? settings.sleepTimer.minutes * 60 : null })}
                                    className={`w-8 h-4 rounded-full relative transition-colors ${settings.sleepTimer.isEnabled ? 'bg-indigo-500' : 'bg-system-tertiary-label'}`}
                                  >
                                    <motion.div className="absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full" animate={{ x: settings.sleepTimer.isEnabled ? 16 : 0 }} />
                                  </button>
                                </div>
                                <div className="flex items-center gap-3">
                                  <input 
                                    type="number" value={settings.sleepTimer.minutes}
                                    onChange={(e) => updateSleepTimer({ minutes: Math.max(1, parseInt(e.target.value) || 1) })}
                                    className="w-16 h-8 bg-system-background rounded-lg border-none text-[11px] font-black text-center focus:ring-1 focus:ring-indigo-500"
                                  />
                                  <span className="text-[9px] font-bold text-system-secondary-label uppercase">Min</span>
                                  {settings.sleepTimer.isEnabled && settings.sleepTimer.remainingSeconds !== null && (
                                    <span className="ml-auto text-[10px] font-black text-indigo-500 tabular-nums">
                                      {Math.floor(settings.sleepTimer.remainingSeconds / 60)}:{(settings.sleepTimer.remainingSeconds % 60).toString().padStart(2, '0')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-3">
                   <button 
                    onClick={() => toggleGroup('tools')}
                    className="w-full flex items-center justify-between p-4 bg-secondary-system-background border border-apple-border rounded-2xl shadow-sm transition-all active:scale-[0.99] group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-apple-blue/10 text-apple-blue rounded-xl flex items-center justify-center transition-transform group-hover:scale-105">
                        <Sliders size={20} />
                      </div>
                      <h3 className="text-sm font-black tracking-tight text-system-label">3. Audio Tools</h3>
                    </div>
                    <ChevronRight size={18} className={`text-system-tertiary-label transition-transform duration-300 ${expandedGroup === 'tools' ? 'rotate-90 text-apple-blue' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {expandedGroup === 'tools' && (
                       <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden pt-1"
                       >
                          <div className="bg-secondary-system-background border border-apple-border p-6 rounded-[2rem] flex flex-col gap-6">
                              <div className="space-y-4">
                                 <div className="flex justify-between items-center px-1">
                                    <div className="flex flex-col">
                                       <span className="text-[10px] font-black text-system-label uppercase tracking-widest">Master Gain (dB)</span>
                                       <span className="text-[9px] font-bold text-apple-blue">{settings.audioTools.gainDb} dB</span>
                                    </div>
                                    <input 
                                       type="number"
                                       value={settings.audioTools.gainDb}
                                       onChange={(e) => updateAudioTools({ gainDb: Math.min(0, Math.max(-60, parseInt(e.target.value) || 0)) })}
                                       className="w-12 h-6 bg-system-background border border-apple-border rounded-md text-[10px] font-black text-center"
                                    />
                                 </div>
                                 <input 
                                    type="range" min={-60} max={0} step={1} value={settings.audioTools.gainDb}
                                    onChange={(e) => updateAudioTools({ gainDb: parseInt(e.target.value) })}
                                    className="w-full h-1 bg-apple-border rounded-full appearance-none accent-system-label"
                                 />
                              </div>

                              <div className="flex items-center justify-between p-4 bg-system-background rounded-2xl border border-apple-border">
                                 <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-system-label uppercase tracking-widest">Master Normalization</span>
                                    <span className="text-[9px] font-bold text-system-secondary-label">{settings.audioTools.normalizeTargetDb !== null ? `Peak ${settings.audioTools.normalizeTargetDb}dB` : 'Off'}</span>
                                 </div>
                                 <button 
                                    onClick={() => updateAudioTools({ normalizeTargetDb: settings.audioTools.normalizeTargetDb === null ? -10 : null })}
                                    className={`w-10 h-6 rounded-full relative transition-colors ${settings.audioTools.normalizeTargetDb !== null ? 'bg-apple-blue' : 'bg-system-tertiary-label'}`}
                                 >
                                    <motion.div className="absolute top-1 left-1 bg-white w-4 h-4 rounded-full" animate={{ x: settings.audioTools.normalizeTargetDb !== null ? 16 : 0 }} />
                                 </button>
                              </div>

                              <div className="space-y-3">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-system-secondary-label px-1">Global Playback Speed</p>
                                <div className="flex gap-2">
                                  {[1, 1.5, 2, 2.5].map(rate => (
                                    <button
                                      key={rate}
                                      onClick={() => updateSettings({ playbackRate: rate })}
                                      className={`flex-1 py-3 rounded-2xl text-[10px] font-black transition-all border ${settings.playbackRate === rate ? 'bg-system-label text-system-background border-system-label shadow-sm' : 'bg-system-background text-system-secondary-label border-apple-border'}`}
                                    >
                                      {rate}x
                                    </button>
                                  ))}
                                </div>
                              </div>
                          </div>
                       </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
