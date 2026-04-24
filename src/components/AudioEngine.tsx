import { useEffect, useRef, useMemo, useState } from 'react';
import { useAudio } from '../AudioContext';
import { usePlayback } from '../PlaybackContext';
import { useSettings } from '../SettingsContext';
import { useUIState } from '../UIStateContext';
import { NATURE_SOUNDS } from '../constants';

export default function AudioEngine() {
  const { 
    tracks, 
    subliminalTracks, 
    currentTrackIndex, 
    isPlaying, 
    playlists,
    setIsPlaying,
    playNext,
    playPrevious,
    seekTo,
    currentPlaybackList,
    playingPlaylistId,
    getTrackUrl,
    seekRequest,
    clearSeekRequest
  } = useAudio();

  const { settings, updateSettings, updateAudioTools } = useSettings();
  const { isLoading, showToast, isOffline, navigateTo, activeTabRequest, clearTabRequest } = useUIState();

  const { currentTime, setCurrentTime, setDuration } = usePlayback();
  const [preparedUrl, setPreparedUrl] = useState<string | null>(null);
  const [preparedSubUrl, setPreparedSubUrl] = useState<string | null>(null);
  const mainAudioRef = useRef<HTMLAudioElement | null>(null);
  const subAudioRef = useRef<HTMLAudioElement | null>(null);
  const delayTimeoutRef = useRef<number | null>(null);
  const subPlaylistIndexRef = useRef<number>(0);

  // Binaural Web Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const leftOscRef = useRef<OscillatorNode | null>(null);
  const rightOscRef = useRef<OscillatorNode | null>(null);
  const binauralGainRef = useRef<GainNode | null>(null);
  
  // Audio Tools Refs
  const mainSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const mainGainRef = useRef<GainNode | null>(null);
  const subSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const subSpecificGainRef = useRef<GainNode | null>(null);
  const toolGainRef = useRef<GainNode | null>(null);
  const toolCompressorRef = useRef<DynamicsCompressorNode | null>(null);

  // Noise & Nature Refs
  const noiseNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  const natureAudioRef = useRef<HTMLAudioElement | null>(null);
  const natureSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const natureGainRef = useRef<GainNode | null>(null);
  const natureCompRef = useRef<DynamicsCompressorNode | null>(null);

  // Per-layer Compressor Refs for Normalization
  const subCompRef = useRef<DynamicsCompressorNode | null>(null);
  const binCompRef = useRef<DynamicsCompressorNode | null>(null);
  const noiseCompRef = useRef<DynamicsCompressorNode | null>(null);
  const didgCompRef = useRef<DynamicsCompressorNode | null>(null);
  const pureHzCompRef = useRef<DynamicsCompressorNode | null>(null);

  // Master Gain & Limiter for Stable Parallel Mixing
  const masterGainRef = useRef<GainNode | null>(null);
  const masterLimiterRef = useRef<DynamicsCompressorNode | null>(null);

  // Didgeridoo Refs
  const didgOscRef = useRef<OscillatorNode | null>(null);
  const didgSubOscRef = useRef<OscillatorNode | null>(null);
  const didgFilterRef = useRef<BiquadFilterNode | null>(null);
  const didgGainRef = useRef<GainNode | null>(null);
  const didgLfoRef = useRef<OscillatorNode | null>(null);

  // Pure Hz Refs
  const pureHzOscRef = useRef<OscillatorNode | null>(null);
  const pureHzGainRef = useRef<GainNode | null>(null);

  // Isochronic Refs
  const isoOscRef = useRef<OscillatorNode | null>(null);
  const isoGainRef = useRef<GainNode | null>(null);
  const isoLfoRef = useRef<OscillatorNode | null>(null);
  const isoLfoGainRef = useRef<GainNode | null>(null);
  const isoCompRef = useRef<DynamicsCompressorNode | null>(null);

  // Solfeggio Refs
  const solOscRef = useRef<OscillatorNode | null>(null);
  const solGainRef = useRef<GainNode | null>(null);
  const solCompRef = useRef<DynamicsCompressorNode | null>(null);

  // iOS Background Audio & Media Session Setup
  useEffect(() => {
    // Helper to ensure AudioContext is ready on any media session action
    const withResume = (fn: () => void) => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      fn();
    };

    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => withResume(() => setIsPlaying(true)));
      navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
      navigator.mediaSession.setActionHandler('nexttrack', () => withResume(() => playNext()));
      navigator.mediaSession.setActionHandler('previoustrack', () => withResume(() => playPrevious()));
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) seekTo(details.seekTime);
        if (details.fastSeek && mainAudioRef.current) {
          mainAudioRef.current.currentTime = details.seekTime || 0;
        }
      });
      
      // iOS 16 fallback seek handlers
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        if (mainAudioRef.current) seekTo(Math.max(0, mainAudioRef.current.currentTime - offset));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10;
        if (mainAudioRef.current) seekTo(Math.min(mainAudioRef.current.duration, mainAudioRef.current.currentTime + offset));
      });
    }

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('seekto', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
      }
    };
  }, [playNext, playPrevious, setIsPlaying, seekTo]);

  // Playlist Memory Tracker - Isolated from global UI updates
  useEffect(() => {
    if (!playingPlaylistId || isLoading || currentTrackIndex === null || !isPlaying) return;
    
    const playlist = playlists.find(p => p.id === playingPlaylistId);
    if (!playlist) return;

    const currentTrackId = playlist.trackIds[currentTrackIndex];
    if (!currentTrackId) return;

    // Use a timeout to throttle updates to once every 5 seconds
    const timer = setTimeout(() => {
      updateSettings({
        playlistMemory: {
          ...settings.playlistMemory,
          [playingPlaylistId]: {
            trackId: currentTrackId,
            position: currentTime,
            timestamp: Date.now()
          }
        }
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [playingPlaylistId, currentTrackIndex, Math.floor(currentTime / 5), isPlaying, isLoading, updateSettings, settings.playlistMemory, playlists]);

  // Sync Media Session Metadata
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrackIndex !== null && tracks[currentTrackIndex]) {
      const track = tracks[currentTrackIndex];
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.name,
        artist: track.artist || 'Unknown Artist',
        album: 'Subliminal Journey',
        artwork: [
          { src: track.artwork || 'https://picsum.photos/seed/music/512/512', sizes: '512x512', type: 'image/png' }
        ]
      });
    }
  }, [currentTrackIndex, tracks]);

  // Consolidate Audio Elements Lifecycle & iOS Unlock
  useEffect(() => {
    // Initialize elements
    const mainAudio = new Audio();
    const subAudio = new Audio();
    const natureAudio = new Audio();
    
    [mainAudio, subAudio, natureAudio].forEach(a => {
      (a as any).playsInline = true;
      (a as any).webkitPlaysInline = true;
      a.preload = 'auto';
    });

    natureAudio.loop = true;

    mainAudioRef.current = mainAudio;
    subAudioRef.current = subAudio;
    natureAudioRef.current = natureAudio;

    // iOS Safari Audio Unlock Helper
    const initCtx = () => {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtxRef.current = new AudioContextClass();
        }
      }
      return audioCtxRef.current;
    };

    const unlockAudio = () => {
      const ctx = initCtx();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(() => {
          console.log('[AudioEngine] Context resumed via interaction');
          const buffer = ctx.createBuffer(1, 1, 22050);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
        }).catch(err => console.warn('[AudioEngine] Resume failed:', err));
      }
      
      // Unlock HTML Audio elements by playing/pausing
      [mainAudio, subAudio, natureAudio].forEach(a => {
        a.play().then(() => a.pause()).catch(() => {});
      });

      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      
      [mainAudio, subAudio, natureAudio].forEach(a => {
        a.pause();
        a.src = '';
      });
      
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(console.error);
      }
      
      mainAudioRef.current = null;
      subAudioRef.current = null;
      natureAudioRef.current = null;
    };
  }, []); // Run once on mount

  const createNoiseBuffer = (type: 'white' | 'pink' | 'brown') => {
    if (!audioCtxRef.current) return null;
    const ctx = audioCtxRef.current;
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'pink') {
      let b0, b1, b2, b3, b4, b5, b6;
      b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3102503;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11; // (roughly) apply gain
        b6 = white * 0.115926;
      }
    } else if (type === 'brown') {
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        const out = (lastOut + (0.02 * white)) / 1.02;
        lastOut = out;
        output[i] = out * 3.5; // (roughly) apply gain
      }
    }
    return buffer;
  };

  const setupNoise = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      
      setupAudioTools(); // Ensure master routing is ready

      if (!noiseGainRef.current) {
        const gain = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();
        
        comp.threshold.setValueAtTime(-24, ctx.currentTime);
        comp.ratio.setValueAtTime(12, ctx.currentTime);
        
        gain.gain.setValueAtTime(0, ctx.currentTime);
        comp.connect(gain);
        
        // Connect to Master Gain instead of direct destination
        if (masterGainRef.current) {
          gain.connect(masterGainRef.current);
        } else {
          gain.connect(ctx.destination);
        }
        
        noiseGainRef.current = gain;
        noiseCompRef.current = comp;
      }
    } catch (err) {
      console.error("Failed to setup noise context:", err);
    }
  };

  const setupBinaural = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      setupAudioTools(); // Ensure master routing is ready

      if (!leftOscRef.current || !rightOscRef.current) {
        // Create Nodes
        const leftOsc = ctx.createOscillator();
        const rightOsc = ctx.createOscillator();
        const merger = ctx.createChannelMerger(2);
        const gainNode = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();

        comp.threshold.setValueAtTime(-24, ctx.currentTime);
        comp.ratio.setValueAtTime(12, ctx.currentTime);

        leftOsc.type = 'sine';
        rightOsc.type = 'sine';

        // Initial frequencies
        leftOsc.frequency.setValueAtTime(settings.binaural.leftFreq, ctx.currentTime);
        rightOsc.frequency.setValueAtTime(settings.binaural.rightFreq, ctx.currentTime);

        // Route: Left -> Channel 0, Right -> Channel 1 (Explicit Stereo)
        leftOsc.connect(merger, 0, 0);
        rightOsc.connect(merger, 0, 1);

        merger.connect(comp);
        comp.connect(gainNode);
        
        // Connect to Master Gain instead of direct destination
        if (masterGainRef.current) {
          gainNode.connect(masterGainRef.current);
        } else {
          gainNode.connect(ctx.destination);
        }

        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        leftOsc.start();
        rightOsc.start();

        leftOscRef.current = leftOsc;
        rightOscRef.current = rightOsc;
        binauralGainRef.current = gainNode;
        binCompRef.current = comp;
      }
    } catch (err) {
      console.error("Binaural setup failed:", err);
    }
  };

  const setupDidgeridoo = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;

      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      setupAudioTools();

      if (!didgOscRef.current) {
        const osc = ctx.createOscillator();
        const subOsc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const gain = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();

        comp.threshold.setValueAtTime(-24, ctx.currentTime);
        comp.ratio.setValueAtTime(12, ctx.currentTime);

        // Deep drone fundamental (around 65Hz)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(65 * settings.didgeridoo.playbackRate, ctx.currentTime);

        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(65 * settings.didgeridoo.playbackRate, ctx.currentTime);

        // Vocalizing filter
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(180 * (1 + settings.didgeridoo.depth), ctx.currentTime);
        filter.Q.setValueAtTime(15, ctx.currentTime);

        // Slow modulation for "breath"
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.15, ctx.currentTime);
        lfoGain.gain.setValueAtTime(60 * settings.didgeridoo.depth, ctx.currentTime);

        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        osc.connect(filter);
        subOsc.connect(filter);
        filter.connect(comp);
        comp.connect(gain);
        
        // Connect to Master Gain
        if (masterGainRef.current) {
          gain.connect(masterGainRef.current);
        } else {
          gain.connect(ctx.destination);
        }

        gain.gain.setValueAtTime(0, ctx.currentTime);

        osc.start();
        subOsc.start();
        lfo.start();

        didgOscRef.current = osc;
        didgSubOscRef.current = subOsc;
        didgFilterRef.current = filter;
        didgGainRef.current = gain;
        didgLfoRef.current = lfo;
      }
    } catch (err) {
      console.error("Didgeridoo setup failed:", err);
    }
  };

  const setupPureHz = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;

      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      setupAudioTools();

      if (!pureHzOscRef.current) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();

        comp.threshold.setValueAtTime(-24, ctx.currentTime);
        comp.ratio.setValueAtTime(12, ctx.currentTime);

        osc.type = 'sine'; // Always sine for pure tones
        osc.frequency.setValueAtTime(settings.pureHz.frequency, ctx.currentTime);

        osc.connect(comp);
        comp.connect(gain);
        
        // Connect to Master Gain
        if (masterGainRef.current) {
          gain.connect(masterGainRef.current);
        } else {
          gain.connect(ctx.destination);
        }

        gain.gain.setValueAtTime(0, ctx.currentTime);
        osc.start();

        pureHzOscRef.current = osc;
        pureHzGainRef.current = gain;
        pureHzCompRef.current = comp;
      }
    } catch (err) {
      console.error("Pure Hz setup failed:", err);
    }
  };

  const setupIsochronic = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;

      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      setupAudioTools();

      if (!isoOscRef.current) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();

        comp.threshold.setValueAtTime(-24, ctx.currentTime);
        comp.ratio.setValueAtTime(12, ctx.currentTime);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(settings.isochronic.frequency, ctx.currentTime);

        // Isochronic pulse (square wave LFO on gain)
        lfo.type = 'square';
        lfo.frequency.setValueAtTime(settings.isochronic.pulseRate, ctx.currentTime);
        
        // Connect LFO to Gain.gain via an offset
        // In Web Audio, LFO on gain usually goes 0 to 1
        lfoGain.gain.setValueAtTime(0.5, ctx.currentTime);
        const constantSource = ctx.createConstantSource();
        constantSource.offset.setValueAtTime(0.5, ctx.currentTime);
        constantSource.start();
        
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        constantSource.connect(gain.gain);

        osc.connect(comp);
        comp.connect(gain);
        
        // Connect to Master Gain
        if (masterGainRef.current) {
          gain.connect(masterGainRef.current);
        } else {
          gain.connect(ctx.destination);
        }

        osc.start();
        lfo.start();

        isoOscRef.current = osc;
        isoGainRef.current = gain;
        isoLfoRef.current = lfo;
        isoLfoGainRef.current = lfoGain;
        isoCompRef.current = comp;
      }
    } catch (err) {
      console.error("Isochronic setup failed:", err);
    }
  };

  const setupSolfeggio = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;

      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      setupAudioTools();

      if (!solOscRef.current) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();

        comp.threshold.setValueAtTime(-24, ctx.currentTime);
        comp.ratio.setValueAtTime(12, ctx.currentTime);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(settings.solfeggio.frequency, ctx.currentTime);

        osc.connect(comp);
        comp.connect(gain);
        
        // Connect to Master Gain
        if (masterGainRef.current) {
          gain.connect(masterGainRef.current);
        } else {
          gain.connect(ctx.destination);
        }

        gain.gain.setValueAtTime(0, ctx.currentTime);
        osc.start();

        solOscRef.current = osc;
        solGainRef.current = gain;
        solCompRef.current = comp;
      }
    } catch (err) {
      console.error("Solfeggio setup failed:", err);
    }
  };

  const setupNature = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      setupAudioTools(); // Ensure master routing is ready

      if (natureAudioRef.current && !natureSourceRef.current) {
        natureSourceRef.current = ctx.createMediaElementSource(natureAudioRef.current);
        natureGainRef.current = ctx.createGain();
        natureCompRef.current = ctx.createDynamicsCompressor();
        
        natureCompRef.current.threshold.setValueAtTime(-24, ctx.currentTime);
        natureCompRef.current.ratio.setValueAtTime(12, ctx.currentTime);
        
        natureSourceRef.current.connect(natureCompRef.current);
        natureCompRef.current.connect(natureGainRef.current);
        
        // Connect to Master Gain
        if (masterGainRef.current) {
          natureGainRef.current.connect(masterGainRef.current);
        } else {
          natureGainRef.current.connect(ctx.destination);
        }
      }
    } catch (err) {
      console.error("Nature setup failed:", err);
    }
  };

  // Handle Seek Request
  useEffect(() => {
    if (seekRequest !== null && mainAudioRef.current) {
      mainAudioRef.current.currentTime = seekRequest;
      clearSeekRequest();
    }
  }, [seekRequest]);

  const currentTrack = currentTrackIndex !== null ? currentPlaybackList[currentTrackIndex] : null;

  // Resolve Main URL
  useEffect(() => {
    if (currentTrack && !currentTrack.isMissing) {
      getTrackUrl(currentTrack.id).then(url => {
        setPreparedUrl(url);
      });
    } else {
      setPreparedUrl(null);
    }
  }, [currentTrack?.id, getTrackUrl]);

  // Unified sourcing: Check both lists for the subliminal track
  const subTrack = useMemo(() => {
    // If playlist mode is on, we derive track from the selected playlist and our internal index
    if (settings.subliminal.isPlaylistMode && settings.subliminal.sourcePlaylistId) {
      const playlist = playlists.find(p => p.id === settings.subliminal.sourcePlaylistId);
      if (playlist && playlist.trackIds.length > 0) {
        // Ensure index is within bounds
        const trackId = playlist.trackIds[subPlaylistIndexRef.current % playlist.trackIds.length];
        return tracks.find(t => t.id === trackId);
      }
    }
    
    return subliminalTracks.find(t => t.id === settings.subliminal.selectedTrackId) || 
           tracks.find(t => t.id === settings.subliminal.selectedTrackId);
  }, [subliminalTracks, tracks, settings.subliminal.selectedTrackId, settings.subliminal.isPlaylistMode, settings.subliminal.sourcePlaylistId, playlists]);

  // Resolve Sub URL
  useEffect(() => {
    if (subTrack && !subTrack.isMissing) {
      getTrackUrl(subTrack.id).then(url => {
        setPreparedSubUrl(url);
      });
    } else {
      setPreparedSubUrl(null);
    }
  }, [subTrack?.id, getTrackUrl]);

  // Reset Subliminal Index on mode/playlist change
  useEffect(() => {
    subPlaylistIndexRef.current = 0;
  }, [settings.subliminal.sourcePlaylistId, settings.subliminal.isPlaylistMode]);

  // Initialize main audio element
  useEffect(() => {
    const audio = new Audio();
    (audio as any).playsInline = true;
    (audio as any).webkitPlaysInline = true;
    mainAudioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      mainAudioRef.current = null;
    };
  }, []);

  // Sync state and duration from main audio
  useEffect(() => {
    const audio = mainAudioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      
      // Update Media Session position state for lock screen parity
      if ('mediaSession' in navigator && (navigator.mediaSession as any).setPositionState && isPlaying) {
        try {
          (navigator.mediaSession as any).setPositionState({
            duration: audio.duration || 0,
            playbackRate: audio.playbackRate || 1,
            position: audio.currentTime || 0,
          });
        } catch (e) {
          // Ignore state sync errors if duration is NaN
        }
      }
    };
    const onLoadedMetadata = () => setDuration(audio.duration);
    
    // Bidirectional sync: If iOS pauses the audio element (e.g. system interrupt), sync state
    const onPause = () => {
      if (isPlaying) {
        console.log('[AudioEngine] System paused audio, syncing state');
        setIsPlaying(false);
      }
    };
    const onPlay = () => {
      if (!isPlaying) {
        console.log('[AudioEngine] System resumed audio, syncing state');
        setIsPlaying(true);
      }
    };
    
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
    };
  }, [setCurrentTime, setDuration, isPlaying, setIsPlaying]);

  // Handle track ending and errors
  useEffect(() => {
    const audio = mainAudioRef.current;
    if (!audio) return;

    const onEnded = () => {
      console.log("AudioEngine: Track ended, advancing...");
      if (settings.loop === 'one') {
        if (mainAudioRef.current) {
          mainAudioRef.current.currentTime = 0;
          mainAudioRef.current.play().catch(err => {
            console.warn("Loop one play failed:", err);
            setIsPlaying(false);
          });
        }
      } else {
        playNext(true);
      }
    };

    const onSubEnded = () => {
      if (settings.subliminal.isPlaylistMode && settings.subliminal.sourcePlaylistId) {
        const playlist = playlists.find(p => p.id === settings.subliminal.sourcePlaylistId);
        if (playlist && playlist.trackIds.length > 0) {
          let found = false;
          let attempts = 0;
          while (!found && attempts < playlist.trackIds.length) {
            subPlaylistIndexRef.current = (subPlaylistIndexRef.current + 1) % playlist.trackIds.length;
            const nextTrackId = playlist.trackIds[subPlaylistIndexRef.current];
            const nextTrack = tracks.find(t => t.id === nextTrackId);
            if (nextTrack && !nextTrack.isMissing && subAudioRef.current) {
              if (isPlaying) {
                // Pre-validate Sub track before assigning src
                getTrackUrl(nextTrack.id).then(url => {
                  if (url && subAudioRef.current) {
                    subAudioRef.current.src = url;
                    subAudioRef.current.load();
                    subAudioRef.current.play().catch(console.error);
                  }
                });
              }
              found = true;
            }
            attempts++;
          }
        }
      }
    };

    let errorCount = 0;
    let isRecovering = false;

    const onError = async (e: any) => {
      const error = mainAudioRef.current?.error;
      console.warn("[AudioEngine] Playback error encountered:", error?.code, error?.message);
      
      if (!isPlaying || isRecovering) return;

      // iOS 16 Recovery Logic:
      // If code is 4 (SRC_NOT_SUPPORTED) or 3 (DECODE), it effectively means the Blob URL was likely revoked
      if (error?.code === 4 || error?.code === 3) {
        if (currentTrack && errorCount < 2) {
          console.log("[AudioEngine] Attempting URL recovery for track:", currentTrack.id);
          isRecovering = true;
          errorCount++;
          
          try {
            const freshUrl = await getTrackUrl(currentTrack.id, true);
            if (freshUrl && mainAudioRef.current) {
              console.log("[AudioEngine] Fresh URL obtained, re-injecting source");
              mainAudioRef.current.src = freshUrl;
              mainAudioRef.current.load();
              await mainAudioRef.current.play();
              isRecovering = false;
              errorCount = 0; 
              return;
            }
          } catch (recoveryErr) {
            console.error("[AudioEngine] Recovery failed:", recoveryErr);
          }
          isRecovering = false;
        }
      }

      // If recovery failed or it's another error, do the standard skip
      errorCount++;
      if (errorCount > 2) {
        console.error("[AudioEngine] Multiple playback failures. Skipping track.");
        errorCount = 0;
        playNext(true);
      } else {
        setTimeout(() => {
          if (isPlaying && mainAudioRef.current) {
            mainAudioRef.current.play().catch(() => {});
          }
        }, 1000);
      }
    };

    const handleStalled = () => {
      console.warn("Main Engine: Playback stalled.");
      if (isPlaying) {
        setTimeout(() => {
          if (isPlaying && mainAudioRef.current && mainAudioRef.current.paused) {
             mainAudioRef.current.play().catch(() => {});
          }
        }, 1500);
      }
    };

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('stalled', handleStalled);

    if (subAudioRef.current) {
      subAudioRef.current.addEventListener('ended', onSubEnded);
    }

    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('stalled', handleStalled);
      if (subAudioRef.current) {
        subAudioRef.current.removeEventListener('ended', onSubEnded);
      }
    };
  }, [playNext, isPlaying, playlists, tracks, settings.subliminal.isPlaylistMode, settings.subliminal.sourcePlaylistId]);

  // Handle Subliminal Source Sync
  useEffect(() => {
    if (subAudioRef.current && subTrack && preparedSubUrl) {
      if (subAudioRef.current.src !== preparedSubUrl) {
        subAudioRef.current.src = preparedSubUrl;
        subAudioRef.current.load();
      }
    }
  }, [subTrack, preparedSubUrl]);

  const setupAudioTools = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;

      // 1. Setup Master Routing (The Final Gate)
      if (!masterGainRef.current) {
        masterGainRef.current = ctx.createGain();
        masterLimiterRef.current = ctx.createDynamicsCompressor();
        
        // Safety Limiter to prevent clipping across all layers
        const limiter = masterLimiterRef.current;
        limiter.threshold.setValueAtTime(-1.0, ctx.currentTime);
        limiter.knee.setValueAtTime(0, ctx.currentTime);
        limiter.ratio.setValueAtTime(20, ctx.currentTime);
        limiter.attack.setValueAtTime(0.001, ctx.currentTime);
        limiter.release.setValueAtTime(0.1, ctx.currentTime);
        
        masterGainRef.current.connect(limiter);
        limiter.connect(ctx.destination);
        
        // Default master gain is 1.0 (individual layers have their own gains)
        masterGainRef.current.gain.setValueAtTime(1.0, ctx.currentTime);
      }
      
      // 2. Setup Tool Routing (Playlist & Subliminal)
      if (!toolGainRef.current) {
        toolGainRef.current = ctx.createGain();
        toolCompressorRef.current = ctx.createDynamicsCompressor();
        
        const comp = toolCompressorRef.current;
        comp.threshold.setValueAtTime(settings.audioTools.normalizeTargetDb !== null ? settings.audioTools.normalizeTargetDb : 0, ctx.currentTime);
        comp.knee.setValueAtTime(0, ctx.currentTime);
        comp.ratio.setValueAtTime(20, ctx.currentTime);
        comp.attack.setValueAtTime(0.003, ctx.currentTime);
        comp.release.setValueAtTime(0.25, ctx.currentTime);
        
        toolGainRef.current.connect(comp);
        // Connect tool chain to master gain
        comp.connect(masterGainRef.current);
      }
      
      if (mainAudioRef.current && !mainSourceRef.current) {
        mainSourceRef.current = ctx.createMediaElementSource(mainAudioRef.current);
        if (!mainGainRef.current) {
          mainGainRef.current = ctx.createGain();
        }
        mainSourceRef.current.connect(mainGainRef.current);
        mainGainRef.current.connect(toolGainRef.current);
      }
      
      if (subAudioRef.current && !subSourceRef.current) {
        subSourceRef.current = ctx.createMediaElementSource(subAudioRef.current);
        
        if (!subSpecificGainRef.current) {
          subSpecificGainRef.current = ctx.createGain();
        }
        if (!subCompRef.current) {
          subCompRef.current = ctx.createDynamicsCompressor();
          subCompRef.current.threshold.setValueAtTime(-24, ctx.currentTime);
          subCompRef.current.ratio.setValueAtTime(12, ctx.currentTime);
        }
        
        subSourceRef.current.connect(subCompRef.current);
        subCompRef.current.connect(subSpecificGainRef.current);
        subSpecificGainRef.current.connect(toolGainRef.current);
      }
    } catch (err) {
      console.error("Audio tools setup failed:", err);
    }
  };

  // Handle Audio Tools Real-time Updates
  useEffect(() => {
    if (audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      
      // Update Master Gain
      if (toolGainRef.current) {
        const gainValue = Math.pow(10, settings.audioTools.gainDb / 20);
        toolGainRef.current.gain.setTargetAtTime(gainValue, ctx.currentTime, 0.1);
      }
      
      // Update Subliminal Specific Gain & Normalize
      if (subSpecificGainRef.current) {
        const subGainValue = Math.pow(10, settings.subliminal.gainDb / 20);
        subSpecificGainRef.current.gain.setTargetAtTime(subGainValue, ctx.currentTime, 0.1);
      }
      if (subCompRef.current) {
        const threshold = settings.subliminal.normalize ? -24 : 0;
        subCompRef.current.threshold.setTargetAtTime(threshold, ctx.currentTime, 0.1);
      }
      
      // Update Normalization Compressor (Master)
      if (toolCompressorRef.current) {
        const targetDb = settings.audioTools.normalizeTargetDb !== null ? settings.audioTools.normalizeTargetDb : 0;
        toolCompressorRef.current.threshold.setTargetAtTime(targetDb, ctx.currentTime, 0.1);
      }
    }
  }, [settings.audioTools.gainDb, settings.audioTools.normalizeTargetDb, settings.subliminal.gainDb]);

  // Handle Main Track Source Change
  useEffect(() => {
    if (mainAudioRef.current && currentTrack && preparedUrl) {
      const wasPlaying = isPlaying;
      
      // Strict reset for iOS: Clear src and load() to flush old buffers
      if (mainAudioRef.current.src !== preparedUrl) {
        console.log("[AudioEngine] Loading new track source:", currentTrack.id);
        const oldUrl = mainAudioRef.current.src;
        mainAudioRef.current.pause();
        mainAudioRef.current.src = preparedUrl;
        mainAudioRef.current.load(); // Flush
        
        // Help Safari cleanup if old was a blob
        if (oldUrl.startsWith('blob:')) {
           // We don't revoke here because it might be cached in AudioContext,
           // but resetting the src helps Safari release the media resource.
        }
      }

      if (wasPlaying) {
        // Use a small safety delay for older iPhones to stabilize the media pipeline
        setTimeout(() => {
           if (mainAudioRef.current && isPlaying) {
             mainAudioRef.current.play().catch(err => {
               console.warn("[AudioEngine] Auto-play failed after source change:", err);
             });
           }
        }, 150);
      }
    } else if (mainAudioRef.current && !currentTrack) {
      mainAudioRef.current.pause();
      mainAudioRef.current.src = "";
      mainAudioRef.current.load();
    }
  }, [currentTrack?.id, preparedUrl]);

  // Handle Play/Pause and MediaSession State
  useEffect(() => {
    if (!mainAudioRef.current) return;

    if (isPlaying) {
      if (currentTrack?.isMissing) {
        setIsPlaying(false);
        showToast("Track file missing. Please relink.");
        return;
      }
      
      // CRITICAL: Ensure context is running BEFORE starting any audio
      // On iOS 16, this must be called frequently to prevent suspension
      const resumeContext = () => {
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
      };

      resumeContext();
      setupAudioTools();
      
      const playMain = () => {
        if (mainAudioRef.current && mainAudioRef.current.paused) {
          resumeContext();
          mainAudioRef.current.play().catch(e => {
            console.error("Playback error:", e);
            if (e.name === 'NotAllowedError') {
              showToast("Tap screen to enable audio");
            }
            setIsPlaying(false);
          });
        }
      };

      // Small delay to ensure Web Audio graph is ready
      const timer = setTimeout(playMain, 50);
      
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
      
      // Start subliminal with delay
      if (settings.subliminal.isEnabled && subTrack && subAudioRef.current && !subTrack.isMissing) {
        if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
        
        delayTimeoutRef.current = window.setTimeout(() => {
          if (subAudioRef.current && isPlaying) {
            resumeContext();
            if (subAudioRef.current.src !== subTrack.url) {
              subAudioRef.current.src = subTrack.url;
            }
            subAudioRef.current.loop = settings.subliminal.isPlaylistMode ? false : settings.subliminal.isLooping;
            subAudioRef.current.play().catch(console.error);
          }
        }, settings.subliminal.delayMs);
      }

      return () => clearTimeout(timer);
    } else {
      if (mainAudioRef.current) mainAudioRef.current.pause();
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
      if (subAudioRef.current) subAudioRef.current.pause();
      if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
    }
  }, [isPlaying, settings.subliminal.isEnabled, subTrack]);

  // Handle Binaural Playback and Fading
  useEffect(() => {
    if (isPlaying && settings.binaural.isEnabled) {
      setupBinaural();
      if (binauralGainRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const fadeTime = settings.fadeInOut ? 3 : 0.1;
        const gainValue = settings.binaural.volume * Math.pow(10, settings.binaural.gainDb / 20);
        const threshold = settings.binaural.normalize ? -24 : 0;
        
        if (binCompRef.current) binCompRef.current.threshold.setTargetAtTime(threshold, ctx.currentTime, 0.1);
        binauralGainRef.current.gain.setTargetAtTime(gainValue, ctx.currentTime, fadeTime / 2);
      }
    } else {
      if (binauralGainRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const fadeTime = settings.fadeInOut ? 3 : 0.1;
        binauralGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, fadeTime / 2);
      }
    }
  }, [isPlaying, settings.binaural.isEnabled, settings.fadeInOut]);

  // Handle Binaural Frequency/Volume Updates
  useEffect(() => {
    if (leftOscRef.current && rightOscRef.current && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      // Safety: Difference <= 30Hz
      const diff = Math.abs(settings.binaural.leftFreq - settings.binaural.rightFreq);
      let lFreq = settings.binaural.leftFreq;
      let rFreq = settings.binaural.rightFreq;
      
      if (diff > 30) {
        rFreq = lFreq + 30; // Force limit
      }

      leftOscRef.current.frequency.setTargetAtTime(lFreq, ctx.currentTime, 0.1);
      rightOscRef.current.frequency.setTargetAtTime(rFreq, ctx.currentTime, 0.1);
    }
    
    if (binauralGainRef.current && audioCtxRef.current && isPlaying && settings.binaural.isEnabled) {
      const ctx = audioCtxRef.current;
      const gainValue = settings.binaural.volume * Math.pow(10, settings.binaural.gainDb / 20);
      const threshold = settings.binaural.normalize ? -24 : 0;
      
      if (binCompRef.current) binCompRef.current.threshold.setTargetAtTime(threshold, ctx.currentTime, 0.1);
      binauralGainRef.current.gain.setTargetAtTime(gainValue, ctx.currentTime, 0.1);
    }
  }, [settings.binaural.leftFreq, settings.binaural.rightFreq, settings.binaural.volume, settings.binaural.gainDb, settings.binaural.normalize]);

  // Handle Noise Layer
  useEffect(() => {
    if (isPlaying && settings.noise.isEnabled) {
      setupNoise();
      const ctx = audioCtxRef.current!;
      
      // Stop old noise if type changed
      if (noiseNodeRef.current) {
        noiseNodeRef.current.stop();
        noiseNodeRef.current = null;
      }

      const buffer = createNoiseBuffer(settings.noise.type);
      const source = ctx.createBufferSource();
      source.buffer = buffer!;
      source.loop = true;
      source.connect(noiseCompRef.current!);
      source.start();
      noiseNodeRef.current = source;

      const fadeTime = settings.fadeInOut ? 3 : 0.1;
      const gainValue = settings.noise.volume * Math.pow(10, settings.noise.gainDb / 20);
      const threshold = settings.noise.normalize ? -24 : 0;
      
      if (noiseCompRef.current) noiseCompRef.current.threshold.setTargetAtTime(threshold, ctx.currentTime, 0.1);
      noiseGainRef.current!.gain.setTargetAtTime(gainValue, ctx.currentTime, fadeTime / 2);
    } else {
      if (noiseGainRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const fadeTime = settings.fadeInOut ? 3 : 0.1;
        noiseGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, fadeTime / 2);
        
        const timer = setTimeout(() => {
           if (!settings.noise.isEnabled && noiseNodeRef.current) {
             noiseNodeRef.current.stop();
             noiseNodeRef.current = null;
           }
        }, fadeTime * 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [isPlaying, settings.noise.isEnabled, settings.noise.type, settings.noise.volume, settings.noise.gainDb, settings.noise.normalize]);

  // Handle Didgeridoo Layer
  useEffect(() => {
    if (isPlaying && settings.didgeridoo.isEnabled && settings.didgeridoo.isLooping) {
      setupDidgeridoo();
      if (didgGainRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const fadeTime = settings.fadeInOut ? 3 : 0.1;
        // Apply both volume and gainDb for precision control
        const gainValue = settings.didgeridoo.volume * Math.pow(10, settings.didgeridoo.gainDb / 20);
        const threshold = settings.didgeridoo.normalize ? -24 : 0;
        
        if (didgCompRef.current) didgCompRef.current.threshold.setTargetAtTime(threshold, ctx.currentTime, 0.1);
        didgGainRef.current.gain.setTargetAtTime(gainValue, ctx.currentTime, fadeTime / 2);
      }
    } else {
      if (didgGainRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const fadeTime = settings.fadeInOut ? 3 : 0.1;
        didgGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, fadeTime / 2);
      }
    }
  }, [isPlaying, settings.didgeridoo.isEnabled, settings.didgeridoo.isLooping, settings.fadeInOut, settings.didgeridoo.volume, settings.didgeridoo.gainDb, settings.didgeridoo.normalize]);

  // Handle Pure Hz Layer
  useEffect(() => {
    if (isPlaying && settings.pureHz.isEnabled && settings.pureHz.isLooping) {
      setupPureHz();
      if (pureHzGainRef.current && pureHzOscRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const fadeTime = settings.fadeInOut ? 3 : 0.4;
        const gainValue = settings.pureHz.volume * Math.pow(10, settings.pureHz.gainDb / 20);
        pureHzOscRef.current.frequency.setTargetAtTime(settings.pureHz.frequency, ctx.currentTime, 0.1);
        pureHzGainRef.current.gain.setTargetAtTime(gainValue, ctx.currentTime, fadeTime / 2);
      }
    } else {
      if (pureHzGainRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const fadeTime = settings.fadeInOut ? 3 : 0.4;
        pureHzGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, fadeTime / 2);
      }
    }
  }, [isPlaying, settings.pureHz.isEnabled, settings.pureHz.isLooping, settings.fadeInOut, settings.pureHz.volume, settings.pureHz.frequency, settings.pureHz.gainDb]);

  // Handle Isochronic Layer
  useEffect(() => {
    if (isPlaying && settings.isochronic.isEnabled) {
      setupIsochronic();
      if (isoGainRef.current && isoOscRef.current && isoLfoRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const fadeTime = settings.fadeInOut ? 3 : 0.4;
        const gainValue = settings.isochronic.volume * Math.pow(10, settings.isochronic.gainDb / 20);
        isoOscRef.current.frequency.setTargetAtTime(settings.isochronic.frequency, ctx.currentTime, 0.1);
        isoLfoRef.current.frequency.setTargetAtTime(settings.isochronic.pulseRate, ctx.currentTime, 0.1);
        isoGainRef.current.gain.setTargetAtTime(gainValue, ctx.currentTime, fadeTime / 2);
      }
    } else {
      if (isoGainRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const fadeTime = settings.fadeInOut ? 3 : 0.4;
        isoGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, fadeTime / 2);
      }
    }
  }, [isPlaying, settings.isochronic.isEnabled, settings.fadeInOut, settings.isochronic.volume, settings.isochronic.frequency, settings.isochronic.pulseRate, settings.isochronic.gainDb]);

  // Handle Solfeggio Layer
  useEffect(() => {
    if (isPlaying && settings.solfeggio.isEnabled) {
      setupSolfeggio();
      if (solGainRef.current && solOscRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const fadeTime = settings.fadeInOut ? 3 : 0.4;
        const gainValue = settings.solfeggio.volume * Math.pow(10, settings.solfeggio.gainDb / 20);
        solOscRef.current.frequency.setTargetAtTime(settings.solfeggio.frequency, ctx.currentTime, 0.1);
        solGainRef.current.gain.setTargetAtTime(gainValue, ctx.currentTime, fadeTime / 2);
      }
    } else {
      if (solGainRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const fadeTime = settings.fadeInOut ? 3 : 0.4;
        solGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, fadeTime / 2);
      }
    }
  }, [isPlaying, settings.solfeggio.isEnabled, settings.fadeInOut, settings.solfeggio.volume, settings.solfeggio.frequency, settings.solfeggio.gainDb]);

  // Handle Display Always On (WakeLock)
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && settings.displayAlwaysOn && isPlaying) {
        try {
          if (wakeLockRef.current) return; // Already active
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('[AudioEngine] Wake Lock is active');
          
          wakeLockRef.current.addEventListener('release', () => {
            console.log('[AudioEngine] Wake Lock released by system');
            wakeLockRef.current = null;
          });
        } catch (err) {
          console.warn(`[AudioEngine] Wake Lock request failed: ${err.name}, ${err.message}`);
          wakeLockRef.current = null;
        }
      }
    };

    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
          console.log('[AudioEngine] Wake Lock released intentionally');
        } catch (err) {
          console.warn(`[AudioEngine] Wake Lock release failed: ${err.message}`);
        }
      }
    };

    if (settings.displayAlwaysOn && isPlaying) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && settings.displayAlwaysOn && isPlaying) {
        requestWakeLock();
      }
      
      // Recovery logic for iOS: if we return to the app and audio is supposed to be playing but context is suspended
      if (document.visibilityState === 'visible' && isPlaying && audioCtxRef.current) {
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [settings.displayAlwaysOn, isPlaying]);

  // Handle Didgeridoo Real-time Updates (Rate)
  useEffect(() => {
    if (didgOscRef.current && didgSubOscRef.current && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      const baseFreq = 65 * settings.didgeridoo.playbackRate;
      didgOscRef.current.frequency.setTargetAtTime(baseFreq, ctx.currentTime, 0.2);
      didgSubOscRef.current.frequency.setTargetAtTime(baseFreq, ctx.currentTime, 0.2);
    }
  }, [settings.didgeridoo.playbackRate]);

  // Handle Nature Layer
  useEffect(() => {
    if (isPlaying && settings.nature.isEnabled && natureAudioRef.current) {
      setupNature();
      const audio = natureAudioRef.current;
      const sound = NATURE_SOUNDS.find(s => s.id === settings.nature.type);
      if (sound) {
        if (audio.src !== sound.url) {
          audio.src = sound.url;
          audio.play().catch(console.error);
        } else if (audio.paused) {
          audio.play().catch(console.error);
        }
        
        if (natureGainRef.current && audioCtxRef.current) {
          const ctx = audioCtxRef.current;
          const fadeTime = settings.fadeInOut ? 3 : 0.1;
          const gainValue = settings.nature.volume * Math.pow(10, settings.nature.gainDb / 20);
          const threshold = settings.nature.normalize ? -24 : 0;
          
          if (natureCompRef.current) natureCompRef.current.threshold.setTargetAtTime(threshold, ctx.currentTime, 0.1);
          natureGainRef.current.gain.setTargetAtTime(gainValue, ctx.currentTime, fadeTime / 2);
        }
      }
    } else {
      if (natureGainRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const fadeTime = settings.fadeInOut ? 3 : 0.1;
        natureGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, fadeTime / 2);
        setTimeout(() => {
           if (!settings.nature.isEnabled && natureAudioRef.current) natureAudioRef.current.pause();
        }, fadeTime * 1000);
      } else if (natureAudioRef.current) {
        natureAudioRef.current.pause();
      }
    }
  }, [isPlaying, settings.nature.isEnabled, settings.nature.type, settings.nature.volume, settings.nature.gainDb, settings.nature.normalize, settings.fadeInOut]);

  // Handle Volume Balance
  useEffect(() => {
    if (audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      const fadeTime = 0.1;

      if (mainGainRef.current) {
        const gainValue = settings.mainVolume; // Already 0-1
        mainGainRef.current.gain.setTargetAtTime(gainValue, ctx.currentTime, fadeTime);
      }
      
      if (subSpecificGainRef.current) {
        // Respect both volume and gain(dB)
        const gainValue = settings.subliminal.volume * Math.pow(10, settings.subliminal.gainDb / 20);
        subSpecificGainRef.current.gain.setTargetAtTime(gainValue, ctx.currentTime, fadeTime);
      }
    }

    // Keep elements at 1.0 volume since we control via GainNodes now
    if (mainAudioRef.current) mainAudioRef.current.volume = 1.0;
    if (subAudioRef.current) subAudioRef.current.volume = 1.0;
  }, [settings.mainVolume, settings.subliminal.volume, settings.subliminal.gainDb, currentTrack]);

  // Handle Playback Rate
  useEffect(() => {
    if (mainAudioRef.current) {
      mainAudioRef.current.playbackRate = settings.playbackRate;
    }
  }, [settings.playbackRate, currentTrack]);

  // Sync Subliminal with Main Track if enabled
  useEffect(() => {
    if (isPlaying && settings.syncPlayback && settings.subliminal.isEnabled && mainAudioRef.current && subAudioRef.current && !settings.subliminal.isPlaylistMode) {
      const syncInterval = setInterval(() => {
        if (mainAudioRef.current && subAudioRef.current && subAudioRef.current.readyState >= 2) {
          const mainTime = mainAudioRef.current.currentTime;
          const subTime = subAudioRef.current.currentTime;
          const duration = subAudioRef.current.duration;
          
          if (duration > 0) {
             const targetTime = mainTime % duration;
             const diff = Math.abs(targetTime - subTime);
             
             // Only sync if they drift by more than 0.5s to avoid stutter
             if (diff > 0.5) {
               subAudioRef.current.currentTime = targetTime;
             }
          }
        }
      }, 2000);
      return () => clearInterval(syncInterval);
    }
  }, [isPlaying, settings.syncPlayback, settings.subliminal.isEnabled, settings.subliminal.isPlaylistMode]);

  // Handle Subliminal Looping State
  useEffect(() => {
    if (subAudioRef.current) {
      subAudioRef.current.loop = settings.subliminal.isPlaylistMode ? false : settings.subliminal.isLooping;
    }
  }, [settings.subliminal.isLooping, settings.subliminal.isPlaylistMode]);

  // Audio Context Heartbeat & Playback Safety
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      // 1. Context Nudge
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        console.log('[AudioEngine] Heartbeat: Resuming suspended context');
        audioCtxRef.current.resume().catch(() => {});
      }
      
      // 2. Playback Safety: If supposed to be playing but both are paused, attempt nudge
      // Enhanced for iOS 16: Check readyState and stalled state
      if (mainAudioRef.current && isPlaying) {
         const { paused, readyState, networkState, error } = mainAudioRef.current;
         
         if (paused) {
            console.warn('[AudioEngine] Heartbeat: Playback desync detected, nudging...');
            mainAudioRef.current.play().catch(() => {});
         }
         
         // If stuck in a "stalled" but not paused state with no meta
         if (readyState < 1 && networkState === 2) { // 2 = NETWORK_LOADING
            console.warn('[AudioEngine] Heartbeat: Media stuck in loading state, reloading...');
            mainAudioRef.current.load();
         }
      }
    }, 10000); // 10s is safe for background battery
    
    return () => clearInterval(interval);
  }, [isPlaying]);

  return null;
}
