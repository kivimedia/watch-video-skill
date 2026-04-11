import React from 'react';

interface RTLCaptionProps {
  text: string;
  direction?: 'ltr' | 'rtl';
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const RTLCaption: React.FC<RTLCaptionProps> = ({ text, direction = 'ltr', style, children }) => {
  return (
    <span
      dir={direction}
      style={{
        unicodeBidi: 'embed',
        direction,
        ...style,
      }}
    >
      {children ?? text}
    </span>
  );
};
