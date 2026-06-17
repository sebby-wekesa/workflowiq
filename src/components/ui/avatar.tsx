import React from "react"
export const Avatar = ({ src, alt, className, children }: { src?: string; alt?: string; className?: string; children?: React.ReactNode }) => (
  <div className={className}>
    {src ? <img src={src} alt={alt || ""} className="w-full h-full rounded-full" /> : children ?? <div>Avatar</div>}
  </div>
)
export const AvatarFallback = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <div className={className}>{children}</div>
)
export const AvatarImage = Avatar