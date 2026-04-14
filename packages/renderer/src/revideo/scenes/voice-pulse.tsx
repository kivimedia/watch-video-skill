/**
 * Voice Pulse Highlight scene for CutSense Revideo enhancement.
 *
 * Adds a subtle glowing pulse animation around a specified region
 * (typically a voice message bubble in a chat interface).
 * Draws attention to the voice input being sent.
 */
import { makeScene2D } from '@revideo/2d';
import { Rect, Circle, Video } from '@revideo/2d/lib/components';
import { all, loop, waitFor } from '@revideo/core/lib/flow';
import { easeInOutSine } from '@revideo/core/lib/tweening';
import { createRef } from '@revideo/core/lib/utils';

export interface VoicePulseProps {
  src: string;
  startTime: number;
  duration: number;
  /** Center of pulse region (normalized 0-1) */
  pulseX?: number;
  pulseY?: number;
  /** Pulse ring size (pixels) */
  ringSize?: number;
  /** Pulse color */
  color?: string;
}

export function createVoicePulseScene(props: VoicePulseProps) {
  const {
    src,
    startTime,
    duration,
    pulseX = 0.35,
    pulseY = 0.7,
    ringSize = 120,
    color = '#4ade80', // green to match Telegram voice bubbles
  } = props;

  return makeScene2D('voice-pulse', function* (view) {
    const videoRef = createRef<Video>();
    const ring1Ref = createRef<Circle>();
    const ring2Ref = createRef<Circle>();

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

    const cx = (pulseX - 0.5) * view.width();
    const cy = (pulseY - 0.5) * view.height();

    // Pulse rings
    view.add(
      <Circle
        ref={ring1Ref}
        x={cx}
        y={cy}
        width={ringSize}
        height={ringSize}
        stroke={color}
        lineWidth={3}
        opacity={0}
      />,
    );

    view.add(
      <Circle
        ref={ring2Ref}
        x={cx}
        y={cy}
        width={ringSize * 0.7}
        height={ringSize * 0.7}
        stroke={color}
        lineWidth={2}
        opacity={0}
      />,
    );

    const pulseCount = Math.floor(duration / 0.8);

    for (let i = 0; i < pulseCount; i++) {
      // Expand and fade ring 1
      ring1Ref().scale(0.8);
      ring1Ref().opacity(0.6);
      yield* all(
        ring1Ref().scale(1.5, 0.6, easeInOutSine),
        ring1Ref().opacity(0, 0.6),
      );

      // Slight delay, then ring 2
      ring2Ref().scale(0.8);
      ring2Ref().opacity(0.4);
      yield* all(
        ring2Ref().scale(1.3, 0.5, easeInOutSine),
        ring2Ref().opacity(0, 0.5),
      );

      yield* waitFor(0.1);
    }
  });
}
