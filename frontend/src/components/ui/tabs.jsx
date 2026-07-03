import * as React from "react"

import { cn } from "@/lib/utils"

// Plain-React reimplementation of shadcn's Tabs API (Tabs/TabsList/TabsTrigger/TabsContent
// with the same value/onValueChange props) instead of wrapping @radix-ui/react-tabs, since
// that package isn't an installed dependency and this project's tabs are simple segmented
// pill filters, not full accessible tabbed panels with keyboard roving focus.
const TabsContext = React.createContext(null)

function Tabs({ value, defaultValue, onValueChange, className, children, ...props }) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const isControlled = value !== undefined
  const current = isControlled ? value : internalValue

  const setValue = (next) => {
    if (!isControlled) setInternalValue(next)
    onValueChange?.(next)
  }

  return (
    <TabsContext.Provider value={{ value: current, setValue }}>
      <div className={cn(className)} {...props}>{children}</div>
    </TabsContext.Provider>
  )
}

function TabsList({ className, ...props }) {
  return (
    <div
      className={cn("inline-flex items-center gap-1 rounded-full bg-muted p-1", className)}
      {...props}
    />
  )
}

function TabsTrigger({ value, className, children, ...props }) {
  const ctx = React.useContext(TabsContext)
  const isActive = ctx.value === value
  return (
    <button
      type="button"
      onClick={() => ctx.setValue(value)}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
        isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function TabsContent({ value, className, children, ...props }) {
  const ctx = React.useContext(TabsContext)
  if (ctx.value !== value) return null
  return <div className={cn(className)} {...props}>{children}</div>
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
