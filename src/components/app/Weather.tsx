import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudSnow,
  CloudSun,
  Sun,
} from "lucide-react";
import type { DayWeather, WeatherIcon } from "@/services/weather";
import { cn } from "@/lib/utils";

export const WEATHER_ICON: Record<WeatherIcon, typeof Sun> = {
  sun: Sun,
  partly: CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  rain: CloudDrizzle,
  storm: CloudLightning,
  snow: CloudSnow,
};

export function WeatherChip({
  w,
  compact,
  className,
}: {
  w: DayWeather;
  compact?: boolean;
  className?: string;
}) {
  const I = WEATHER_ICON[w.icon];
  const tone = w.rainy
    ? "text-sea"
    : w.icon === "sun" || w.icon === "partly"
      ? "text-amber-500"
      : "text-muted-foreground";
  if (compact)
    return (
      <span
        title={`${w.summary}, ${w.max}°`}
        className={cn("inline-flex items-center gap-0.5 text-[11px] font-bold", className)}
      >
        <I className={cn("h-3.5 w-3.5", tone)} />
        {w.max}°
      </span>
    );
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-extrabold shadow-soft",
        className,
      )}
    >
      <I className={cn("h-4 w-4", tone)} />
      {w.max}° / {w.min}°
    </span>
  );
}
