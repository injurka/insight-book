export function useHaptic() {
  const vibrate = (pattern: number | number[] = 50) => {
    // Only vibrate if the user allows haptic feedback in settings (you can add this to your settings store)
    // and if the device supports it.
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern)
      }
      catch {
        // Ignore errors if vibration is blocked or unsupported
      }
    }
  }

  const hapticLight = () => vibrate(10)
  const hapticMedium = () => vibrate(40)
  const hapticHeavy = () => vibrate([50, 100, 50])

  return {
    vibrate,
    hapticLight,
    hapticMedium,
    hapticHeavy,
  }
}
