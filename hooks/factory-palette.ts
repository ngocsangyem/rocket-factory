import type { ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'

/**
 * App colors for the factory: near-black control-room grays with phosphor amber as the accent.
 * Dark only, since the scene is a night shift; roles keep their meaning (red fails, green passes).
 */
export const palette = makeColors({
  label: 'Rocket Factory',
  // The host takes ids of ASCII letters, digits, _ and - only; set it explicitly rather than let one be derived from the label.
  id: 'rocket-factory',
  only: 'dark',
  roles: { accent: '#ffb547', danger: '#ff6250', success: '#8fbf7a', warning: '#e0a040', pro: '#a993d6' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0c0c0c',
        'surface-1': '#141413',
        'surface-2': '#1a1a18',
        'surface-3': '#20201e',
        'text-primary': '#ececea',
        'text-secondary': '#c4c2bc',
        'text-muted': '#9a978f',
      },
    },
  },
})

// No overrideColorScheme: this build refuses the attribute, and colors with a dark mode alone already mean dark.
export const LOOK: ThemeSetArgs = {
  colors: palette.theme,
  backdrop: { scene: 'factory', glass: { blur: 10, tint: '#111111', opacity: 0.55 } },
}

/** The line that would make Desktop ignore the whole palette, if any. */
export const unpaintedLine = palette.problems.find(line => line.startsWith("Desktop won't paint"))
