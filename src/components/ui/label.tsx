import React from "react";
import { cn } from "@/lib/utils";

export const Label = ({ children, className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("text-sm font-medium", className)} {...props}>
    {children}
  </label>
);
