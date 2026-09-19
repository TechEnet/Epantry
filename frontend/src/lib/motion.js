export const motionTokens = {
  duration: {
    fast: 0.16,
    normal: 0.24,
    slow: 0.36,
  },
  distance: {
    small: 6,
    normal: 12,
  },
}

export const fadeUp = {
  initial: { opacity: 0, y: motionTokens.distance.small },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -motionTokens.distance.small },
  transition: { duration: motionTokens.duration.normal },
}
