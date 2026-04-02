import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-[#757575] selection:bg-primary selection:text-primary-foreground border-[1.5px] border-[#BDBDBD] h-9 w-full min-w-0 rounded-lg bg-white px-3 py-1 text-base shadow-[0_6px_18px_-16px_rgba(15,23,42,0.35)] transition-[color,box-shadow,border-color] duration-200 ease-in-out outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium hover:border-[#9E9E9E] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-[#1976D2] focus-visible:ring-[3px] focus-visible:ring-[rgba(25,118,210,0.15)] focus-visible:shadow-[0_0_0_3px_rgba(25,118,210,0.15)]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
