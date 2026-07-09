import { cn } from "@/lib/utils";

const MARK_PATHS = (
  <>
    <path d="M32 27 C 20.5 27.5, 12.5 19.5, 12 9 C 24 9, 32 16.5, 32 27 Z" />
    <path d="M32 27 C 43.5 27.5, 51.5 19.5, 52 9 C 40 9, 32 16.5, 32 27 Z" />
    <path d="M32 23 C 38.5 29.5, 40.5 40, 36.5 51.5 C 34.8 56.5, 29.2 56.5, 27.5 51.5 C 23.5 40, 25.5 29.5, 32 23 Z" />
  </>
);

export function KodamaMark({
  size = 28,
  className,
  holeClassName = "fill-background",
}: {
  size?: number;
  className?: string;
  holeClassName?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="currentColor"
      role="img"
      aria-label="Kodama"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 text-primary", className)}
    >
      {MARK_PATHS}
      <circle cx="32" cy="43" r="3.1" className={holeClassName} />
    </svg>
  );
}
