import React, { useEffect, useRef, useState } from 'react';
import { WHEEL_SLICES } from '../utils/constants';
import { GameRound, WheelColor } from '../types';
import { Volume2, VolumeX } from 'lucide-react';

interface SpinWheelProps {
  round?: GameRound | null;
  rotation?: number;
  isSpinning?: boolean;
  winningColor?: WheelColor | null;
  celebrationColor?: WheelColor | null;
}

export const SpinWheel: React.FC<SpinWheelProps> = ({
  round,
  rotation,
  isSpinning,
  winningColor,
  celebrationColor,
}) => {
  const size = 320; // Base coordinate size
  const center = size / 2;
  const radius = center - 16;
  const innerRadius = 38;

  // Direct DOM references for zero-re-render 60fps/120fps GPU animations
  const rotorRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Rotation states & physics tracking
  const currentAngleRef = useRef<number>(rotation || 0);
  const startAngleRef = useRef<number>(rotation || 0);
  const targetAngleRef = useRef<number>(round?.targetAngle || rotation || 0);
  const activeRoundIdRef = useRef<string | null>(null);
  const lastPegIndexRef = useRef<number>(-1);
  const needleDeflectionRef = useRef<number>(0);
  const hasPlayedRevealRef = useRef<string | null>(null);

  // Sound effects & Visual Flash state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showResultFlash, setShowResultFlash] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Resume / initialize Web Audio context on user interaction to guarantee immediate playback
  useEffect(() => {
    const handleUserInteraction = () => {
      try {
        if (!audioCtxRef.current) {
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioCtx) {
            audioCtxRef.current = new AudioCtx();
          }
        }
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
      } catch {}
    };

    window.addEventListener('pointerdown', handleUserInteraction, { once: true, passive: true });
    window.addEventListener('keydown', handleUserInteraction, { once: true, passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
    };
  }, []);

  // Procedural Stereo Crowd Clapping Generator (synthesizes 1100+ spatialized handclaps)
  const createApplauseBuffer = (ctx: AudioContext, duration = 3.6): AudioBuffer => {
    const sampleRate = ctx.sampleRate;
    const totalSamples = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(2, totalSamples, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const numClaps = 1150;
    for (let i = 0; i < numClaps; i++) {
      // Swelling distribution: dense explosive onset, sustained body, gentle natural taper
      const rawT = Math.random();
      const t = Math.pow(rawT, 1.22) * (duration - 0.25) + 0.03;
      const startSample = Math.floor(t * sampleRate);
      if (startSample >= totalSamples) continue;

      // Stereo panning from -0.85 (left) to +0.85 (right) for immersive room acoustics
      const pan = (Math.random() * 2 - 1) * 0.85;
      const leftVol = (1 - pan) * 0.5;
      const rightVol = (1 + pan) * 0.5;

      // Single handclap acoustic characteristics
      const clapLen = Math.floor(sampleRate * (0.012 + Math.random() * 0.016));
      const freq = 920 + Math.random() * 1650;
      const decay = 0.0035 + Math.random() * 0.005;

      for (let s = 0; s < clapLen && startSample + s < totalSamples; s++) {
        const tau = s / sampleRate;
        const env = Math.exp(-tau / decay);
        const noise = (Math.random() * 2 - 1) * 0.85;
        const tone = Math.sin(2 * Math.PI * freq * tau) * 0.5;
        const val = (noise + tone) * env * 0.42;
        left[startSample + s] += val * leftVol;
        right[startSample + s] += val * rightVol;
      }
    }

    // Peak normalize buffer cleanly
    let peak = 0;
    for (let i = 0; i < totalSamples; i += 8) {
      if (Math.abs(left[i]) > peak) peak = Math.abs(left[i]);
      if (Math.abs(right[i]) > peak) peak = Math.abs(right[i]);
    }
    if (peak > 0) {
      const normFactor = 0.96 / peak;
      for (let i = 0; i < totalSamples; i++) {
        left[i] *= normFactor;
        right[i] *= normFactor;
      }
    }

    return buffer;
  };

  // Loud Result Reveal Flash & Victory Sound Synthesizer:
  // 1. Cinematic Sub-bass impact boom
  // 2. High-energy Pyrotechnic Flash / Laser whoosh sweep
  // 3. Triumphant Major Triad Victory Chimes (Fanfare)
  // 4. LOUDER "HURRAY!" Voice of Many People (Choral formant synthesis with upward cheering inflection)
  // 5. LOUDER Crowd Clapping & Applause (Stereo arena standing ovation)
  const playRevealFlashSound = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;

      // 1. Cinematic Heavy Impact Sub-Bass Boom (190Hz -> 36Hz at 0.70 gain)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(190, now);
      subOsc.frequency.exponentialRampToValueAtTime(36, now + 0.48);
      subGain.gain.setValueAtTime(0.70, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.50);

      // 2. High-Energy White Noise Flash / Pyro Flare Sweep (simulates bright camera flash & firework pop)
      const bufferSize = Math.floor(ctx.sampleRate * 0.4);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1700, now);
      filter.frequency.exponentialRampToValueAtTime(280, now + 0.38);
      filter.Q.setValueAtTime(3.2, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.60, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseSource.start(now);

      // 3. Triumphant Major Triad Victory Chimes (Ascending Fanfare: C5 - E5 - G5 - C6)
      const fanfareNotes = [523.25, 659.25, 783.99, 1046.5];
      fanfareNotes.forEach((freq, idx) => {
        const noteOsc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        noteOsc.type = 'triangle';
        noteOsc.frequency.setValueAtTime(freq, now + idx * 0.055);

        const startTime = now + idx * 0.055;
        noteGain.gain.setValueAtTime(0.001, now);
        noteGain.gain.setValueAtTime(0.48, startTime);
        noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.75);

        noteOsc.connect(noteGain);
        noteGain.connect(ctx.destination);
        noteOsc.start(startTime);
        noteOsc.stop(startTime + 0.78);
      });

      // 4. LOUDER "HURRAY!" VOICE OF MANY PEOPLE (Authentic multi-voice choral cheer ensemble)
      const voiceBasePitches = [140, 165, 190, 215, 245, 280, 320, 370];
      const cheerMasterGain = ctx.createGain();
      cheerMasterGain.gain.setValueAtTime(0.001, now);
      cheerMasterGain.gain.exponentialRampToValueAtTime(0.82, now + 0.35); // Very loud peak cheer
      cheerMasterGain.gain.setValueAtTime(0.82, now + 1.8);
      cheerMasterGain.gain.exponentialRampToValueAtTime(0.001, now + 2.9);
      cheerMasterGain.connect(ctx.destination);

      voiceBasePitches.forEach((baseF0, idx) => {
        const osc = ctx.createOscillator();
        const voiceGain = ctx.createGain();

        // Resonant Vocal Tract Formants: "Hoo... (F1~380Hz, F2~850Hz) -> ...RAAAAY! (F1~780Hz, F2~2150Hz)"
        const f1 = ctx.createBiquadFilter();
        f1.type = 'bandpass';
        f1.Q.setValueAtTime(4.2, now);
        f1.frequency.setValueAtTime(380, now);
        f1.frequency.exponentialRampToValueAtTime(800, now + 0.65);

        const f2 = ctx.createBiquadFilter();
        f2.type = 'bandpass';
        f2.Q.setValueAtTime(4.8, now);
        f2.frequency.setValueAtTime(880, now);
        f2.frequency.exponentialRampToValueAtTime(2150, now + 0.65);

        // Pitch inflection: "Hoo-" -> explosive leap up into celebratory "-RAAAAY!"
        const leapPitch = baseF0 * 1.72;
        osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(baseF0, now);
        osc.frequency.exponentialRampToValueAtTime(leapPitch, now + 0.58);
        osc.frequency.exponentialRampToValueAtTime(leapPitch * 0.96, now + 2.4);

        // Human chorus timing micro-stagger
        const startOffset = now + (idx % 4) * 0.022;
        voiceGain.gain.setValueAtTime(0.001, now);
        voiceGain.gain.exponentialRampToValueAtTime(0.24, startOffset + 0.2);
        voiceGain.gain.setValueAtTime(0.24, startOffset + 1.6);
        voiceGain.gain.exponentialRampToValueAtTime(0.001, startOffset + 2.7);

        osc.connect(voiceGain);
        voiceGain.connect(f1);
        voiceGain.connect(f2);
        f1.connect(cheerMasterGain);
        f2.connect(cheerMasterGain);

        osc.start(startOffset);
        osc.stop(startOffset + 2.8);
      });

      // Breathy vocal crowd friction / collective cheer air
      const breathBufferSize = Math.floor(ctx.sampleRate * 2.6);
      const breathBuffer = ctx.createBuffer(1, breathBufferSize, ctx.sampleRate);
      const breathData = breathBuffer.getChannelData(0);
      for (let i = 0; i < breathBufferSize; i++) {
        breathData[i] = Math.random() * 2 - 1;
      }
      const breathSource = ctx.createBufferSource();
      breathSource.buffer = breathBuffer;

      const breathFilter = ctx.createBiquadFilter();
      breathFilter.type = 'bandpass';
      breathFilter.frequency.setValueAtTime(460, now);
      breathFilter.frequency.exponentialRampToValueAtTime(1650, now + 0.65);
      breathFilter.Q.setValueAtTime(2.2, now);

      const breathGain = ctx.createGain();
      breathGain.gain.setValueAtTime(0.001, now);
      breathGain.gain.exponentialRampToValueAtTime(0.42, now + 0.35);
      breathGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

      breathSource.connect(breathFilter);
      breathFilter.connect(breathGain);
      breathGain.connect(ctx.destination);
      breathSource.start(now);
      breathSource.stop(now + 2.6);

      // Celebratory crowd whistles ("Woo-hoo!")
      const whistlePitches = [1350, 1620];
      whistlePitches.forEach((pitch, i) => {
        const whistleOsc = ctx.createOscillator();
        const whistleGain = ctx.createGain();
        whistleOsc.type = 'sine';
        const wStart = now + 0.35 + i * 0.22;
        whistleOsc.frequency.setValueAtTime(pitch, wStart);
        whistleOsc.frequency.exponentialRampToValueAtTime(pitch * 1.5, wStart + 0.35);
        whistleOsc.frequency.exponentialRampToValueAtTime(pitch * 1.15, wStart + 0.7);

        whistleGain.gain.setValueAtTime(0.001, now);
        whistleGain.gain.setValueAtTime(0.26, wStart + 0.1);
        whistleGain.gain.exponentialRampToValueAtTime(0.001, wStart + 0.75);

        whistleOsc.connect(whistleGain);
        whistleGain.connect(ctx.destination);
        whistleOsc.start(wStart);
        whistleOsc.stop(wStart + 0.8);
      });

      // 5. LOUDER MULTI-PERSON CLAPPING & APPLAUSE (Arena standing ovation)
      const applauseBuffer = createApplauseBuffer(ctx, 3.6);
      const applauseSource = ctx.createBufferSource();
      applauseSource.buffer = applauseBuffer;

      const clapHighpass = ctx.createBiquadFilter();
      clapHighpass.type = 'highpass';
      clapHighpass.frequency.setValueAtTime(220, now);

      const applauseGain = ctx.createGain();
      applauseGain.gain.setValueAtTime(0.001, now);
      applauseGain.gain.exponentialRampToValueAtTime(0.80, now + 0.18); // Loud explosive standing ovation
      applauseGain.gain.setValueAtTime(0.80, now + 2.1);
      applauseGain.gain.exponentialRampToValueAtTime(0.001, now + 3.6);

      applauseSource.connect(clapHighpass);
      clapHighpass.connect(applauseGain);
      applauseGain.connect(ctx.destination);
      applauseSource.start(now);
      applauseSource.stop(now + 3.6);
    } catch {
      // Audio safety catch
    }
  };

  const triggerRevealFlash = (roundId: string) => {
    if (hasPlayedRevealRef.current === roundId) return;
    hasPlayedRevealRef.current = roundId;
    playRevealFlashSound();
    setShowResultFlash(true);
    setTimeout(() => {
      setShowResultFlash(false);
    }, 900);
  };

  // Tactile casino wheel click audio synthesis using native Web Audio API
  // 10X LOUDER: Volume amplified by 10x with dual oscillator mechanical peg snap & acoustic body thump
  const playPegSound = (speedFactor: number) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;

      // 1. Primary Sharp Peg Strike (10x louder: 0.30 - 0.48 peak volume vs old 0.015 - 0.045)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Pitch modulates dynamically with wheel rotation speed
      const baseFreq = 480 + Math.min(320, (1 - Math.min(1, speedFactor)) * 320);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.035);

      // 10x Louder amplitude: calibrated up to 0.48
      const vol = Math.min(0.48, 0.28 + (1 - Math.min(1, speedFactor)) * 0.20);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.035);

      // 2. Secondary Mechanical Flapper Thump (adds rich acoustic casing body & snap)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(240, now);
      subOsc.frequency.exponentialRampToValueAtTime(60, now + 0.03);

      const subVol = Math.min(0.35, 0.18 + (1 - Math.min(1, speedFactor)) * 0.17);
      subGain.gain.setValueAtTime(subVol, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.03);
    } catch {
      // Audio autoplay policy catch
    }
  };

  // Mathematically C² continuous smooth casino wheel curve:
  // Starts with zero-jerk gradual torque acceleration, glides at cruising speed,
  // and smoothly decelerates with continuous friction right to the winning color without any stutter or landing snap.
  const getSpinProgress = (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;

    // Smooth ease-in Hermite ramp during initial 8%, blending seamlessly into continuous friction ease-out
    const ramp = t < 0.08 ? (t / 0.08) * (t / 0.08) * (3 - 2 * (t / 0.08)) : 1.0;
    const frictionDecel = 1 - Math.pow(1 - t, 2.3);
    return ramp * frictionDecel;
  };

  // High-performance animation driver
  useEffect(() => {
    if (!round) return;

    // Track round transition
    if (round.id !== activeRoundIdRef.current) {
      activeRoundIdRef.current = round.id;
      // Start angle is wherever the wheel currently is (guarantees monotonic forward rotation)
      startAngleRef.current = currentAngleRef.current;
      targetAngleRef.current = round.targetAngle;
    }

    if (round.status === 'SPINNING') {
      const spinDuration = round.spinDuration;
      const spinEndTime = round.spinEndTime;
      const spinStartTime = spinEndTime - spinDuration;
      const startAngle = startAngleRef.current;

      // Ensure target is strictly forward from startAngle by 18-22 revolutions (0.5x faster wheel speed)
      let finalTarget = round.targetAngle;
      while (finalTarget <= startAngle + 18 * 360) {
        finalTarget += 360;
      }
      targetAngleRef.current = finalTarget;

      const animate = () => {
        const now = Date.now();
        const elapsed = now - spinStartTime;
        const rawProgress = Math.max(0, Math.min(1, elapsed / spinDuration));

        const easedProgress = getSpinProgress(rawProgress);
        const currentAngle = startAngle + (finalTarget - startAngle) * easedProgress;
        currentAngleRef.current = currentAngle;

        // 1. Direct GPU transform update on rotor (0 React re-renders, 60fps/120fps hardware composited)
        if (rotorRef.current) {
          rotorRef.current.style.transform = `translate3d(0, 0, 0) rotate(${currentAngle.toFixed(3)}deg)`;
        }

        // 2. Tactile needle tick & flapper deflection (spring-damped for butter smoothness)
        const pegInterval = 360 / 30; // 30 studs around perimeter (12 deg per peg)
        const pegIndex = Math.floor(currentAngle / pegInterval);
        const pegPhase = (((currentAngle % pegInterval) + pegInterval) % pegInterval) / pegInterval;

        if (pegIndex !== lastPegIndexRef.current) {
          lastPegIndexRef.current = pegIndex;
          playPegSound(rawProgress);
        }

        if (pointerRef.current) {
          if (rawProgress < 0.995) {
            const speedScale = Math.max(0, 1 - rawProgress);
            const targetDeflection = Math.sin(pegPhase * Math.PI) * (1.8 + speedScale * 4.0);
            needleDeflectionRef.current += (targetDeflection - needleDeflectionRef.current) * 0.35;
            pointerRef.current.style.transform = `translateX(-50%) rotate(${-needleDeflectionRef.current.toFixed(2)}deg)`;
          } else {
            needleDeflectionRef.current += (0 - needleDeflectionRef.current) * 0.2;
            pointerRef.current.style.transform = `translateX(-50%) rotate(${-needleDeflectionRef.current.toFixed(2)}deg)`;
          }
        }

        if (rawProgress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          // Completed spin, lock exactly to target angle smoothly
          currentAngleRef.current = finalTarget;
          if (rotorRef.current) {
            rotorRef.current.style.transform = `translate3d(0, 0, 0) rotate(${finalTarget.toFixed(3)}deg)`;
          }
          if (pointerRef.current) {
            pointerRef.current.style.transform = 'translateX(-50%) rotate(0deg)';
          }

          // Trigger result reveal flash sound and visual flare immediately
          triggerRevealFlash(round.id);
        }
      };

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      animFrameRef.current = requestAnimationFrame(animate);

      return () => {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
      };
    } else if (round.status === 'COMPLETED') {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      const finalAngle = targetAngleRef.current || round.targetAngle;
      currentAngleRef.current = finalAngle;
      if (rotorRef.current) {
        rotorRef.current.style.transform = `translate3d(0, 0, 0) rotate(${finalAngle.toFixed(3)}deg)`;
      }
      if (pointerRef.current) {
        pointerRef.current.style.transform = 'translateX(-50%) rotate(0deg)';
      }

      // Trigger reveal flash if completed
      triggerRevealFlash(round.id);
    } else if (round.status === 'BETTING_OPEN') {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (pointerRef.current) {
        pointerRef.current.style.transform = 'translateX(-50%) rotate(0deg)';
      }
      if (rotorRef.current && currentAngleRef.current) {
        rotorRef.current.style.transform = `translate3d(0, 0, 0) rotate(${currentAngleRef.current.toFixed(3)}deg)`;
      }
    }
  }, [round?.id, round?.status, soundEnabled]);

  // Trigger flash on celebration color prop update as well
  useEffect(() => {
    if (celebrationColor && round?.id) {
      triggerRevealFlash(round.id);
    }
  }, [celebrationColor, round?.id]);

  // Fallback for standalone rotation prop
  useEffect(() => {
    if (!round && rotation !== undefined && rotorRef.current) {
      currentAngleRef.current = rotation;
      rotorRef.current.style.transform = `translate3d(0, 0, 0) rotate(${rotation}deg)`;
    }
  }, [round, rotation]);

  // Helper to calculate SVG arc coordinates where 0° is 12 o'clock
  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians),
    };
  };

  const describeArc = (
    x: number,
    y: number,
    outerR: number,
    innerR: number,
    startAngle: number,
    endAngle: number
  ) => {
    const startOuter = polarToCartesian(x, y, outerR, endAngle);
    const endOuter = polarToCartesian(x, y, outerR, startAngle);
    const startInner = polarToCartesian(x, y, innerR, endAngle);
    const endInner = polarToCartesian(x, y, innerR, startAngle);

    const arcSweep = endAngle - startAngle <= 180 ? '0' : '1';

    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerR} ${outerR} 0 ${arcSweep} 0 ${endOuter.x} ${endOuter.y}`,
      `L ${endInner.x} ${endInner.y}`,
      `A ${innerR} ${innerR} 0 ${arcSweep} 1 ${startInner.x} ${startInner.y}`,
      'Z',
    ].join(' ');
  };

  // Predefined slice gradients
  const sliceGradients: Record<WheelColor, { start: string; mid: string; end: string }> = {
    'DARK RED': { start: '#5e0d0d', mid: '#8a1313', end: '#b91c1c' },
    'DARK PINK': { start: '#5d0e34', mid: '#831843', end: '#be185d' },
    'DARK BLUE': { start: '#111d4a', mid: '#1e3a8a', end: '#2563eb' },
    'DARK GREEN': { start: '#09361a', mid: '#14532d', end: '#15803d' },
    'DARK PURPLE': { start: '#380c59', mid: '#581c87', end: '#7e22ce' },
  };

  // Dots along perimeter for realistic casino light effect
  const numDots = 30;
  const dots = Array.from({ length: numDots }).map((_, i) => {
    const angle = (i * 360) / numDots;
    const pos = polarToCartesian(center, center, radius + 8, angle);
    return { id: i, ...pos, angle };
  });

  const activeSpinning = isSpinning ?? (round?.status === 'SPINNING');

  return (
    <div className="relative flex items-center justify-center select-none w-full max-w-[340px] aspect-square mx-auto my-1">
      {/* Sound Toggle Button */}
      <button
        id="wheel-sound-toggle-btn"
        type="button"
        onClick={() => setSoundEnabled(!soundEnabled)}
        className="absolute -top-1 right-1 z-30 p-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-400 hover:text-amber-300 transition-colors shadow-md backdrop-blur-xs focus:outline-none"
        title={soundEnabled ? 'Mute wheel sound' : 'Enable wheel sound'}
        aria-label="Toggle wheel sound"
      >
        {soundEnabled ? (
          <Volume2 className="w-3.5 h-3.5" />
        ) : (
          <VolumeX className="w-3.5 h-3.5 text-slate-500" />
        )}
      </button>

      {/* Outer ambient glow based on celebration or active state */}
      <div
        className={`absolute -inset-2 rounded-full transition-all duration-700 blur-xl opacity-60 ${
          celebrationColor
            ? 'bg-amber-400/40 scale-105'
            : activeSpinning
            ? 'bg-indigo-500/30'
            : 'bg-amber-500/20'
        }`}
      />

      {/* Radiant Victory Result Reveal Flash Halo */}
      {showResultFlash && (
        <div className="absolute -inset-6 rounded-full pointer-events-none z-30 bg-gradient-to-r from-amber-300 via-white to-amber-200 blur-2xl opacity-95 animate-pulse transition-opacity duration-700" />
      )}

      {/* Outer casing ring with metallic bezel */}
      <div className="relative w-full h-full rounded-full p-2 bg-gradient-to-b from-amber-600 via-slate-800 to-amber-900 shadow-[0_10px_35px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.3)] flex items-center justify-center">
        {/* Sub-rim with dark slate groove */}
        <div className="relative w-full h-full rounded-full p-1.5 bg-gradient-to-br from-slate-900 to-slate-950 shadow-inner flex items-center justify-center overflow-hidden">
          
          {/* Intense Radial Flash Flare Overlay on Result Reveal */}
          {showResultFlash && (
            <div className="absolute inset-0 rounded-full z-30 pointer-events-none bg-gradient-to-tr from-white via-amber-200 to-white opacity-90 mix-blend-screen animate-pulse transition-opacity duration-700" />
          )}
          
          {/* HARDWARE-ACCELERATED ROTATING WHEEL SVG */}
          <div
            id="spin-wheel-rotor"
            ref={rotorRef}
            className="w-full h-full relative"
            style={{
              willChange: 'transform',
              transform: `translate3d(0, 0, 0) rotate(${currentAngleRef.current}deg)`,
              transformOrigin: '50% 50%',
              backfaceVisibility: 'hidden',
            }}
          >
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="w-full h-full filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
            >
              <defs>
                {WHEEL_SLICES.map((slice) => {
                  const g = sliceGradients[slice.name];
                  return (
                    <linearGradient
                      key={`grad-${slice.name}`}
                      id={`grad-${slice.name.replace(/\s+/g, '-')}`}
                      x1="0%"
                      y1="100%"
                      x2="0%"
                      y2="0%"
                    >
                      <stop offset="0%" stopColor={g.start} />
                      <stop offset="50%" stopColor={g.mid} />
                      <stop offset="100%" stopColor={g.end} />
                    </linearGradient>
                  );
                })}

                {/* Gold rim gradient */}
                <radialGradient id="hub-gold" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="35%" stopColor="#eab308" />
                  <stop offset="75%" stopColor="#a16207" />
                  <stop offset="100%" stopColor="#713f12" />
                </radialGradient>

                <linearGradient id="bezel-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="50%" stopColor="#b45309" />
                  <stop offset="100%" stopColor="#78350f" />
                </linearGradient>
              </defs>

              {/* Wheel Outer Edge Ring */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="#0f172a"
                stroke="url(#bezel-ring)"
                strokeWidth="3"
              />

              {/* Slices */}
              {WHEEL_SLICES.map((slice) => {
                const pathD = describeArc(
                  center,
                  center,
                  radius - 2,
                  innerRadius,
                  slice.startAngle,
                  slice.endAngle
                );

                const midAngle = (slice.startAngle + slice.endAngle) / 2;
                const textPos = polarToCartesian(center, center, (radius + innerRadius) / 2 + 10, midAngle);
                const isWinning = winningColor === slice.name;

                return (
                  <g key={slice.name} className="slice-group">
                    <path
                      d={pathD}
                      fill={`url(#grad-${slice.name.replace(/\s+/g, '-')})`}
                      stroke="#1e293b"
                      strokeWidth="2"
                      className="transition-colors duration-300"
                    />

                    {/* Slice Border Accent */}
                    <path
                      d={describeArc(center, center, radius - 2, radius - 7, slice.startAngle, slice.endAngle)}
                      fill={slice.borderColor}
                      opacity={isWinning ? 1 : 0.65}
                    />

                    {/* Slice Label & Color Icon */}
                    <g
                      transform={`translate(${textPos.x}, ${textPos.y}) rotate(${midAngle + 90})`}
                      className="pointer-events-none"
                    >
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#ffffff"
                        fontSize="11"
                        fontWeight="700"
                        letterSpacing="0.08em"
                        className="font-sans drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                      >
                        {slice.label}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Segment Divider Spoke Lines */}
              {WHEEL_SLICES.map((slice) => {
                const lineStart = polarToCartesian(center, center, innerRadius, slice.startAngle);
                const lineEnd = polarToCartesian(center, center, radius - 2, slice.startAngle);
                return (
                  <line
                    key={`div-${slice.name}`}
                    x1={lineStart.x}
                    y1={lineStart.y}
                    x2={lineEnd.x}
                    y2={lineEnd.y}
                    stroke="#facc15"
                    strokeWidth="1.5"
                    opacity="0.7"
                  />
                );
              })}

              {/* Decorative Perimeter Studs */}
              {dots.map((d) => (
                <circle
                  key={d.id}
                  cx={d.x}
                  cy={d.y}
                  r="2.5"
                  fill="#fef08a"
                  stroke="#854d0e"
                  strokeWidth="0.8"
                  opacity={activeSpinning && d.id % 2 === 0 ? '0.4' : '0.9'}
                />
              ))}

              {/* Center Hub */}
              <circle
                cx={center}
                cy={center}
                r={innerRadius + 4}
                fill="#0b0f19"
                stroke="url(#bezel-ring)"
                strokeWidth="3"
                className="filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              />
              <circle cx={center} cy={center} r={innerRadius} fill="url(#hub-gold)" />
              <circle cx={center} cy={center} r={innerRadius - 6} fill="#090d16" stroke="#ca8a04" strokeWidth="1.5" />
              
              {/* Embossed Center Star / Coin Emblem */}
              <path
                d={`M ${center} ${center - 14} L ${center + 4} ${center - 4} L ${center + 14} ${center} L ${center + 4} ${center + 4} L ${center} ${center + 14} L ${center - 4} ${center + 4} L ${center - 14} ${center} L ${center - 4} ${center - 4} Z`}
                fill="url(#hub-gold)"
              />
              <circle cx={center} cy={center} r="3" fill="#090d16" />
            </svg>
          </div>
        </div>
      </div>

      {/* DYNAMIC TOP POINTER (12 o'clock with tactile flapper deflection physics) */}
      <div
        ref={pointerRef}
        className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] pointer-events-none"
        style={{
          transformOrigin: '50% 10px',
          willChange: 'transform',
        }}
      >
        {/* Pointer Pin Head */}
        <div className="w-5 h-5 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 border-2 border-amber-100 shadow-[0_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
        </div>
        {/* Golden Triangular Needle pointing down */}
        <div
          className="w-0 h-0 -mt-1"
          style={{
            borderLeft: '11px solid transparent',
            borderRight: '11px solid transparent',
            borderTop: '24px solid #facc15',
            filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.6))',
          }}
        />
      </div>
    </div>
  );
};
