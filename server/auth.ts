import { randomBytes, randomUUID } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "fs";
import { dirname, join } from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger.js";
import { countUsers, getUserById, getUserByUsername, insertUser } from "./db.js";

const DATA_DIR = join(process.env.HOME ?? ".", ".local", "share", "my-library");
const SECRET_PATH = join(DATA_DIR, "jwt-secret");

export const COOKIE_NAME = "mylib_session";
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const BCRYPT_COST = 10;

// JWT secret: env var wins (prod), else read/generate a persistent local file so
// tokens survive restarts. In-memory would log everyone out on every dev reload.
function loadOrCreateSecret(): string {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) {
    return process.env.JWT_SECRET;
  }
  try {
    if (existsSync(SECRET_PATH)) return readFileSync(SECRET_PATH, "utf8").trim();
  } catch {
    // fall through
  }
  mkdirSync(dirname(SECRET_PATH), { recursive: true });
  const secret = randomBytes(48).toString("hex");
  writeFileSync(SECRET_PATH, secret, { mode: 0o600 });
  try {
    chmodSync(SECRET_PATH, 0o600);
  } catch {
    // chmod may fail on non-POSIX fs — ok
  }
  logger.info({ path: SECRET_PATH }, "generated new JWT secret");
  return secret;
}

const SECRET = loadOrCreateSecret();

export interface SessionPayload {
  sub: string; // user id
  username: string;
  role: string;
}

export function signToken(payload: SessionPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: TOKEN_TTL_SECONDS });
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    const p = jwt.verify(token, SECRET) as jwt.JwtPayload;
    if (!p.sub || typeof p.sub !== "string") return null;
    return { sub: p.sub, username: String(p.username), role: String(p.role) };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Seed admin/admin on first boot when no users exist
export async function seedDefaultAdmin(): Promise<void> {
  if (countUsers() > 0) return;
  const now = new Date().toISOString();
  const user = {
    id: randomUUID(),
    username: "admin",
    passwordHash: await hashPassword("admin"),
    role: "admin",
    createdAt: now,
    updatedAt: now,
  };
  insertUser(user);
  logger.warn(
    { username: "admin" },
    "seeded default admin user with password 'admin' — change it immediately via Settings",
  );
}

declare module "express-serve-static-core" {
  interface Request {
    user?: SessionPayload;
  }
}

function readToken(req: Request): string | undefined {
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[
    COOKIE_NAME
  ];
  if (cookieToken) return cookieToken;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return undefined;
}

// Populates req.user if a valid token is present; never rejects. Use this for
// endpoints whose behavior depends on auth (e.g. public reads that also want to
// know the current user).
export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload && getUserById(payload.sub)) req.user = payload;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.user) {
    next();
    return;
  }
  const token = readToken(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload || !getUserById(payload.sub)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.user = payload;
  next();
}

export function cookieOptions(isSecure: boolean) {
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: "/",
  };
}
