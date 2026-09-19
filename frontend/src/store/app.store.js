import { create } from 'zustand'

export const useAppStore = create((set) => ({
  featureFlags: {},
  bootstrapLoaded: false,
  setFeatureFlags: (featureFlags) => set({ featureFlags, bootstrapLoaded: true }),
  resetBootstrap: () => set({ featureFlags: {}, bootstrapLoaded: false }),
}))
