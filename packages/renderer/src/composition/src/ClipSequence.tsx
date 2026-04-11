import React from 'react';
import { Sequence, AbsoluteFill, OffthreadVideo, interpolate, useCurrentFrame } from 'remotion';
import type { TimelineClip } from '@cutsense/core';

interface Props {
  clips: TimelineClip[];
}

export const ClipSequence: React.FC<Props> = ({ clips }) => {
  let offset = 0;

  return (
    <>
      {clips.map((clip, i) => {
        const from = offset;
        offset += clip.durationInFrames;

        const nextClip = clips[i + 1];
        const hasFade = clip.transition?.type === 'fade' && clip.transition.durationInFrames;
        const fadeDuration = hasFade ? clip.transition!.durationInFrames! : 0;

        return (
          <Sequence
            key={clip.id}
            from={from}
            durationInFrames={clip.durationInFrames}
            name={`Clip ${i + 1}`}
          >
            <FadeableClip
              src={clip.src}
              startFrom={clip.startFrom}
              volume={clip.volume ?? 1}
              playbackRate={clip.playbackRate}
              fadeDuration={fadeDuration}
              clipDuration={clip.durationInFrames}
            />
          </Sequence>
        );
      })}
    </>
  );
};

interface FadeableClipProps {
  src: string;
  startFrom: number;
  volume: number;
  playbackRate?: number;
  fadeDuration: number;
  clipDuration: number;
}

const FadeableClip: React.FC<FadeableClipProps> = ({
  src,
  startFrom,
  volume,
  playbackRate,
  fadeDuration,
  clipDuration,
}) => {
  const frame = useCurrentFrame();

  let opacity = 1;
  if (fadeDuration > 0) {
    const fadeIn = interpolate(frame, [0, fadeDuration], [0, 1], {
      extrapolateRight: 'clamp',
    });
    const fadeOut = interpolate(
      frame,
      [clipDuration - fadeDuration, clipDuration],
      [1, 0],
      { extrapolateLeft: 'clamp' },
    );
    opacity = Math.min(fadeIn, fadeOut);
  }

  return (
    <AbsoluteFill style={{ opacity }}>
      <OffthreadVideo
        src={src}
        startFrom={startFrom}
        volume={volume}
        playbackRate={playbackRate}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </AbsoluteFill>
  );
};
