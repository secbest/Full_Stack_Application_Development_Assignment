import * as React from "react"

import { cn } from "@/lib/utils"

// Plain div-based progress bar - @radix-ui/react-progress isn't an installed dependency
// and the wizard's progress indicator is purely visual (no accessibility live-region needed
// beyond the numbered step labels already rendered alongside it).
const Progress = React.forwardRef(({ className, value = 0, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    {...props}
  >
    <div
      className="h-full bg-primary transition-all"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
))
Progress.displayName = "Progress"

export { Progress }
