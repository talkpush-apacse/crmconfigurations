import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldControl } from "@/lib/field-styles"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldControl,
        "min-w-0 py-1 selection:bg-primary selection:text-primary-foreground",
        "file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:pointer-events-none",
        className
      )}
      {...props}
    />
  )
}

export { Input }
