import React, { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

type DialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialog() {
  return useContext(DialogContext);
}

export const Dialog = ({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const currentOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  return (
    <DialogContext.Provider value={{ open: currentOpen, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
};

export const DialogHeader = ({ children, className, ...props }: DivProps) => (
  <div className={cn("flex flex-col gap-1.5 text-center sm:text-left", className)} {...props}>
    {children}
  </div>
);

export const DialogTitle = ({ children, className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props}>
    {children}
  </h2>
);

export const DialogDescription = ({ children, className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props}>
    {children}
  </p>
);

export const DialogFooter = ({ children, className, ...props }: DivProps) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props}>
    {children}
  </div>
);

export const DialogClose = ({
  children,
  onClick,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const dialog = useDialog();
  return (
    <button
      type="button"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) dialog?.setOpen(false);
      }}
      className={cn("dialog-close", className)}
      {...props}
    >
      {children}
    </button>
  );
};

export const DialogContent = ({
  children,
  className,
  ...props
}: DivProps & { open?: boolean; onOpenChange?: (open: boolean) => void }) => {
  const dialog = useDialog();
  if (dialog && !dialog.open) return null;

  return (
    <div
      className="dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dialog?.setOpen(false);
      }}
    >
      <div
        className={cn(
          "dialog-content grid w-full max-w-lg gap-4 rounded-xl border bg-card p-6 shadow-lg",
          className,
        )}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </div>
  );
};

export const DialogTrigger = ({
  children,
  asChild,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => {
  const dialog = useDialog();
  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    props.onClick?.(event);
    if (!event.defaultPrevented) dialog?.setOpen(true);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ className?: string; onClick?: React.MouseEventHandler<HTMLButtonElement> }>, {
      className: cn((children.props as { className?: string }).className),
      ...props,
      onClick: handleClick,
    });
  }
  return (
    <button type="button" className={cn("dialog-trigger", className)} {...props} onClick={handleClick}>
      {children}
    </button>
  );
};
