/** Logical canvas size. The canvas is scaled with CSS, the game always thinks in these units. */
export const WIDTH = 1024
export const HEIGHT = 576
/** Y coordinate of the ground the fighters stand on. */
export const FLOOR_Y = 480

/** The simulation always advances in fixed steps, independent of the monitor refresh rate. */
export const TICK_RATE = 60
export const STEP = 1 / TICK_RATE

/** All velocities are in pixels per tick, accelerations in pixels per tick². */
export const PHYSICS = {
  gravity: 0.7,
  jumpVelocity: -17,
  /** Releasing jump early clamps upward speed to this, giving short hops. */
  jumpCutVelocity: -7,
  maxFallSpeed: 18,
  runSpeed: 5,
  groundAccel: 1,
  airAccel: 0.4,
  groundFriction: 0.7,
  airFriction: 0.05,
  /** A jump pressed this many ticks before landing still fires on landing. */
  jumpBufferTicks: 6,
  /** An attack pressed this many ticks before recovery ends still fires. */
  attackBufferTicks: 8,
} as const

export const RULES = {
  maxHealth: 100,
  roundSeconds: 60,
  roundsToWin: 2,
  maxRounds: 5,
  introTicks: 100,
  roundEndTicks: 170,
  /** Share of damage that still gets through a block. */
  blockDamageFactor: 0.2,
  blockKnockbackFactor: 0.4,
  blockstunTicks: 10,
} as const
