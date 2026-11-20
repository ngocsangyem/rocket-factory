import { expect, test } from 'claude-code/testing'

import { initialFactoryState } from '../hooks/factory-state-machine'
import { hudLabel, shipCode, shipName, statusLine } from '../hooks/factory-display-copy'

test('ship names cycle with a round number, and ship 100 still reads well', async () => {
  expect(shipName(1)).toBe('Morning Star')
  expect(shipName(7)).toBe('Orion')
  expect(shipName(8)).toBe('Morning Star 2')
  expect(shipName(100)).toBe('Evening Star 15')
  expect(shipCode(100)).toBe('SHIP-100')
})

test('the chip shows trouble first, then the gate, then a failure, then work', async () => {
  const s = { ...initialFactoryState(), active: { weld: 1 }, failing: { station: 'weld' as const, label: 'FAILED' as const, until: 9e12 } }
  expect(hudLabel(s, 0).text).toBe('FAILED')
  expect(hudLabel({ ...s, gate: { tool: 'Bash' } }, 0).text).toBe('AWAITING APPROVAL')
  expect(hudLabel({ ...s, trouble: { kind: 'fuel', code: 'rate_limit', until: 9e12 } }, 0)).toEqual({ text: 'OUT OF FUEL', tone: 'warn' })
  expect(hudLabel({ ...s, failing: null }, 0).text).toBe('WELDING')
  expect(statusLine(initialFactoryState(), 0)).toContain('mode on')
})
