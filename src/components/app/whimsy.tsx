import { useEffect, useState } from "react";
import { Heart, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { palette } from "@/lib/theme";

const BURST_COLORS = [
  palette.primary,
  palette.sea,
  palette.butter,
  palette.lilac,
  palette.mint,
  palette.peach,
];
type Shape = "dot" | "square" | "ring" | "heart" | "star";
const SHAPES: Shape[] = ["dot", "heart", "square", "star", "ring"];

function Piece({ shape, color }: { shape: Shape; color: string }) {
  if (shape === "heart") return <Heart className="h-4 w-4" style={{ color, fill: color }} />;
  if (shape === "star") return <Star className="h-4 w-4" style={{ color, fill: color }} />;
  if (shape === "ring")
    return (
      <span
        className="block h-3.5 w-3.5 rounded-full border-[3px]"
        style={{ borderColor: color }}
      />
    );
  if (shape === "square")
    return <span className="block h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />;
  return <span className="block h-3 w-3 rounded-full" style={{ background: color }} />;
}

/** A one-shot burst of colorful confetti shapes. Re-trigger by changing `trigger`. */
export function Burst({ trigger, count = 16 }: { trigger: number; count?: number }) {
  const [pieces, setPieces] = useState<
    {
      id: number;
      shape: Shape;
      color: string;
      dx: number;
      dy: number;
      rot: number;
      delay: number;
    }[]
  >([]);
  useEffect(() => {
    if (!trigger) return;
    const next = Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const dist = 90 + Math.random() * 110;
      return {
        id: trigger * 100 + i,
        shape: SHAPES[i % SHAPES.length]!,
        color: BURST_COLORS[(i * 7) % BURST_COLORS.length]!,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 60,
        rot: Math.random() * 240 - 120,
        delay: Math.random() * 120,
      };
    });
    setPieces(next);
    const t = setTimeout(() => setPieces([]), 1400);
    return () => clearTimeout(t);
  }, [trigger, count]);
  if (!pieces.length) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-visible" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="burst-piece"
          style={{
            translate: `${p.dx}px ${p.dy}px`,
            rotate: `${p.rot}deg`,
            animationDelay: `${p.delay}ms`,
          }}
        >
          <Piece shape={p.shape} color={p.color} />
        </span>
      ))}
    </div>
  );
}

/** Soft floating bubbles for hero areas. */
export function Bubbles({ className }: { className?: string }) {
  const bubbles = [
    { s: 46, l: "8%", t: "18%", d: "0s" },
    { s: 22, l: "22%", t: "62%", d: "1.2s" },
    { s: 34, l: "78%", t: "24%", d: "0.6s" },
    { s: 16, l: "88%", t: "66%", d: "2s" },
    { s: 26, l: "55%", t: "10%", d: "1.6s" },
  ];
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="bubble"
          style={{ width: b.s, height: b.s, left: b.l, top: b.t, animationDelay: b.d }}
        />
      ))}
    </div>
  );
}

/** Wavy divider, e.g. at the bottom of a photo. */
export function Wave({
  className,
  fill = palette.background,
}: {
  className?: string;
  fill?: string;
}) {
  return (
    <svg
      viewBox="0 0 400 24"
      preserveAspectRatio="none"
      className={cn("block h-6 w-full", className)}
      aria-hidden
    >
      <path
        d="M0 14 Q 25 2 50 14 T 100 14 T 150 14 T 200 14 T 250 14 T 300 14 T 350 14 T 400 14 V24 H0Z"
        fill={fill}
      />
    </svg>
  );
}
