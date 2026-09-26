import { useEffect, useRef, type ComponentType } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  VideoCanvas,
  VideoPausedContext,
  type VideoAspectRatio,
  useVideoPlayer,
} from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS = {
  hook: 5000,
  asset: 5000,
  network: 6000,
  access: 5000,
  takeaway: 7000,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const starts: Record<string, number> = {};
  let elapsedMs = 0;
  for (const [key, durationMs] of Object.entries(SCENE_DURATIONS)) {
    starts[key] = elapsedMs / 1000;
    elapsedMs += durationMs;
  }
  return starts;
})();

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '9:16';
const AUDIO_SEEK_EPSILON_SEC = 0.18;

const SCENE_COMPONENTS: Record<string, ComponentType> = {
  hook: Scene1,
  asset: Scene2,
  network: Scene3,
  access: Scene4,
  takeaway: Scene5,
};

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
  const { currentSceneKey } = useVideoPlayer({
    durations,
    loop,
    paused,
  });
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
    audio.volume = 0.45;
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
      <>
        <VideoCanvas
          aspectRatio={VIDEO_ASPECT_RATIO}
          style={{ backgroundColor: 'var(--color-bg-dark)' }}
        >
          <AnimatePresence mode="sync">
            {SceneComponent && (
              <SceneComponent key={currentSceneKey} />
            )}
          </AnimatePresence>
        </VideoCanvas>
        <audio
          ref={audioRef}
          src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
          preload="auto"
          autoPlay
          muted={muted}
          className="hidden"
          aria-hidden="true"
        />
      </>
    </VideoPausedContext.Provider>
  );
}
