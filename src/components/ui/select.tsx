import React, { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

type SelectContextValue = {
  value?: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  onValueChange?: (value: string) => void;
};

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelect() {
  return useContext(SelectContext);
}

export const Select = ({
  value,
  onValueChange,
  children,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <SelectContext.Provider value={{ value, open, setOpen, onValueChange }}>
      <div className="select relative">{children}</div>
    </SelectContext.Provider>
  );
};

export const SelectTrigger = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <SelectTriggerInner className={className} {...props}>
    {children}
  </SelectTriggerInner>
);

function SelectTriggerInner({
  children,
  className,
  onClick,
  onKeyDown,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const select = useSelect();
  return (
    <div
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
        className,
      )}
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) select?.setOpen(!select.open);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select?.setOpen(!select.open);
        }
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export const SelectValue = ({ placeholder }: { placeholder?: string }) => {
  const select = useSelect();
  const label = select?.value ? select.value[0].toUpperCase() + select.value.slice(1) : placeholder;
  return <span className={select?.value ? "" : "text-muted-foreground"}>{label}</span>;
};

export const SelectContent = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  const select = useSelect();
  if (select && !select.open) return null;

  return (
    <div className={cn("absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md", className)} {...props}>
      {children}
    </div>
  );
};

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
}) => {
  const select = useSelect();
  return (
    <button
      type="button"
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
        className,
      )}
      onClick={() => {
        if (value) select?.onValueChange?.(value);
        select?.setOpen(false);
        onClick?.();
      }}
      data-value={value}
    >
      {children}
    </button>
  );
};
