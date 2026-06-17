import React from "react";
import { cn } from "@/lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export const Dialog = ({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}) => <>{children}</>;

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
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" onClick={onClick} className={cn("dialog-close", className)} {...props}>
    {children}
  </button>
);

export const DialogContent = ({
  children,
  className,
  ...props
}: DivProps & { open?: boolean; onOpenChange?: (open: boolean) => void }) => (
  <div
    className={cn(
      "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-card p-6 shadow-lg",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export const DialogTrigger = ({
  children,
  asChild,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ className?: string }>, {
      className: cn((children.props as { className?: string }).className),
      ...props,
    });
  }
  return (
    <button type="button" className={cn("dialog-trigger", className)} {...props}>
      {children}
    </button>
  );
};
