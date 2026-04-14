/**
 * Animated Lower Third scene for CutSense Revideo enhancement.
 *
 * A label slides in from the left at the bottom of the screen,
 * holds for a few seconds, then slides out. Used to display
 * feature names or section labels during demo videos.
 */
import { makeScene2D } from '@revideo/2d';
import { Rect, Txt } from '@revideo/2d/lib/components';
import { all, waitFor } from '@revideo/core/lib/flow';
import { easeOutCubic, easeInCubic } from '@revideo/core/lib/tweening';
import { createRef } from '@revideo/core/lib/utils';

export interface LowerThirdProps {
  /** Label text */
  label: string;
  /** Optional sublabel */
  sublabel?: string;
  /** Duration in seconds (default 4) */
  duration?: number;
  /** Background color (default semi-transparent dark) */
  bgColor?: string;
  /** Text color */
  textColor?: string;
  /** Canvas width for positioning */
  canvasWidth?: number;
  /** Canvas height for positioning */
  canvasHeight?: number;
}

export function createLowerThirdScene(props: LowerThirdProps) {
  const {
    label,
    sublabel,
    duration = 4,
    bgColor = 'rgba(20, 20, 40, 0.85)',
    textColor = '#ffffff',
    canvasWidth = 1920,
    canvasHeight = 1080,
  } = props;

  return makeScene2D('lower-third', function* (view) {
    const containerRef = createRef<Rect>();
    const accentRef = createRef<Rect>();

    const barHeight = sublabel ? 90 : 60;
    const barY = canvasHeight / 2 - barHeight - 40; // near bottom

    // Container - starts off screen left
    view.add(
      <Rect
        ref={containerRef}
        x={-canvasWidth}
        y={barY}
        width={500}
        height={barHeight}
        fill={bgColor}
        radius={4}
        layout
        direction="column"
        padding={[12, 24]}
        gap={4}
      >
        {/* Accent bar on left */}
        <Rect
          ref={accentRef}
          width={4}
          height={barHeight - 8}
          fill="#3b82f6"
          radius={2}
          position={[-246, 0]}
        />
        <Txt
          text={label}
          fontSize={24}
          fontFamily="Segoe UI, sans-serif"
          fontWeight={600}
          fill={textColor}
        />
        {sublabel && (
          <Txt
            text={sublabel}
            fontSize={16}
            fontFamily="Segoe UI, sans-serif"
            fontWeight={300}
            fill="#cccccc"
          />
        )}
      </Rect>,
    );

    // Slide in from left
    yield* containerRef().position.x(-canvasWidth / 2 + 300, 0.4, easeOutCubic);

    // Hold
    yield* waitFor(duration - 0.8);

    // Slide out to left
    yield* containerRef().position.x(-canvasWidth, 0.4, easeInCubic);
  });
}
