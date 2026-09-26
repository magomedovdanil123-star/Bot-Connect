import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const SCENE_DETAILS: Record<string, { title: string; filePath: string }> = {
  hook: {
    title: 'Что такое криптовалюта',
    filePath: 'src/components/video/video_scenes/Scene1.tsx',
  },
  asset: {
    title: 'Цифровая запись',
    filePath: 'src/components/video/video_scenes/Scene2.tsx',
  },
  network: {
    title: 'Сеть и блокчейн',
    filePath: 'src/components/video/video_scenes/Scene3.tsx',
  },
  access: {
    title: 'Ключ и доступ',
    filePath: 'src/components/video/video_scenes/Scene4.tsx',
  },
  takeaway: {
    title: 'Итог и риск',
    filePath: 'src/components/video/video_scenes/Scene5.tsx',
  },
};

function announceSceneSelection(index: number, sceneKeys: string[]) {
  const key = sceneKeys[index];
  const details = SCENE_DETAILS[key];
  if (!details?.filePath) return;
  window.parent.postMessage(
    {
      type: 'REPLIT_VIDEO_SCENE_SELECTED',
      payload: {
        sceneIndex: index,
        sceneCount: sceneKeys.length,
        sceneTitle: details.title || key,
        filePath: details.filePath,
        lineNumber: 1,
      },
    },
    '*',
  );
}

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;
  const sensorRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tapPinned, setTapPinned] = useState(false);
  const [muted, setMuted] = useState(false);

  const {
    sceneKeys,
    activeIndex,
    locked,
    paused,
    mountKey,
    tick,
    durations,
    activeDuration,
    activeStartTime,
    totalDuration,
    onSceneChange,
    jumpTo,
    toggleLock,
    togglePause,
  } = useSceneControls(SCENE_DURATIONS);

  const handleJumpTo = useCallback((index: number) => {
    jumpTo(index);
    announceSceneSelection(index, sceneKeys);
  }, [jumpTo, sceneKeys]);

  const handlePointerEnter = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(true);
  }, []);
  const handlePointerLeave = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(false);
  }, []);
  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' && collapsed) setTapPinned(true);
  }, [collapsed]);
  const handleToggleCollapsed = useCallback(() => {
    setCollapsed((current) => !current);
    setHovering(false);
    setTapPinned(false);
  }, []);

  useEffect(() => {
    if (!(collapsed && tapPinned)) return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return;
      const sensor = sensorRef.current;
      if (sensor && !sensor.contains(event.target as Node)) setTapPinned(false);
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [collapsed, tapPinned]);

  useEffect(() => {
    if (!paused) return;
    const running = document
      .getAnimations()
      .filter((animation) => animation.playState === 'running');
    running.forEach((animation) => animation.pause());
    return () => running.forEach((animation) => animation.play());
  }, [paused]);

  if (!isIframed) return <VideoTemplate />;

  const barVisible = !collapsed || hovering || tapPinned;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      <VideoTemplate
        key={mountKey}
        durations={durations}
        loop
        paused={paused}
        muted={muted}
        onSceneChange={onSceneChange}
      />
      <div
        ref={sensorRef}
        className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end"
        style={{ height: '25%' }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
      >
        <div className="w-full flex-1" aria-hidden="true" />
        <ControlBar
          visible={barVisible}
          collapsed={collapsed}
          locked={locked}
          paused={paused}
          muted={muted}
          sceneKeys={sceneKeys}
          activeIndex={activeIndex}
          activeDuration={activeDuration}
          activeStartTime={activeStartTime}
          totalDuration={totalDuration}
          tick={tick}
          onTogglePause={togglePause}
          onToggleLock={toggleLock}
          onToggleMute={() => setMuted((current) => !current)}
          onJumpTo={handleJumpTo}
          onToggleCollapsed={handleToggleCollapsed}
        />
      </div>
    </div>
  );
}

interface ControlBarProps {
  visible: boolean;
  collapsed: boolean;
  locked: boolean;
  paused: boolean;
  muted: boolean;
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  activeStartTime: number;
  totalDuration: number;
  tick: number;
  onTogglePause: () => void;
  onToggleLock: () => void;
  onToggleMute: () => void;
  onJumpTo: (index: number) => void;
  onToggleCollapsed: () => void;
}

function ControlBar({
  visible,
  collapsed,
  locked,
  paused,
  muted,
  sceneKeys,
  activeIndex,
  activeDuration,
  activeStartTime,
  totalDuration,
  tick,
  onTogglePause,
  onToggleLock,
  onToggleMute,
  onJumpTo,
  onToggleCollapsed,
}: ControlBarProps) {
  const buttonClass =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:h-14 sm:w-14';

  return (
    <div
      className={`flex items-center gap-2 bg-black/70 px-3 py-2 backdrop-blur-md transition-all duration-200 ease-out sm:gap-3 sm:px-5 sm:py-4 ${
        visible
          ? 'pointer-events-auto translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-full opacity-0'
      }`}
      aria-hidden={!visible}
    >
      <button
        type="button"
        onClick={onTogglePause}
        className={buttonClass}
        title={paused ? 'Продолжить' : 'Пауза'}
        aria-label={paused ? 'Продолжить воспроизведение' : 'Приостановить воспроизведение'}
        tabIndex={visible ? 0 : -1}
      >
        <ControlIcon name={paused ? 'play' : 'pause'} className="h-5 w-5 sm:h-8 sm:w-8" />
      </button>
      <button
        type="button"
        onClick={onToggleLock}
        className={`${buttonClass} ${locked ? 'bg-white/15 text-white' : ''}`}
        title={locked ? 'Повтор сцены включён' : 'Повторять текущую сцену'}
        aria-label={locked ? 'Выключить повтор сцены' : 'Повторять текущую сцену'}
        aria-pressed={locked}
        tabIndex={visible ? 0 : -1}
      >
        <ControlIcon name="repeat" className="h-5 w-5 sm:h-8 sm:w-8" />
      </button>
      <button
        type="button"
        onClick={onToggleMute}
        className={`${buttonClass} ${muted ? 'text-white' : ''}`}
        title={muted ? 'Включить звук' : 'Выключить звук'}
        aria-label={muted ? 'Включить звук' : 'Выключить звук'}
        aria-pressed={muted}
        tabIndex={visible ? 0 : -1}
      >
        <ControlIcon name={muted ? 'volumeOff' : 'volumeOn'} className="h-5 w-5 sm:h-7 sm:w-7" />
      </button>

      <div className="h-7 w-px shrink-0 bg-white/20 sm:h-10" aria-hidden="true" />

      <PlaybackStatus
        visible={visible}
        sceneKeys={sceneKeys}
        activeIndex={activeIndex}
        activeDuration={activeDuration}
        activeStartTime={activeStartTime}
        totalDuration={totalDuration}
        tick={tick}
        paused={paused}
        onJumpTo={onJumpTo}
      />

      <button
        type="button"
        onClick={onToggleCollapsed}
        className={buttonClass}
        title={collapsed ? 'Показать управление' : 'Скрыть управление'}
        aria-label={collapsed ? 'Показать элементы управления' : 'Скрыть элементы управления'}
        aria-expanded={!collapsed}
        tabIndex={visible ? 0 : -1}
      >
        <ControlIcon name={collapsed ? 'chevronUp' : 'chevronDown'} className="h-6 w-6 sm:h-10 sm:w-10" />
      </button>
    </div>
  );
}

function PlaybackStatus({
  visible,
  sceneKeys,
  activeIndex,
  activeDuration,
  activeStartTime,
  totalDuration,
  tick,
  paused,
  onJumpTo,
}: {
  visible: boolean;
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  activeStartTime: number;
  totalDuration: number;
  tick: number;
  paused: boolean;
  onJumpTo: (index: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const elapsedBaseRef = useRef(0);

  useEffect(() => {
    setElapsed(0);
    elapsedBaseRef.current = 0;
  }, [tick]);

  useEffect(() => {
    if (paused) return;
    const start = performance.now();
    const intervalId = window.setInterval(() => {
      setElapsed(elapsedBaseRef.current + performance.now() - start);
    }, 60);
    return () => {
      window.clearInterval(intervalId);
      elapsedBaseRef.current += performance.now() - start;
    };
  }, [tick, paused]);

  const progress = activeDuration > 0 ? Math.min(1, elapsed / activeDuration) : 0;
  const totalElapsed = Math.min(
    totalDuration,
    activeStartTime + Math.min(elapsed, activeDuration),
  );

  return (
    <>
      <div className="flex min-w-6 flex-1 items-center gap-1">
        {sceneKeys.map((key, index) => (
          <button
            key={key}
            type="button"
            onClick={() => onJumpTo(index)}
            className="relative h-3 min-h-3 min-w-1 flex-1 cursor-pointer overflow-hidden rounded-full bg-white/20 transition-all hover:h-4 hover:bg-white/30"
            aria-label={`Перейти к сцене ${index + 1}`}
            aria-current={index === activeIndex ? 'true' : undefined}
            tabIndex={visible ? 0 : -1}
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-white/90 transition-[width] duration-100"
              style={{ width: `${index < activeIndex ? 100 : index === activeIndex ? progress * 100 : 0}%` }}
            />
          </button>
        ))}
      </div>
      <div className="shrink-0 text-[11px] tabular-nums text-white/70 sm:text-xl">
        {activeIndex + 1}/{sceneKeys.length}
      </div>
      <div
        className="min-w-[9ch] shrink-0 text-right font-mono text-[10px] tabular-nums text-white/80 sm:min-w-[11ch] sm:text-xl"
        role="timer"
        aria-label={`Время ${formatPlaybackTime(totalElapsed)} из ${formatPlaybackTime(totalDuration)}`}
      >
        {formatPlaybackTime(totalElapsed)} / {formatPlaybackTime(totalDuration)}
      </div>
    </>
  );
}

function ControlIcon({
  name,
  className,
}: {
  name: 'play' | 'pause' | 'repeat' | 'volumeOn' | 'volumeOff' | 'chevronUp' | 'chevronDown';
  className: string;
}) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  switch (name) {
    case 'play':
      return <svg {...common} fill="currentColor" stroke="none"><path d="M7 4.8v14.4L19 12 7 4.8Z" /></svg>;
    case 'pause':
      return <svg {...common}><path d="M8 5v14M16 5v14" strokeWidth="3" /></svg>;
    case 'repeat':
      return <svg {...common}><path d="m17 2 4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></svg>;
    case 'volumeOn':
      return <svg {...common}><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>;
    case 'volumeOff':
      return <svg {...common}><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="m16 9 5 6m0-6-5 6" /></svg>;
    case 'chevronUp':
      return <svg {...common}><path d="m6 14 6-6 6 6" /></svg>;
    case 'chevronDown':
      return <svg {...common}><path d="m6 10 6 6 6-6" /></svg>;
  }
  return null;
}

function formatPlaybackTime(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}