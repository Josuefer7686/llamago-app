'use client';

import React from 'react';
// @ts-ignore
import { Composition } from 'remotion';
import { LlamaGoVerticalPromoComposition } from './LlamaGoVerticalPromo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LlamaGoVerticalPromo"
        component={LlamaGoVerticalPromoComposition}
        durationInFrames={1800} // 60 seconds @ 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          enableAudio: true,
        }}
      />
    </>
  );
};
