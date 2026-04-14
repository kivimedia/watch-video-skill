/**
 * Animated Title Card scene for CutSense Revideo enhancement.
 *
 * Spring-physics text animation: title slides in from left,
 * subtitle fades up 0.3s later. Dark background with clean typography.
 */
import { makeScene2D } from '@revideo/2d';
import { Txt, Rect } from '@revideo/2d/lib/components';
import { all, waitFor } from '@revideo/core/lib/flow';
import { easeOutCubic, easeInOutCubic } from '@revideo/core/lib/tweening';
import { createRef } from '@revideo/core/lib/utils';

export interface TitleCardProps {
  title: string;
  subtitle: string;
  duration?: number; // seconds, default 3
  bgColor?: string;
  titleColor?: string;
  subtitleColor?: string;
}

export function createTitleCardScene(props: TitleCardProps) {
  const {
    title,
    subtitle,
    duration = 3,
    bgColor = '#1a1a2e',
    titleColor = '#ffffff',
    subtitleColor = '#aaaaaa',
  } = props;

  return makeScene2D('title-card', function* (view) {
    const titleRef = createRef<Txt>();
    const subtitleRef = createRef<Txt>();

    // Dark background
    view.add(
      <Rect width="100%" height="100%" fill={bgColor} />,
    );

    // Title - starts off-screen left
    view.add(
      <Txt
        ref={titleRef}
        text={title}
        fontSize={56}
        fontFamily="Segoe UI, sans-serif"
        fontWeight={600}
        fill={titleColor}
        x={-800}
        y={-30}
        opacity={0}
      />,
    );

    // Subtitle - starts invisible
    view.add(
      <Txt
        ref={subtitleRef}
        text={subtitle}
        fontSize={32}
        fontFamily="Segoe UI, sans-serif"
        fontWeight={300}
        fill={subtitleColor}
        y={40}
        opacity={0}
      />,
    );

    // Animate title sliding in from left with spring-like easing
    yield* all(
      titleRef().position.x(0, 0.6, easeOutCubic),
      titleRef().opacity(1, 0.4, easeOutCubic),
    );

    // Subtitle fades in 0.3s after title
    yield* waitFor(0.1);
    yield* subtitleRef().opacity(1, 0.5, easeInOutCubic);

    // Hold
    yield* waitFor(duration - 1.5);

    // Fade out both
    yield* all(
      titleRef().opacity(0, 0.3),
      subtitleRef().opacity(0, 0.3),
    );
  });
}
