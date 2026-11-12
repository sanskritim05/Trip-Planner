import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";
import { StoreProvider } from "../lib/store";
import { AppShell } from "../components/app/AppShell";
import { Toaster } from "@/components/app/Toaster";
import { Logo } from "../components/app/Logo";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <Logo size="lg" />
        <h1 className="mt-4 text-6xl font-semibold text-foreground">Lost at sea</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This page drifted off with the tide. Let's paddle you back to shore.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-soft transition hover:brightness-105"
          >
            Take me home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <Logo size="lg" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          Oops! A wave knocked this page over
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. Try again, or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:brightness-105"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-input bg-card px-5 py-2.5 text-sm font-bold text-foreground transition hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Ans2Sans · AI Trip Planner" },
      { name: "theme-color", content: "#e0508a" },
      {
        name: "description",
        content:
          "Plan your whole trip, follow it while you travel, and get a digital scrapbook after. Go places. Make memories.",
      },
      { property: "og:title", content: "Ans2Sans · AI Trip Planner" },
      {
        property: "og:description",
        content:
          "Plan your whole trip, follow it while you travel, and get a digital scrapbook after. Go places. Make memories.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,500..600,0..100,0..1;1,9..144,500..600,0..100,0..1&family=Nunito:wght@400;600;700;800;900&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <StoreProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </StoreProvider>
      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          style: { borderRadius: "1.25rem", fontFamily: "Nunito, sans-serif", fontWeight: 700 },
        }}
      />
    </QueryClientProvider>
  );
}
