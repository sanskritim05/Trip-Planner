import { Link } from "@tanstack/react-router";
import { BookHeart, Compass, Home, Map, Plus, User } from "lucide-react";
import { useApp } from "@/lib/store";
import { Logo } from "./Logo";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/trips", label: "My Trips", icon: Map },
  { to: "/memories", label: "Memories", icon: BookHeart },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="group flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold text-muted-foreground transition-colors data-[status=active]:text-primary-strong"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-8 w-14 items-center justify-center rounded-full transition-all ${isActive ? "bg-primary-soft" : "group-hover:bg-secondary"}`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 1.8} />
                  </span>
                  {label}
                </>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SideNav() {
  const { state } = useApp();
  return (
    <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-card/75 p-5 backdrop-blur-md lg:flex">
      <Link to="/" className="mb-8" aria-label="Ans2Sans home">
        <Logo withName />
      </Link>
      <ul className="space-y-1">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-muted-foreground transition hover:bg-secondary data-[status=active]:bg-primary-soft data-[status=active]:text-foreground"
            >
              <Icon className="h-5 w-5" /> {label}
            </Link>
          </li>
        ))}
      </ul>
      <Link
        to="/create-trip"
        className="tap mt-6 flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground shadow-soft"
      >
        <Plus className="h-4 w-4" /> Plan a trip
      </Link>
      <p className="mt-6 px-2 font-script text-xl leading-tight text-sea-strong">
        salty air, sweet plans
      </p>
      <div className="mt-auto flex items-center gap-3 rounded-2xl bg-secondary p-3">
        <Avatar name={state.user?.name ?? "Traveler"} src={state.user?.avatar ?? null} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{state.user?.name ?? "Traveler"}</p>
          <p className="truncate text-xs text-muted-foreground">{state.user?.email}</p>
        </div>
      </div>
    </aside>
  );
}

export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "lg"
      ? "h-24 w-24 text-3xl"
      : size === "sm"
        ? "h-9 w-9 text-sm"
        : "h-11 w-11 text-base";
  return src ? (
    <img
      src={src}
      alt={name}
      className={`${dim} shrink-0 rounded-full object-cover ring-2 ring-card`}
    />
  ) : (
    <span
      className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-display font-semibold text-foreground ring-2 ring-card`}
    >
      {name.trim().charAt(0).toUpperCase() || "T"}
    </span>
  );
}
