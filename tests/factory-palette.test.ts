import { expect, test } from 'claude-code/testing'

import { checkColors } from '../hooks/make-colors.js'
import { LOOK, palette, unpaintedLine } from '../hooks/factory-palette'

test('Desktop paints the palette: no blocking contrast line', async () => {
  expect(unpaintedLine).toBe(undefined)
})

test('every color key is a design-system name', async () => {
  // Contrast notes under the design system's own bar still paint; anything else means a key draws nothing.
  const notContrast = checkColors(LOOK.colors).filter(line => !/ is [\d.]+:1 /.test(line))
  expect(notContrast).toEqual([])
})

test('the look names the backdrop scene the render hook draws', async () => {
  expect(LOOK.backdrop && 'scene' in LOOK.backdrop ? LOOK.backdrop.scene : null).toBe('factory')
  expect(palette.problems.every(line => typeof line === 'string')).toBe(true)
})
