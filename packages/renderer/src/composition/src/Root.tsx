import React from 'react';
import { Composition } from 'remotion';
import { MainEdit } from './MainEdit.js';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MainEdit"
      component={MainEdit as unknown as React.FC<Record<string, unknown>>}
      durationInFrames={1}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        version: '1.0' as const,
        jobId: 'preview',
        fps: 30,
        durationInFrames: 1,
        width: 1920,
        height: 1080,
        clips: [],
      }}
      calculateMetadata={async ({ props }: { props: Record<string, unknown> }) => ({
        durationInFrames: (props.durationInFrames as number) || 1,
        fps: (props.fps as number) || 30,
        width: (props.width as number) || 1920,
        height: (props.height as number) || 1080,
      })}
    />
  );
};
