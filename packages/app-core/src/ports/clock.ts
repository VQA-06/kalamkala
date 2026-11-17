/** Time source, injected so tests and simulation can move time deliberately. */
export type ClockPort = {
  now: () => Date
}

export const systemClock: ClockPort = {
  now: () => new Date(),
}
