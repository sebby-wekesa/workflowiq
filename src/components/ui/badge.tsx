import React from "react"
export const Badge = ({ variant = "default", className, children }: { variant?: string; className?: string; children?: React.ReactNode }) => (
  <span className={`badge badge-${variant} ${className || ""}`}>{children}</span>
)