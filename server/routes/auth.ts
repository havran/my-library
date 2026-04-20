import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  COOKIE_NAME,
  cookieOptions,
  hashPassword,
  requireAuth,
  signToken,
  verifyPassword,
} from "../auth.js";
import { getUserById, getUserByUsername, updateUserPassword } from "../db.js";
import { logger } from "../logger.js";

export const authRouter: Router = Router();

// Tight limiter just for login — blunts brute-force against passwords.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "username and password required" });
    return;
  }

  const user = getUserByUsername(username);
  // Constant-time-ish: always run bcrypt.compare, even if user missing, against
  // a dummy hash so timing doesn't leak whether the username exists.
  const hash = user?.passwordHash ?? "$2a$10$invalid.invalid.invalid.invalid.invalid.invalid.inva";
  const ok = await verifyPassword(password, hash);

  if (!user || !ok) {
    logger.warn({ username, ip: req.ip }, "login failed");
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const token = signToken({ sub: user.id, username: user.username, role: user.role });
  res.cookie(COOKIE_NAME, token, cookieOptions(req.secure));
  logger.info({ username: user.username }, "login success");
  res.json({ user: { username: user.username, role: user.role } });
});

authRouter.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  if (req.user) logger.info({ username: req.user.username }, "logout");
  res.json({ ok: true });
});

authRouter.get("/me", (req, res) => {
  if (!req.user) {
    res.json({ user: null });
    return;
  }
  const db = getUserById(req.user.sub);
  if (!db) {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ user: null });
    return;
  }
  res.json({ user: { username: db.username, role: db.role } });
});

authRouter.post("/password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = (req.body ?? {}) as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "currentPassword and newPassword required" });
    return;
  }
  if (newPassword.length < 4) {
    res.status(400).json({ error: "newPassword must be at least 4 characters" });
    return;
  }

  const user = getUserById(req.user!.sub);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    logger.warn({ username: user.username }, "password change: current password mismatch");
    res.status(403).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await hashPassword(newPassword);
  updateUserPassword(user.id, newHash);
  // Rotate the cookie so the freshly-hashed-at timestamp is reflected (defensive).
  const token = signToken({ sub: user.id, username: user.username, role: user.role });
  res.cookie(COOKIE_NAME, token, cookieOptions(req.secure));
  logger.info({ username: user.username }, "password changed");
  res.json({ ok: true });
});
