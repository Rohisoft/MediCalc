import { useWindowDimensions } from 'react-native';

// Keep in sync with the @media (min-width: 1024px) breakpoint in public/index.html —
// that CSS gates the phone-frame shell, this hook gates the React-side chrome
// (sidebar vs bottom tabs, dialogs vs bottom sheets). They can't share one
// source of truth across a static HTML file and JS, so both must be updated
// together if this ever changes.
export const BREAKPOINTS = { tablet: 768, desktop: 1024 };

// useWindowDimensions (not Dimensions.get, which is a one-time snapshot) so
// this reacts live if a browser window is resized across the breakpoint.
export function useIsDesktop() {
  const { width } = useWindowDimensions();
  return width >= BREAKPOINTS.desktop;
}
