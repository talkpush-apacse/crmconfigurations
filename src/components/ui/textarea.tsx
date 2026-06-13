import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-[1.5px] border-[#BDBDBD] placeholder:text-[#757575] focus-visible:border-brand-lavender-darker focus-visible:ring-[3px] focus-visible:ring-brand-lavender/30 focus-visible:shadow-[0_0_0_3px_oklch(0.82_0.08_258/0.25)] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-lg bg-white px-3 py-2 text-base shadow-[0_6px_18px_-16px_rgba(15,23,42,0.35)] transition-[color,box-shadow,border-color] duration-200 ease-in-out outline-none hover:border-[#9E9E9E] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
