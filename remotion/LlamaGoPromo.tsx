'use client';

import React from 'react';
import { LlamaGoVerticalPromoComposition } from './LlamaGoVerticalPromo';

export const LlamaGoPromoComposition: React.FC<{ enableAudio?: boolean }> = (props) => {
  return <LlamaGoVerticalPromoComposition {...props} />;
};
