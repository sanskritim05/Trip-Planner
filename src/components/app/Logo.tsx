import { cn } from "@/lib/utils";
import { palette } from "@/lib/theme";

/** Ans2Sans mark: a little paper plane looping over a wave, on a flamingo-pink pebble. */
export function Logo({
  size = "md",
  withName,
  className,
  light,
}: {
  size?: "sm" | "md" | "lg";
  withName?: boolean;
  className?: string;
  light?: boolean;
}) {
  const box = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "bob relative flex shrink-0 items-center justify-center rounded-[38%_62%_55%_45%/50%_45%_55%_50%] bg-primary shadow-soft",
          box,
        )}
        aria-hidden
      >
        <svg viewBox="0 0 48 48" className="h-[72%] w-[72%]" fill="none">
          <path
            d="M6 34c5-4 9-4 14 0s9 4 14 0 7-3 8-2"
            stroke={palette["sea-soft"]}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path d="M10 22 39 10l-9 22-6-8-14-2Z" fill={palette["on-photo"]} />
          <path
            d="m24 24 15-14"
            stroke={palette["primary-strong"]}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="12" cy="11" r="2.4" fill={palette.butter} />
        </svg>
      </span>
      {withName && (
        <span className={cn("font-display font-semibold italic", text, light && "text-on-photo")}>
          Ans2Sans
        </span>
      )}
    </span>
  );
}
