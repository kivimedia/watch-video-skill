/**
 * Precision Zoom Callout scene for CutSense Revideo enhancement.
 *
 * Smoothly zooms into a specific region of the source video frame,
 * holds, then zooms back out. Used for screen recordings where text
 * needs to be readable.
 */
import { makeScene2D } from '@revideo/2d';
import { Img, Rect } from '@revideo/2d/lib/components';
import { all, waitFor } from '@revideo/core/lib/flow';
import { easeInOutCubic } from '@revideo/core/lib/tweening';
import { createRef } from '@revideo/core/lib/utils';
import { Video } from '@revideo/2d/lib/components';

export interface ZoomCalloutProps {
  /** Source video path */
  src: string;
  /** Start time in source (seconds) */
  startTime: number;
  /** Duration of the zoom sequence (seconds) */
  duration: number;
  /** Zoom target region (0-1 normalized coordinates) */
  zoomRegion?: { x: number; y: number; width: number; height: number };
  /** Max zoom level (default 1.8x) */
  maxZoom?: number;
}

export function createZoomCalloutScene(props: ZoomCalloutProps) {
  const {
    src,
    startTime,
    duration,
    zoomRegion = { x: 0.3, y: 0.2, width: 0.5, height: 0.6 },
    maxZoom = 1.8,
  } = props;

  return makeScene2D('zoom-callout', function* (view) {
    const videoRef = createRef<Video>();

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

    // Calculate zoom offset (center the zoom region)
    const targetX = -(zoomRegion.x + zoomRegion.width / 2 - 0.5) * view.width() * maxZoom;
    const targetY = -(zoomRegion.y + zoomRegion.height / 2 - 0.5) * view.height() * maxZoom;

    const zoomInDuration = duration * 0.2;
    const holdDuration = duration * 0.6;
    const zoomOutDuration = duration * 0.2;

    // Zoom in
    yield* all(
      videoRef().scale(maxZoom, zoomInDuration, easeInOutCubic),
      videoRef().position.x(targetX, zoomInDuration, easeInOutCubic),
      videoRef().position.y(targetY, zoomInDuration, easeInOutCubic),
    );

    // Hold at zoom
    yield* waitFor(holdDuration);

    // Zoom out
    yield* all(
      videoRef().scale(1, zoomOutDuration, easeInOutCubic),
      videoRef().position.x(0, zoomOutDuration, easeInOutCubic),
      videoRef().position.y(0, zoomOutDuration, easeInOutCubic),
    );
  });
}
