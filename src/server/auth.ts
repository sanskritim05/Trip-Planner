/** Email + password accounts with scrypt hashing and httpOnly session cookies (server only). */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import * as db from "./db";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = "a2s_session";
const SESSION_DAYS = 30;

export type PublicUser = { id: string; name: string; email: string; avatar: string | null };
type UserRecord = PublicUser & { salt: string; hash: string; createdAt: string };
type Session = { userId: string; expires: number };

const normEmail = (e: string) => e.trim().toLowerCase();
const strip = ({ id, name, email, avatar }: UserRecord): PublicUser => ({
  id,
  name,
  email,
  avatar,
});

async function hash(password: string, salt: Buffer) {
  return (await scryptAsync(password, salt, 64)).toString("hex");
}

async function startSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await db.put<Session>("sessions", token, { userId, expires: Date.now() + SESSION_DAYS * 864e5 });
  setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export class AuthError extends Error {}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
}): Promise<PublicUser> {
  const email = normEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError("Enter a valid email address");
  if (input.password.length < 8) throw new AuthError("Use at least 8 characters");
  if (input.name.trim().length < 1) throw new AuthError("Tell us what to call you");
  const salt = randomBytes(16);
  const user = await db.update<UserRecord>("users", email, async (existing) => {
    if (existing) throw new AuthError("An account with this email already exists. Try logging in");
    return {
      id: `u_${randomBytes(9).toString("base64url")}`,
      name: input.name.trim().slice(0, 60),
      email,
      avatar: null,
      salt: salt.toString("hex"),
      hash: await hash(input.password, salt),
      createdAt: new Date().toISOString(),
    };
  });
  await db.put("user-index", user.id, { email });
  await startSession(user.id);
  return strip(user);
}

export async function logIn(input: { email: string; password: string }): Promise<PublicUser> {
  const user = await db.get<UserRecord>("users", normEmail(input.email));
  const candidate = await hash(input.password, Buffer.from(user?.salt ?? "00", "hex"));
  if (!user || !timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(user.hash, "hex")))
    throw new AuthError("That email and password don't match");
  await startSession(user.id);
  return strip(user);
}

export async function logOut() {
  const token = getCookie(COOKIE);
  if (token) await db.remove("sessions", token);
  deleteCookie(COOKIE, { path: "/" });
}

export async function currentUser(): Promise<PublicUser | null> {
  const token = getCookie(COOKIE);
  if (!token) return null;
  const session = await db.get<Session>("sessions", token);
  if (!session || session.expires < Date.now()) return null;
  const idx = await db.get<{ email: string }>("user-index", session.userId);
  const user = idx ? await db.get<UserRecord>("users", idx.email) : null;
  return user ? strip(user) : null;
}

export async function requireUser(): Promise<PublicUser> {
  const u = await currentUser();
  if (!u) throw new AuthError("Please log in again");
  return u;
}

export async function updateProfile(patch: {
  name?: string;
  avatar?: string | null;
}): Promise<PublicUser> {
  const me = await requireUser();
  const user = await db.update<UserRecord>("users", me.email, (u) => {
    if (!u) throw new AuthError("Account not found");
    return {
      ...u,
      ...(patch.name ? { name: patch.name.trim().slice(0, 60) } : {}),
      ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
    };
  });
  return strip(user);
}
