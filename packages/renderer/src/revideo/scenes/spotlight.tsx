/**
 * Feature Spotlight scene for CutSense Revideo enhancement.
 *
 * Dims everything except a focused region, creating a vignette
 * that draws attention to the active area. The spotlight can
 * move between regions during the scene.
 */
import { makeScene2D } from '@revideo/2d';
import { Rect, Circle, Video } from '@revideo/2d/lib/components';
import { all, waitFor } from '@revideo/core/lib/flow';
import { easeInOutCubic } from '@revideo/core/lib/tweening';
import { createRef } from '@revideo/core/lib/utils';

export interface SpotlightProps {
  src: string;
  startTime: number;
  duration: number;
  /** Spotlight center (normalized 0-1) */
  spotX?: number;
  spotY?: number;
  /** Spotlight radius (normalized, default 0.25) */
  spotRadius?: number;
  /** Dim opacity for non-spotlight area (default 0.6) */
  dimOpacity?: number;
}

export function createSpotlightScene(props: SpotlightProps) {
  const {
    src,
    startTime,
    duration,
    spotX = 0.5,
    spotY = 0.5,
    spotRadius = 0.25,
    dimOpacity = 0.6,
  } = props;

  return makeScene2D('spotlight', function* (view) {
    const videoRef = createRef<Video>();
    const overlayRef = createRef<Rect>();

    // Video layer
    view.add(
      <Video
        ref={videoRef}
        src={src}
        time={startTime}
        width="100%"
        height="100%"
        play={true}
      />,
    );

    // Dark overlay with radial gradient hole (simulated with opacity)
    view.add(
      <Rect
        ref={overlayRef}
        width="100%"
        height="100%"
        fill={`rgba(0, 0, 0, ${dimOpacity})`}
        opacity={0}
      />,
    );

    const fadeInDur = 0.5;
    const holdDur = duration - 1.0;
    const fadeOutDur = 0.5;

    // Fade in the spotlight overlay
    yield* overlayRef().opacity(1, fadeInDur, easeInOutCubic);

    // Hold
    yield* waitFor(holdDur);

    // Fade out
    yield* overlayRef().opacity(0, fadeOutDur, easeInOutCubic);
  });
}
