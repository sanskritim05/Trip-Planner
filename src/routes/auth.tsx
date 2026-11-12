import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/app/Logo";
import { Bubbles } from "@/components/app/whimsy";
import { Field, inputCls, pillButton } from "@/components/app/ui";
import { emptyState, migrate, useApp } from "@/lib/store";
import { loadStateFn, logInFn, signUpFn } from "@/server/fns";
import { seo } from "@/lib/seo";

type Mode = "login" | "signup";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode; next?: string } => {
    const m = s["mode"];
    const next = typeof s["next"] === "string" && s["next"].startsWith("/") ? s["next"] : undefined;
    return { ...(m === "login" || m === "signup" ? { mode: m } : {}), ...(next ? { next } : {}) };
  },
  head: () => seo("Sign in", "Log in or create your Ans2Sans account."),
  component: Auth,
});

function Auth() {
  const { mode: initial, next } = Route.useSearch();
  const [mode, setMode] = useState<Mode>(initial ?? "signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const { setState, online } = useApp();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (mode === "signup" && name.trim().length < 1) errs["name"] = "Tell us what to call you";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errs["email"] = "Enter a valid email address";
    if (password.length < 8) errs["password"] = "Use at least 8 characters";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const res =
        mode === "signup"
          ? await signUpFn({ data: { name, email, password } })
          : await logInFn({ data: { email, password } });
      if (!res.ok) {
        setErrors({ form: res.error });
        return;
      }
      const user = res.user;
      if (mode === "signup") {
        // Fresh account: a clean slate, keeping any answers from the quiz.
        setState((s) => ({
          ...emptyState(),
          user,
          onboarded: false,
          prefs: s.prefs,
        }));
        toast.success(`Welcome aboard, ${user.name}!`);
        void navigate({ to: "/onboarding", search: next ? { next } : {}, replace: true });
      } else {
        const remote = await loadStateFn().catch(() => null);
        const saved = remote ? migrate(remote.state) : null;
        setState((s) =>
          saved
            ? { ...saved, user }
            : s.user?.id === user.id
              ? { ...s, user }
              : { ...emptyState(), user, onboarded: true },
        );
        toast.success(`Welcome back, ${user.name}!`);
        void navigate({ to: next ?? "/", replace: true });
      }
    } catch {
      setErrors({ form: "We couldn't reach the server. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page-enter relative mx-auto flex min-h-screen max-w-md flex-col px-6 py-6">
      <Bubbles className="opacity-70" />
      <Link
        to="/welcome"
        search={next ? { next } : {}}
        aria-label="Back"
        className="tap relative flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-soft"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <Logo withName className="mt-8" />
      <h1 className="mt-6 text-4xl font-semibold tracking-tight">
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-1 text-muted-foreground">
        {mode === "signup" ? "Your next adventure is one step away." : "The sea missed you."}
      </p>

      <form onSubmit={submit} noValidate className="relative mt-8 space-y-4">
        {mode === "signup" && (
          <Field label="Your name" error={errors["name"]}>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Sansa"
            />
          </Field>
        )}
        <Field label="Email" error={errors["email"]}>
          <input
            className={inputCls}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </Field>
        <Field
          label="Password"
          error={errors["password"]}
          hint={mode === "signup" ? "At least 8 characters" : undefined}
        >
          <span className="relative block">
            <input
              className={`${inputCls} pr-12`}
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </span>
        </Field>
        {errors["form"] && (
          <p
            role="alert"
            className="rounded-2xl bg-primary-soft px-4 py-3 text-sm font-bold text-primary-strong"
          >
            {errors["form"]}
          </p>
        )}
        {!online && (
          <p className="rounded-2xl bg-butter px-4 py-3 text-sm font-bold">
            The Ans2Sans server isn't reachable right now.
          </p>
        )}
        <button disabled={busy} className={pillButton({ size: "lg", className: "w-full" })}>
          {busy ? "One moment…" : mode === "signup" ? "Create account" : "Log in"}
        </button>
      </form>

      <p className="relative mt-6 text-center text-sm">
        {mode === "signup" ? "Already have an account? " : "New here? "}
        <button
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setErrors({});
          }}
          className="font-bold text-primary-strong hover:underline"
        >
          {mode === "signup" ? "Log in" : "Create one"}
        </button>
      </p>
      <p className="relative mt-auto pt-8 text-center text-xs text-muted-foreground">
        Your trips and photos are saved to your account and sync across devices.
      </p>
    </main>
  );
}
