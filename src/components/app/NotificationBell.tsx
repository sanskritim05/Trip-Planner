import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Bell, BookHeart, CalendarClock, Map } from "lucide-react";
import { useApp } from "@/lib/store";

const icons = { reminder: CalendarClock, planning: Map, memories: BookHeart };

export function NotificationBell() {
  const { state, markAllRead, setState } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const prefs = state.settings;
  const list = state.notifications.filter((n) =>
    n.kind === "reminder"
      ? prefs.notifReminders
      : n.kind === "planning"
        ? prefs.notifPlanning
        : prefs.notifMemories,
  );
  const unread = list.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="tap relative flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-soft"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 animate-pulse rounded-full bg-sea ring-2 ring-card" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-3 w-80 max-w-[calc(100vw-2rem)] origin-top-right rounded-3xl border bg-popover p-3 shadow-lift animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between px-2 pb-2">
            <p className="font-display text-lg font-semibold">Updates</p>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-bold text-primary-strong hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          {list.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">All caught up</p>
          )}
          <ul className="max-h-96 space-y-1 overflow-y-auto">
            {list.map((n) => {
              const Icon = icons[n.kind];
              return (
                <li key={n.id}>
                  <button
                    onClick={() => {
                      setState((s) => ({
                        ...s,
                        notifications: s.notifications.map((x) =>
                          x.id === n.id ? { ...x, read: true } : x,
                        ),
                      }));
                      setOpen(false);
                      if (n.link) router.history.push(n.link);
                    }}
                    className={`flex w-full gap-3 rounded-2xl p-2.5 text-left transition hover:bg-secondary ${n.read ? "" : "bg-primary-soft/60"}`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sea-soft text-sea">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{n.title}</span>
                      <span className="block text-xs text-muted-foreground">{n.body}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
