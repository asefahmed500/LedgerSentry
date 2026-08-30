import { cn } from "@/lib/utils"

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("size-6 shrink-0", className)}
    >
      <path
        d="M3 3H29V17.5L16 30L3 17.5V3Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="miter"
      />
      <path d="M8.5 9H23.5" stroke="currentColor" strokeWidth="2.4" />
      <path d="M8.5 13.5H18" stroke="currentColor" strokeWidth="2.4" />
      <path
        d="M10.5 19.5L14 23L22.5 13.5"
        stroke="var(--primary)"
        strokeWidth="2.6"
        strokeLinejoin="miter"
      />
    </svg>
  )
}

export function Logo({
  className,
  markClassName,
}: {
  className?: string
  markClassName?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={markClassName} />
      <span className="text-[17px] font-semibold tracking-[-0.01em]">
        Ledger<span className="text-primary">Sentry</span>
      </span>
    </span>
  )
}
