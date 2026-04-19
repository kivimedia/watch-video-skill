import React from 'react';
import { Sequence, AbsoluteFill, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import type { CaptionConfig } from '@cutsense/core';

interface Props {
  config: CaptionConfig;
}

export const CaptionJumbo: React.FC<Props> = ({ config }) => {
  const { track, direction, position } = config;
  // Default to 'bottom' (lower third) rather than 'center' - centered
  // word-by-word captions consistently occlude the speaker's face in
  // 9:16 talking-head recordings. Callers can override with 'top' or
  // 'center' explicitly if the framing is unusual.
  const effectivePosition = position ?? 'bottom';

  return (
    <>
      {track.map((chunk, i) => (
        <Sequence
          key={i}
          from={chunk.startFrame}
          durationInFrames={chunk.endFrame - chunk.startFrame}
          layout="none"
        >
          <JumboWord
            text={chunk.text}
            direction={chunk.direction ?? direction}
            highlight={chunk.highlight}
            position={effectivePosition}
          />
        </Sequence>
      ))}
    </>
  );
};

interface JumboWordProps {
  text: string;
  direction: 'ltr' | 'rtl';
  highlight?: boolean;
  position: 'top' | 'center' | 'bottom';
}

const JumboWord: React.FC<JumboWordProps> = ({ text, direction, highlight, position }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { mass: 0.5, stiffness: 200, damping: 15 },
    from: 0.6,
    to: 1,
  });

  const opacity = spring({
    frame,
    fps,
    config: { mass: 0.3, stiffness: 300, damping: 20 },
  });

  // AbsoluteFill is a column flex container, so justifyContent controls
  // the vertical axis. alignItems: 'center' keeps words horizontally centered.
  const justifyContent =
    position === 'top' ? 'flex-start' :
    position === 'bottom' ? 'flex-end' :
    'center';
  const paddingTop = position === 'top' ? '15%' : 0;
  const paddingBottom = position === 'bottom' ? '15%' : 0;

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent,
        paddingTop,
        paddingBottom,
      }}
    >
      <div
        style={{
          direction,
          unicodeBidi: 'embed',
          fontSize: 96,
          fontFamily: 'Arial Black, Impact, sans-serif',
          fontWeight: 900,
          color: highlight ? '#FFD700' : '#FFFFFF',
          textShadow: '0 4px 12px rgba(0, 0, 0, 0.8), 0 2px 4px rgba(0, 0, 0, 0.6)',
          transform: `scale(${scale})`,
          opacity,
          textTransform: 'uppercase',
          letterSpacing: 2,
          textAlign: 'center',
          maxWidth: '90%',
          WebkitTextStroke: '2px rgba(0, 0, 0, 0.3)',
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
