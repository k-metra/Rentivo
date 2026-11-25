import { createContext, useContext, type ReactNode } from 'react'

const SubscriptionReadOnlyContext = createContext(false)

export function SubscriptionReadOnlyProvider({
  children,
  readOnly,
}: {
  children: ReactNode
  readOnly: boolean
}) {
  return (
    <SubscriptionReadOnlyContext.Provider value={readOnly}>
      {children}
    </SubscriptionReadOnlyContext.Provider>
  )
}

export function useSubscriptionReadOnly() {
  return useContext(SubscriptionReadOnlyContext)
}
