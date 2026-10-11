import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative inline-flex items-center">
      <select
        className={cn(
          "border-input bg-background text-foreground h-8 cursor-pointer appearance-none rounded-md border pr-8 pl-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-4 opacity-50" />
    </div>
  );
}

export { NativeSelect };
