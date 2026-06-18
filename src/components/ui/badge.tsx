import React from "react";
import { cn } from "@/lib/utils";

export const Badge = ({
  variant = "default",
  className,
  children,
}: {
  variant?: string;
  className?: string;
  children?: React.ReactNode;
}) => (
  <span className={cn("badge", `badge-${variant}`, className)}>
    {children}
  </span>
);
