import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-[1.5px] border-[#BDBDBD] placeholder:text-[#757575] focus-visible:border-[#1976D2] focus-visible:ring-[3px] focus-visible:ring-[rgba(25,118,210,0.15)] focus-visible:shadow-[0_0_0_3px_rgba(25,118,210,0.15)] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-md bg-white px-3 py-2 text-base shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-[color,box-shadow,border-color] duration-200 ease-in-out outline-none hover:border-[#9E9E9E] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
