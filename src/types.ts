export interface Track {
  id: string;
  name: string;
  url: string;
  artist?: string;
  artwork?: string;
  createdAt: number;
  lastPlayedAt?: number;
  isMissing?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

export type SortOption = 'date' | 'alphabetical' | 'recent';
export type GroupOption = 'none' | 'day' | 'week' | 'month' | 'alphabetical' | 'minutes' | 'numbers';
export type AnimationStyle = 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'random' | 'off';
export type HzInputMode = 'slider' | 'picker';

export interface SubliminalSettings {
  isEnabled: boolean;
  selectedTrackId: string | null;
  volume: number; // 0 to 0.3
  isLooping: boolean;
  delayMs: number;
  isPlaylistMode: boolean;
  sourcePlaylistId: string | null;
  gainDb: number;
  normalize: boolean;
}

export interface BinauralSettings {
  isEnabled: boolean;
  leftFreq: number;
  rightFreq: number;
  volume: number;
  gainDb: number;
  normalize: boolean;
}

export interface NatureSettings {
  isEnabled: boolean;
  type: 'rain' | 'ocean' | 'forest' | 'wind' | 'fire' | 'stream';
  volume: number;
  gainDb: number;
  normalize: boolean;
}

export interface NoiseSettings {
  isEnabled: boolean;
  type: 'white' | 'pink' | 'brown';
  volume: number;
  gainDb: number;
  normalize: boolean;
}

export interface DidgeridooSettings {
  isEnabled: boolean;
  volume: number;
  gainDb: number;
  playbackRate: number;
  depth: number;
  isLooping: boolean;
  normalize: boolean;
}

export interface PureHzSettings {
  isEnabled: boolean;
  frequency: number;
  volume: number;
  isLooping: boolean;
  gainDb: number;
  normalize: boolean;
}

export interface IsochronicSettings {
  isEnabled: boolean;
  frequency: number;
  pulseRate: number;
  volume: number;
  gainDb: number;
  normalize: boolean;
}

export interface SolfeggioSettings {
  isEnabled: boolean;
  frequency: number;
  volume: number;
  gainDb: number;
  normalize: boolean;
}

export interface AudioTools {
  gainDb: number;
  normalizeTargetDb: number | null;
}

export interface PlaylistMemory {
  trackId: string;
  position: number;
  timestamp: number;
}

export interface VersionEntry {
  version: string;
  date: string;
  changes: {
    added?: string[];
    improved?: string[];
    fixed?: string[];
  };
}

export type Theme = 'light' | 'dark';
export type DarkModeStyle = 'soft-purple' | 'soft-blue';

export interface AppSettings {
  subliminal: SubliminalSettings;
  binaural: BinauralSettings;
  nature: NatureSettings;
  noise: NoiseSettings;
  didgeridoo: DidgeridooSettings;
  pureHz: PureHzSettings;
  isochronic: IsochronicSettings;
  solfeggio: SolfeggioSettings;
  audioTools: AudioTools;
  mainVolume: number;
  playbackRate: number;
  fadeInOut: boolean;
  syncPlayback: boolean;
  library: {
    sort: SortOption;
    group: GroupOption;
    groupByMinutes: boolean;
  };
  appearance: {
    theme: Theme;
    followSystem: boolean;
    darkModeStyle: DarkModeStyle;
  };
  miniMode: boolean;
  hiddenLayersPosition: 'top' | 'bottom';
  loop: 'none' | 'one' | 'all';
  shuffle: boolean;
  playlistMemory: Record<string, PlaylistMemory>;
  menuPosition: 'top' | 'bottom';
  bigTouchMode: boolean;
  animationStyle: AnimationStyle;
  hzInputMode: HzInputMode;
  subliminalExpanded: boolean;
  showArtwork: boolean;
  alwaysHideArtworkByDefault: boolean;
  displayAlwaysOn: boolean;
  visibility: {
    audioLayers: boolean;
    appControl: boolean;
  };
  sleepTimer: {
    isEnabled: boolean;
    minutes: number;
    remainingSeconds: number | null;
  };
  versionHistory: VersionEntry[];
}
