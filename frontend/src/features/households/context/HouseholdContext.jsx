import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  useAuth,
} from '../../auth/context/AuthContext'

import {
  createMyHousehold,
  getMyHousehold,
  getMyHouseholdMembers,
  selectMyHousehold,
} from '../services/household.service'

const HouseholdContext =
  createContext(null)

/*
|--------------------------------------------------------------------------
| Normalize Household Context
|--------------------------------------------------------------------------
*/

function normalizeHouseholdContext(
  data,
) {
  if (
    data?.hasHousehold ===
      true &&
    data?.household &&
    data?.membership
  ) {
    return {
      hasHousehold:
        true,

      household:
        data.household,

      membership:
        data.membership,

      households:
        Array.isArray(
          data?.households,
        )
          ? data.households
          : [
              {
                household:
                  data.household,
                membership:
                  data.membership,
              },
            ],
    }
  }

  return {
    hasHousehold:
      false,

    household:
      null,

    membership:
      null,

    households:
      Array.isArray(
        data?.households,
      )
        ? data.households
        : [],
  }
}

export function HouseholdProvider({
  children,
}) {
  const {
    isAuthenticated,
    isBootstrapping,
  } = useAuth()

  const [
    household,
    setHousehold,
  ] = useState(null)

  const [
    membership,
    setMembership,
  ] = useState(null)

  const [
    households,
    setHouseholds,
  ] = useState([])

  const [
    members,
    setMembers,
  ] = useState([])

  const [
    isLoadingHousehold,
    setIsLoadingHousehold,
  ] = useState(false)

  const [
    isCreatingHousehold,
    setIsCreatingHousehold,
  ] = useState(false)

  const [
    isLoadingMembers,
    setIsLoadingMembers,
  ] = useState(false)

  const [
    householdError,
    setHouseholdError,
  ] = useState(null)

  const [
    membersError,
    setMembersError,
  ] = useState(null)

  /*
  |--------------------------------------------------------------------------
  | State Helpers
  |--------------------------------------------------------------------------
  */

  const clearHouseholdState =
    useCallback(
      () => {
        setHousehold(
          null,
        )

        setMembership(
          null,
        )

        setHouseholds([])

        setMembers([])

        setHouseholdError(
          null,
        )

        setMembersError(
          null,
        )
      },
      [],
    )

  const applyHouseholdContext =
    useCallback(
      (
        data,
      ) => {
        const normalized =
          normalizeHouseholdContext(
            data,
          )

        setHousehold(
          normalized.household,
        )

        setMembership(
          normalized.membership,
        )

        setHouseholds(
          normalized.households,
        )

        if (
          !normalized
            .hasHousehold
        ) {
          setMembers([])
        }

        return normalized
      },
      [],
    )

  /*
  |--------------------------------------------------------------------------
  | Bootstrap When Auth State Changes
  |--------------------------------------------------------------------------
  |
  | Registration and login both ultimately update AuthContext.
  |
  | HouseholdContext therefore does not need to know how authentication
  | happened.
  |
  */

  useEffect(() => {
    let isActive =
      true

    if (
      isBootstrapping
    ) {
      return () => {
        isActive =
          false
      }
    }

    if (
      !isAuthenticated
    ) {
      clearHouseholdState()

      setIsLoadingHousehold(
        false,
      )

      return () => {
        isActive =
          false
      }
    }

    const bootstrap =
      async () => {
        setIsLoadingHousehold(
          true,
        )

        setHouseholdError(
          null,
        )

        try {
          const data =
            await getMyHousehold()

          if (!isActive) {
            return
          }

          applyHouseholdContext(
            data,
          )
        } catch (error) {
          if (!isActive) {
            return
          }

          setHouseholdError(
            error,
          )
        } finally {
          if (isActive) {
            setIsLoadingHousehold(
              false,
            )
          }
        }
      }

    void bootstrap()

    return () => {
      isActive =
        false
    }
  }, [
    isAuthenticated,
    isBootstrapping,
    applyHouseholdContext,
    clearHouseholdState,
  ])

  /*
  |--------------------------------------------------------------------------
  | Manual Refresh
  |--------------------------------------------------------------------------
  */

  const refreshHousehold =
    useCallback(
      async () => {
        if (
          !isAuthenticated
        ) {
          clearHouseholdState()

          return {
            hasHousehold:
              false,

            household:
              null,

            membership:
              null,

            households:
              [],
          }
        }

        setIsLoadingHousehold(
          true,
        )

        setHouseholdError(
          null,
        )

        try {
          const data =
            await getMyHousehold()

          return applyHouseholdContext(
            data,
          )
        } catch (error) {
          setHouseholdError(
            error,
          )

          throw error
        } finally {
          setIsLoadingHousehold(
            false,
          )
        }
      },
      [
        isAuthenticated,
        applyHouseholdContext,
        clearHouseholdState,
      ],
    )

  /*
  |--------------------------------------------------------------------------
  | Create Household
  |--------------------------------------------------------------------------
  */

  const createHousehold =
    useCallback(
      async ({
        name,
        usualPeopleCount,
      }) => {
        if (
          !isAuthenticated
        ) {
          throw new Error(
            'Authentication is required before creating a household.',
          )
        }

        setIsCreatingHousehold(
          true,
        )

        setHouseholdError(
          null,
        )

        try {
          const data =
            await createMyHousehold({
              name,

              usualPeopleCount,
            })

          const context =
            applyHouseholdContext(
              data,
            )

          setMembers([])

          return context
        } catch (error) {
          setHouseholdError(
            error,
          )

          throw error
        } finally {
          setIsCreatingHousehold(
            false,
          )
        }
      },
      [
        isAuthenticated,
        applyHouseholdContext,
      ],
    )

  /*
  |--------------------------------------------------------------------------
  | Select Working Household
  |--------------------------------------------------------------------------
  */

  const selectHousehold =
    useCallback(
      async (
        householdId,
      ) => {
        if (
          !isAuthenticated ||
          !householdId
        ) {
          return null
        }

        setIsLoadingHousehold(
          true,
        )
        setHouseholdError(
          null,
        )

        try {
          const data =
            await selectMyHousehold(
              householdId,
            )

          const context =
            applyHouseholdContext(
              data,
            )

          setMembers([])

          return context
        } catch (error) {
          setHouseholdError(
            error,
          )

          throw error
        } finally {
          setIsLoadingHousehold(
            false,
          )
        }
      },
      [
        isAuthenticated,
        applyHouseholdContext,
      ],
    )

  /*
  |--------------------------------------------------------------------------
  | Load Household Members
  |--------------------------------------------------------------------------
  |
  | The members endpoint also returns household context. Do not re-apply that
  | context here: replacing the household object changes loadMembers identity,
  | which can retrigger HouseholdPage's member-loading effect indefinitely.
  |
  | Household context is owned by bootstrap/refresh/create flows. This loader
  | updates only the member collection returned by /households/me/members.
  |
  */

  const loadMembers =
    useCallback(
      async () => {
        if (
          !isAuthenticated ||
          !household
        ) {
          setMembers([])

          setIsLoadingMembers(
            false,
          )

          return []
        }

        setIsLoadingMembers(
          true,
        )

        setMembersError(
          null,
        )

        try {
          const data =
            await getMyHouseholdMembers()

          const nextMembers =
            Array.isArray(
              data?.members,
            )
              ? data.members
              : []

          setMembers(
            nextMembers,
          )

          return nextMembers
        } catch (error) {
          setMembersError(
            error,
          )

          throw error
        } finally {
          setIsLoadingMembers(
            false,
          )
        }
      },
      [
        isAuthenticated,
        household,
      ],
    )

  /*
  |--------------------------------------------------------------------------
  | Derived State
  |--------------------------------------------------------------------------
  */

  const hasHousehold =
    Boolean(
      household &&
      membership,
    )

  const status =
    isBootstrapping ||
    isLoadingHousehold
      ? 'loading'
      : hasHousehold
        ? 'ready'
        : 'empty'

  /*
  |--------------------------------------------------------------------------
  | Context Value
  |--------------------------------------------------------------------------
  */

  const value =
    useMemo(
      () => ({
        household,

        membership,

        households,

        members,

        hasHousehold,

        status,

        isLoadingHousehold,

        isCreatingHousehold,

        isLoadingMembers,

        householdError,

        membersError,

        refreshHousehold,

        createHousehold,

        selectHousehold,

        loadMembers,
      }),
      [
        household,
        membership,
        households,
        members,
        hasHousehold,
        status,
        isLoadingHousehold,
        isCreatingHousehold,
        isLoadingMembers,
        householdError,
        membersError,
        refreshHousehold,
        createHousehold,
        selectHousehold,
        loadMembers,
      ],
    )

  return (
    <HouseholdContext.Provider
      value={value}
    >
      {children}
    </HouseholdContext.Provider>
  )
}

/*
|--------------------------------------------------------------------------
| useHousehold
|--------------------------------------------------------------------------
*/

export function useHousehold() {
  const context =
    useContext(
      HouseholdContext,
    )

  if (!context) {
    throw new Error(
      'useHousehold must be used inside HouseholdProvider.',
    )
  }

  return context
}
