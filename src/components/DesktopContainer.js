import React from 'react';
import { View } from 'react-native';
import { useIsDesktop } from '../utils/responsive';

// Phone: pass-through, zero visual change. Desktop: caps content to a
// readable width and centers it, so the existing %-based flexWrap grids
// (stat cards, etc.) get room to breathe instead of stretching edge-to-edge
// on a wide monitor.
export default function DesktopContainer({ children, maxWidth = 1200, style }) {
  const isDesktop = useIsDesktop();
  if (!isDesktop) return children;

  return (
    <View style={[{ width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: 32 }, style]}>
      {children}
    </View>
  );
}
