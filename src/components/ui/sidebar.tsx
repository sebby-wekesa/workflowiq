import React, { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

type SidebarContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("Sidebar components must be used within SidebarProvider");
  return ctx;
}

export function SidebarProvider({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((v) => !v);

  return (
    <SidebarContext.Provider value={{ open, setOpen, toggle }}>
      <div className={cn("flex min-h-screen w-full min-w-0 overflow-x-hidden", className)}>{children}</div>
    </SidebarContext.Provider>
  );
}

export function SidebarInset({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex min-h-screen min-w-0 flex-1 flex-col", className)}>{children}</div>;
}

export function SidebarTrigger({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { toggle } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground md:hidden",
        className,
      )}
      aria-label="Toggle sidebar"
      {...props}
    >
      <span className="sr-only">Toggle sidebar</span>
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}

export function Sidebar({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const { open } = useSidebar();
  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-transform md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        className,
      )}
    >
      {children}
    </aside>
  );
}

export function SidebarHeader({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(className)}>{children}</div>;
}

export function SidebarFooter({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("mt-auto", className)}>{children}</div>;
}

export function SidebarContent({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex-1 overflow-y-auto px-2 py-2", className)}>{children}</div>;
}

export function SidebarSeparator({ className }: { className?: string }) {
  return <hr className={cn("my-2 border-sidebar-border", className)} />;
}

export function SidebarGroup({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("py-1", className)}>{children}</div>;
}

export function SidebarGroupLabel({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-2 py-1 text-xs font-medium text-sidebar-foreground/60", className)}>
      {children}
    </div>
  );
}

export function SidebarGroupContent({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(className)}>{children}</div>;
}

export function SidebarMenu({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <ul className={cn("flex flex-col gap-1", className)}>{children}</ul>;
}

export function SidebarMenuItem({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <li className={cn(className)}>{children}</li>;
}

export function SidebarMenuButton({
  asChild,
  isActive,
  tooltip,
  className,
  children,
  ...props
}: {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string;
  className?: string;
  children?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = cn(
    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
    isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
    className,
  );

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ className?: string; title?: string }>, {
      className: cn(classes, (children.props as { className?: string }).className),
      title: tooltip,
    });
  }

  return (
    <button type="button" className={classes} title={tooltip} {...props}>
      {children}
    </button>
  );
}
