// Video Template - Replace ReplitLoadingScene with your scenes

import { useEffect, useRef, type ComponentType } from 'react';
import { AnimatePresence } from 'framer-motion';

import {
  VideoCanvas,
  VideoPausedContext,
  type VideoAspectRatio,
  useVideoPlayer,
} from '@/lib/video';

import { Scene01Hook } from './video_scenes/Scene01Hook';
import { Scene02Price } from './video_scenes/Scene02Price';
import { Scene03OpenInterest } from './video_scenes/Scene03OpenInterest';
import { Scene04Comparisons } from './video_scenes/Scene04Comparisons';
import { Scene05Hypothetical } from './video_scenes/Scene05Hypothetical';
import { Scene06Risk } from './video_scenes/Scene06Risk';
import './video_scenes/film.css';

export const SCENE_DURATIONS = {
  hook: 3600,
  price: 4800,
  openInterest: 5200,
  comparisons: 4800,
  hypothetical: 5800,
  risk: 5800,
};

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '9:16';
const SCENE_COMPONENTS: Record<string, ComponentType> = {
  hook: Scene01Hook,
  price: Scene02Price,
  openInterest: Scene03OpenInterest,
  comparisons: Scene04Comparisons,
  hypothetical: Scene05Hypothetical,
  risk: Scene06Risk,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, ms] of Object.entries(SCENE_DURATIONS)) {
    out[key] = cumulativeMs / 1000;
    cumulativeMs += ms;
  }
  return out;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  paused = false,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  paused?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSceneKeyRef = useRef<string | null>(null);

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 1;
    if (paused) {
      audio.pause();
      return;
    }
    if (lastSceneKeyRef.current !== currentSceneKey) {
      lastSceneKeyRef.current = currentSceneKey;
      const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
      if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
        audio.currentTime = targetTime;
      }
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted, paused]);

  return (
    <VideoPausedContext.Provider value={paused}>
      <VideoCanvas
        aspectRatio={VIDEO_ASPECT_RATIO}
        className="market-film"
        style={{ backgroundColor: '#080c0b' }}
      >
        <div className="film-grain" aria-hidden="true" />
        <AnimatePresence mode="sync">
          {SceneComponent && (
            <SceneComponent key={currentSceneKey} />
          )}
        </AnimatePresence>
        <audio
          ref={audioRef}
          src={`${import.meta.env.BASE_URL}audio/composite_audio.mp3`}
          preload="auto"
          autoPlay
          muted={muted}
        />
      </VideoCanvas>
    </VideoPausedContext.Provider>
  );
}
