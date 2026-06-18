import React from "react";
import { cn } from "@/lib/utils";

export const Avatar = ({
  src,
  alt,
  className,
  children,
}: {
  src?: string;
  alt?: string;
  className?: string;
  children?: React.ReactNode;
}) => (
  <div className={cn("avatar-ui", className)}>
    {src ? <AvatarImage src={src} alt={alt || ""} /> : children ?? <AvatarFallback>AV</AvatarFallback>}
  </div>
);

export const AvatarFallback = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <div className={cn("avatar-fallback", className)}>{children}</div>
);

export const AvatarImage = ({ src, alt, className }: { src?: string; alt?: string; className?: string }) => (
  <img src={src} alt={alt || ""} className={cn("avatar-image", className)} />
);
