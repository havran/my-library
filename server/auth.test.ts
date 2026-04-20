import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Use a deterministic secret + in-memory user store so tests don't touch disk or DB.
process.env.JWT_SECRET = "a".repeat(32);

vi.mock("./db.js", () => {
  const users = new Map<
    string,
    {
      id: string;
      username: string;
      passwordHash: string;
      role: string;
      createdAt: string;
      updatedAt: string;
    }
  >();
  return {
    countUsers: () => users.size,
    getUserById: (id: string) => users.get(id),
    getUserByUsername: (u: string) => Array.from(users.values()).find((x) => x.username === u),
    insertUser: (u: {
      id: string;
      username: string;
      passwordHash: string;
      role: string;
      createdAt: string;
      updatedAt: string;
    }) => {
      users.set(u.id, u);
    },
    updateUserPassword: (id: string, hash: string) => {
      const u = users.get(id);
      if (u) users.set(id, { ...u, passwordHash: hash });
    },
    __users: users,
  };
});

import {
  signToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  requireAuth,
  attachUser,
} from "./auth.js";
import * as db from "./db.js";

type MockedDb = typeof db & { __users: Map<string, { id: string }> };

beforeEach(() => {
  (db as MockedDb).__users.clear();
});

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    cookies: {},
    ...overrides,
  } as unknown as Request;
}

function mockRes() {
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res as Response;
  }) as unknown as Response["status"];
  res.json = vi.fn((b: unknown) => {
    res.body = b;
    return res as Response;
  }) as unknown as Response["json"];
  return res as Response & { statusCode?: number; body?: unknown };
}

describe("signToken / verifyToken", () => {
  it("roundtrips a valid payload", () => {
    const token = signToken({ sub: "u1", username: "alice", role: "admin" });
    const parsed = verifyToken(token);
    expect(parsed).toEqual({ sub: "u1", username: "alice", role: "admin" });
  });

  it("returns null for a tampered token", () => {
    const token = signToken({ sub: "u1", username: "alice", role: "admin" });
    const tampered = token.slice(0, -2) + (token.endsWith("x") ? "yz" : "xx");
    expect(verifyToken(tampered)).toBeNull();
  });

  it("returns null for garbage", () => {
    expect(verifyToken("not-a-jwt")).toBeNull();
  });
});

describe("hashPassword / verifyPassword", () => {
  it("matches the original password", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("hunter2", hash)).toBe(true);
  });

  it("rejects a different password", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("hunter3", hash)).toBe(false);
  });
});

describe("attachUser", () => {
  it("populates req.user when a valid cookie token is present and user exists", () => {
    const token = signToken({ sub: "u1", username: "alice", role: "admin" });
    (db as MockedDb).__users.set("u1", {
      id: "u1",
      username: "alice",
      passwordHash: "x",
      role: "admin",
      createdAt: "",
      updatedAt: "",
    });

    const req = mockReq({ cookies: { mylib_session: token } } as Partial<Request>);
    const next = vi.fn();
    attachUser(req, mockRes(), next as unknown as NextFunction);

    expect(req.user).toEqual({ sub: "u1", username: "alice", role: "admin" });
    expect(next).toHaveBeenCalled();
  });

  it("leaves req.user undefined when the token references a deleted user", () => {
    const token = signToken({ sub: "ghost", username: "ghost", role: "admin" });
    const req = mockReq({ cookies: { mylib_session: token } } as Partial<Request>);
    const next = vi.fn();
    attachUser(req, mockRes(), next as unknown as NextFunction);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("never rejects, even without a token", () => {
    const req = mockReq();
    const next = vi.fn();
    attachUser(req, mockRes(), next as unknown as NextFunction);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("accepts tokens from the Authorization Bearer header", () => {
    const token = signToken({ sub: "u1", username: "alice", role: "admin" });
    (db as MockedDb).__users.set("u1", {
      id: "u1",
      username: "alice",
      passwordHash: "x",
      role: "admin",
      createdAt: "",
      updatedAt: "",
    });

    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const next = vi.fn();
    attachUser(req, mockRes(), next as unknown as NextFunction);

    expect(req.user?.username).toBe("alice");
  });
});

describe("requireAuth", () => {
  it("passes through when req.user is already set", () => {
    const req = mockReq();
    req.user = { sub: "u1", username: "alice", role: "admin" };
    const next = vi.fn();
    const res = mockRes();

    requireAuth(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeUndefined();
  });

  it("returns 401 when no token is present", () => {
    const req = mockReq();
    const next = vi.fn();
    const res = mockRes();

    requireAuth(req, res, next as unknown as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when token is valid but user is missing", () => {
    const token = signToken({ sub: "ghost", username: "ghost", role: "admin" });
    const req = mockReq({ cookies: { mylib_session: token } } as Partial<Request>);
    const next = vi.fn();
    const res = mockRes();

    requireAuth(req, res, next as unknown as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});
