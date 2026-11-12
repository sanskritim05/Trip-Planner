import { useEffect, useRef } from "react";
import type * as L from "leaflet";
import type { Place } from "@/lib/types";
import { cn } from "@/lib/utils";
import { palette } from "@/lib/theme";

export type MapStop = {
  place: Place;
  n: number;
  status: "done" | "pending" | "skipped" | "selected";
};

const PIN: Record<MapStop["status"], string> = {
  done: palette.sea,
  pending: palette.primary,
  selected: palette.primary,
  skipped: palette["muted-foreground"],
};

const CHECK_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

function pinHtml(label: string, color: string, selected: boolean) {
  const size = selected ? 40 : 32;
  return `<div style="width:${size}px;height:${size}px;transform:translate(-50%,-100%) rotate(-45deg);border-radius:50% 50% 50% 0;background:${color};border:3px solid white;box-shadow:0 8px 18px -6px rgba(40,50,90,.45);display:flex;align-items:center;justify-content:center;${selected ? `outline:4px solid ${palette.butter};` : ""}"><span style="transform:rotate(45deg);color:white;font:800 ${selected ? 14 : 12}px Nunito,sans-serif">${label}</span></div>`;
}

/**
 * Interactive map (Leaflet + OpenStreetMap tiles, softened to pastels in CSS). Leaflet touches `window`,
 * so it's loaded lazily on the client.
 */
export function MapView({
  stops,
  extra = [],
  me,
  route,
  selectedId,
  onSelect,
  className,
  interactive = true,
}: {
  stops: MapStop[];
  extra?: Place[];
  me?: { lat: number; lng: number } | null;
  route?: [number, number][] | null;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  interactive?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const lib = useRef<typeof L | null>(null);
  const fitKey = useRef("");
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let disposed = false;
    void import("leaflet").then((mod) => {
      const Lf = (mod as unknown as { default?: typeof L }).default ?? (mod as unknown as typeof L);
      if (disposed || !el.current || map.current) return;
      lib.current = Lf;
      map.current = Lf.map(el.current, {
        zoomControl: interactive,
        attributionControl: true,
        scrollWheelZoom: false,
        dragging: interactive,
        doubleClickZoom: interactive,
        touchZoom: interactive,
      });
      Lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        className: "ans-tiles",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map.current);
      layer.current = Lf.layerGroup().addTo(map.current);
      draw();
    });
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const draw = () => {
    const Lf = lib.current;
    const m = map.current;
    const g = layer.current;
    if (!Lf || !m || !g) return;
    g.clearLayers();
    const line =
      route && route.length > 1
        ? route
        : stops
            .filter((s) => s.status !== "skipped")
            .map((s) => [s.place.lat, s.place.lng] as [number, number]);
    if (line.length > 1) {
      Lf.polyline(line, { color: "white", weight: 8, opacity: 0.9 }).addTo(g);
      Lf.polyline(line, {
        color: "#e0508a",
        weight: 4,
        opacity: 0.95,
        dashArray: route ? undefined : "8 8",
      }).addTo(g);
    }
    for (const p of extra) {
      Lf.marker([p.lat, p.lng], {
        icon: Lf.divIcon({
          className: "ans-pin",
          html: `<div style="transform:translate(-50%,-50%);width:16px;height:16px;border-radius:9999px;background:${palette.butter};border:3px solid white;box-shadow:0 4px 10px rgba(40,50,90,.35)"></div>`,
          iconSize: [0, 0],
        }),
        title: p.name,
      })
        .on("click", () => onSelectRef.current?.(p.id))
        .addTo(g);
    }
    for (const s of stops) {
      const sel = selectedId === s.place.id;
      Lf.marker([s.place.lat, s.place.lng], {
        icon: Lf.divIcon({
          className: "ans-pin",
          html: pinHtml(s.status === "done" ? CHECK_SVG : String(s.n), PIN[s.status], sel),
          iconSize: [0, 0],
        }),
        title: `${s.n}. ${s.place.name}`,
        zIndexOffset: sel ? 1000 : 0,
        keyboard: true,
      })
        .on("click", () => onSelectRef.current?.(s.place.id))
        .addTo(g);
    }
    if (me) {
      Lf.circleMarker([me.lat, me.lng], {
        radius: 9,
        color: "white",
        weight: 3,
        fillColor: "#3b9fb8",
        fillOpacity: 1,
      }).addTo(g);
      Lf.circle([me.lat, me.lng], {
        radius: 120,
        color: "#3b9fb8",
        weight: 0,
        fillOpacity: 0.15,
      }).addTo(g);
    }
    const pts: [number, number][] = [
      ...stops.map((s) => [s.place.lat, s.place.lng] as [number, number]),
      ...extra.map((p) => [p.lat, p.lng] as [number, number]),
      ...(me ? [[me.lat, me.lng] as [number, number]] : []),
    ];
    const key = pts.map((p) => p.join(",")).join(";");
    if (pts.length && key !== fitKey.current) {
      fitKey.current = key;
      if (pts.length === 1) m.setView(pts[0]!, 15);
      else m.fitBounds(Lf.latLngBounds(pts), { padding: [36, 36], maxZoom: 16 });
    }
  };

  useEffect(draw); // redraw on every prop change (cheap: a handful of markers)

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const s =
      stops.find((x) => x.place.id === selectedId) ?? extra.find((p) => p.id === selectedId);
    const p = s && "place" in s ? s.place : (s as Place | undefined);
    if (p) m.panTo([p.lat, p.lng], { animate: true });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!stops.length && !extra.length && !me) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-3xl bg-sea-soft text-sm font-bold text-muted-foreground",
          className,
        )}
      >
        No stops to show yet
      </div>
    );
  }
  return (
    <div
      ref={el}
      className={cn("isolate overflow-hidden rounded-3xl bg-sea-soft shadow-soft", className)}
      role="application"
      aria-label="Map of stops"
    />
  );
}
