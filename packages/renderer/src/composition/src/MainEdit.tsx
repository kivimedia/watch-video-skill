import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { CutSenseTimeline } from '@cutsense/core';
import { ClipSequence } from './ClipSequence';
import { CaptionStandard } from './CaptionStandard';
import { CaptionJumbo } from './CaptionJumbo';

export const MainEdit: React.FC<CutSenseTimeline> = (props) => {
  const { clips, captions, titleCards } = props;

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {/* Video clips layer */}
      <ClipSequence clips={clips} />

      {/* Caption overlay layer */}
      {captions && captions.style === 'jumbo' ? (
        <CaptionJumbo config={captions} />
      ) : captions ? (
        <CaptionStandard config={captions} />
      ) : null}
    </AbsoluteFill>
  );
};
