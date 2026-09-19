import { create } from 'zustand'
import {
  createJSONStorage,
  persist,
} from 'zustand/middleware'

export const useLocationStore = create(
  persist(
    (set) => ({
      currentLocation: null,

      currentLocationStatus: 'idle',

      currentLocationError: null,

      /*
      |--------------------------------------------------------------------------
      | Delivery Context
      |--------------------------------------------------------------------------
      |
      | Future checkout / fulfillment module will set this value.
      |
      | Example shape:
      |
      | {
      |   city: 'Lucknow',
      |   state: 'Uttar Pradesh',
      |   country: 'India',
      |   label: 'Lucknow, Uttar Pradesh',
      |   estimatedDeliveryMinutes: 20
      | }
      |
      */

      deliveryContext: null,

      setCurrentLocationStatus: (status) =>
        set({
          currentLocationStatus: status,
          currentLocationError: null,
        }),

      setCurrentLocation: (location) =>
        set({
          currentLocation: location,
          currentLocationStatus: 'ready',
          currentLocationError: null,
        }),

      setCurrentLocationError: (
        message,
        status = 'error',
      ) =>
        set({
          currentLocationStatus: status,
          currentLocationError: message,
        }),

      setDeliveryContext: (
        deliveryContext,
      ) =>
        set({
          deliveryContext:
            deliveryContext
              ? {
                  city:
                    deliveryContext.city ||
                    '',

                  state:
                    deliveryContext.state ||
                    '',

                  country:
                    deliveryContext.country ||
                    '',

                  label:
                    deliveryContext.label ||
                    '',

                  estimatedDeliveryMinutes:
                    Number.isFinite(
                      deliveryContext.estimatedDeliveryMinutes,
                    )
                      ? deliveryContext.estimatedDeliveryMinutes
                      : null,
                }
              : null,
        }),

      clearDeliveryContext: () =>
        set({
          deliveryContext: null,
        }),
    }),

    {
      name: 'epantry-location-session',

      storage:
        createJSONStorage(
          () => sessionStorage,
        ),

      /*
      |--------------------------------------------------------------------------
      | Privacy
      |--------------------------------------------------------------------------
      |
      | Exact GPS coordinates are never persisted.
      |
      */

      partialize: (state) => ({
        currentLocation:
          state.currentLocation,

        deliveryContext:
          state.deliveryContext,
      }),
    },
  ),
)