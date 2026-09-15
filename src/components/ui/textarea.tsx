import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldSurface } from "@/lib/field-styles"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        fieldSurface,
        // `field-sizing-content` used to sit here, growing the control to fit
        // its value with no ceiling. In a grid cell that turned a long job
        // description into a ~700px-tall row that wrecked the row it was in.
        // Height now comes from min-h plus the user's own resize handle, which
        // behaves the same everywhere.
        "flex min-h-16 w-full px-3 py-2 text-base md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
