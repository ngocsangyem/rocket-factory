// Bundles the theme's real state machine and scene builder for the intro video.
import { buildScene } from '../hooks/factory-scene-svg'
import { initialFactoryState, reduce } from '../hooks/factory-state-machine'
;(globalThis as any).RocketFactory = { buildScene, initialFactoryState, reduce }
