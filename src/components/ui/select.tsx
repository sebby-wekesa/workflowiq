import React from "react";
import { cn } from "@/lib/utils";

export const Select = ({
  value,
  onValueChange,
  children,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
}) => <div className="select">{children}</div>;

export const SelectTrigger = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export const SelectValue = ({ placeholder }: { placeholder?: string }) => (
  <span className="text-muted-foreground">{placeholder}</span>
);

export const SelectContent = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-1 rounded-md border bg-popover p-1", className)} {...props}>
    {children}
  </div>
);

export const SelectItem = ({
  value,
  children,
  className,
  onClick,
}: {
  value?: string;
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) => (
  <button
    type="button"
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
      className,
    )}
    onClick={onClick}
    data-value={value}
  >
    {children}
  </button>
);
