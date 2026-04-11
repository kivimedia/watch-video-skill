import React from 'react';
import { Composition } from 'remotion';
import { MainEdit } from './MainEdit.js';
import type { CutSenseTimeline } from '@cutsense/core';

const defaultTimeline: CutSenseTimeline = {
  version: '1.0',
  jobId: 'preview',
  fps: 30,
  durationInFrames: 1,
  width: 1920,
  height: 1080,
  clips: [],
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MainEdit"
      component={MainEdit}
      durationInFrames={1}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={defaultTimeline}
      calculateMetadata={async ({ props }) => ({
        durationInFrames: props.durationInFrames || 1,
        fps: props.fps || 30,
        width: props.width || 1920,
        height: props.height || 1080,
      })}
    />
  );
};
