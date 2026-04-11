import React from 'react';
import { Sequence, AbsoluteFill } from 'remotion';
import type { CaptionConfig } from '@cutsense/core';

interface Props {
  config: CaptionConfig;
}

export const CaptionStandard: React.FC<Props> = ({ config }) => {
  const { track, direction, fontSize = 36, fontFamily = 'Arial, sans-serif', color = '#FFFFFF', backgroundColor = 'rgba(0, 0, 0, 0.7)' } = config;

  const position = config.position ?? 'bottom';
  const alignItems = position === 'top' ? 'flex-start' : position === 'center' ? 'center' : 'flex-end';
  const paddingValue = position === 'center' ? 0 : 60;

  return (
    <>
      {track.map((chunk, i) => (
        <Sequence
          key={i}
          from={chunk.startFrame}
          durationInFrames={chunk.endFrame - chunk.startFrame}
          layout="none"
        >
          <AbsoluteFill
            style={{
              alignItems,
              justifyContent: 'center',
              paddingBottom: position === 'bottom' ? paddingValue : 0,
              paddingTop: position === 'top' ? paddingValue : 0,
            }}
          >
            <div
              style={{
                direction: chunk.direction ?? direction,
                unicodeBidi: 'embed',
                fontSize,
                fontFamily,
                color,
                backgroundColor,
                padding: '8px 20px',
                borderRadius: 6,
                textAlign: 'center',
                maxWidth: '80%',
                lineHeight: 1.4,
              }}
            >
              {chunk.text}
            </div>
          </AbsoluteFill>
        </Sequence>
      ))}
    </>
  );
};
