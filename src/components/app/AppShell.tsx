import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { GroupSync } from "@/lib/group-sync";
import { useApp } from "@/lib/store";
import { placeholderImage } from "@/services/wiki";
import { BottomNav, SideNav } from "./Nav";

const PUBLIC = ["/welcome", "/auth"];
const FULLSCREEN = ["/welcome", "/auth", "/onboarding"];

export function AppShell({ children }: { children: ReactNode }) {
  const { state } = useApp();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const isPublic = PUBLIC.some((p) => path.startsWith(p));
  const full = FULLSCREEN.some((p) => path.startsWith(p)) || path.endsWith("/checkin");

  // A photo that fails to load (moved, blocked, offline) becomes a soft postcard, never a blank box.
  useEffect(() => {
    const onError = (e: Event) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || img.src.startsWith("data:")) return;
      img.src = placeholderImage("Landmark", img.alt);
    };
    window.addEventListener("error", onError, true);
    return () => window.removeEventListener("error", onError, true);
  }, []);
  useEffect(() => {
    // Send visitors to sign in, then bring them back (e.g. to an invite link).
    if (!state.user && !isPublic)
      void navigate({ to: "/welcome", search: path !== "/" ? { next: path } : {}, replace: true });
  }, [state.user, isPublic, navigate, path]);

  if (!state.user && !isPublic) return null;
  if (full) return <>{children}</>;
  return (
    <>
      <GroupSync />
      <SideNav />
      <div className="lg:pl-64">{children}</div>
      <BottomNav />
    </>
  );
}
