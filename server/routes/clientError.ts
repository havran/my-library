import { Router, type Request } from "express";
import { logger } from "../logger.js";

export const clientErrorRouter: Router = Router();

interface ClientErrorPayload {
  level?: "error" | "warn" | "info";
  message?: string;
  stack?: string;
  url?: string;
  context?: Record<string, unknown>;
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) + "…" : value;
}

clientErrorRouter.post("/", (req: Request, res) => {
  const body = (req.body ?? {}) as ClientErrorPayload;
  const level = body.level === "warn" || body.level === "info" ? body.level : "error";

  logger[level](
    {
      source: "client",
      message: body.message ? truncate(String(body.message), 2000) : "(no message)",
      stack: body.stack ? truncate(String(body.stack), 8000) : undefined,
      clientUrl: body.url,
      context: body.context,
      ua: req.headers["user-agent"],
    },
    "client error",
  );
  res.json({ ok: true });
});
