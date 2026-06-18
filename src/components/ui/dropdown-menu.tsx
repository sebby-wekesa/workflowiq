import React, { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

type DropdownContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdown() {
  return useContext(DropdownContext);
}

export const DropdownMenu = ({ children }: { children?: React.ReactNode }) => (
  <DropdownMenuRoot>{children}</DropdownMenuRoot>
);

function DropdownMenuRoot({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  );
}

export const DropdownMenuTrigger = ({
  children,
  asChild,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => {
  const dropdown = useDropdown();
  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    props.onClick?.(event);
    if (!event.defaultPrevented) dropdown?.setOpen(!dropdown.open);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ className?: string; onClick?: React.MouseEventHandler<HTMLButtonElement> }>, {
      className: cn((children.props as { className?: string }).className, className),
      ...props,
      onClick: handleClick,
    });
  }
  return (
    <button type="button" className={cn("dropdown-trigger", className)} {...props} onClick={handleClick}>
      {children}
    </button>
  );
};

export const DropdownMenuContent = ({
  children,
  className,
  align,
  ...props
}: DivProps & { align?: "start" | "center" | "end" }) => {
  const dropdown = useDropdown();
  if (dropdown && !dropdown.open) return null;

  return (
    <div
      className={cn(
        "absolute z-50 mt-1 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        align === "end" && "right-0",
        align === "start" && "left-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const DropdownMenuItem = ({
  children,
  onClick,
  className,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const dropdown = useDropdown();
  return (
    <button
      type="button"
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) dropdown?.setOpen(false);
      }}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export const DropdownMenuSeparator = ({ className }: { className?: string }) => (
  <hr className={cn("my-1 border-border", className)} />
);

export const DropdownMenuLabel = ({ children, className, ...props }: DivProps) => (
  <div className={cn("px-2 py-1.5 text-sm font-semibold", className)} {...props}>
    {children}
  </div>
);
