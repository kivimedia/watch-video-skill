import React from 'react';
import { Sequence, AbsoluteFill, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import type { CaptionConfig } from '@cutsense/core';

interface Props {
  config: CaptionConfig;
}

export const CaptionJumbo: React.FC<Props> = ({ config }) => {
  const { track, direction } = config;

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
}

const JumboWord: React.FC<JumboWordProps> = ({ text, direction, highlight }) => {
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

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
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
