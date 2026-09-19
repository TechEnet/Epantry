import {
  QueryClientProvider,
} from '@tanstack/react-query'

import {
  MotionConfig,
} from 'motion/react'

import {
  BrowserRouter,
} from 'react-router-dom'

import {
  AdminProvider,
} from '../features/admin/context/AdminContext'

import {
  AuthProvider,
} from '../features/auth/context/AuthContext'

import {
  HouseholdProvider,
} from '../features/households/context/HouseholdContext'

import PwaStatusBar from '../features/pwa/components/PwaStatusBar'

import {
  PwaProvider,
} from '../features/pwa/context/PwaContext'

import AppErrorBoundary from '../features/system/components/AppErrorBoundary'

import BootstrapSync from '../features/system/components/BootstrapSync'

import {
  queryClient,
} from '../lib/queryClient'

export default function AppProviders({
  children,
}) {
  return (
    <AppErrorBoundary>
      <QueryClientProvider
        client={queryClient}
      >
        <MotionConfig
          reducedMotion="user"
        >
          <BrowserRouter>
            <PwaProvider>
              <AuthProvider>
                <AdminProvider>
                  <HouseholdProvider>
                    <BootstrapSync />

                    <PwaStatusBar />

                    {children}
                  </HouseholdProvider>
                </AdminProvider>
              </AuthProvider>
            </PwaProvider>
          </BrowserRouter>
        </MotionConfig>
      </QueryClientProvider>
    </AppErrorBoundary>
  )
}
