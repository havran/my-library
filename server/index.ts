import https from "https";
import { readFileSync } from "fs";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { logger } from "./logger.js";
import { DATA_DIR } from "./db.js";
import { attachUser, requireAuth, seedDefaultAdmin } from "./auth.js";
import { authRouter } from "./routes/auth.js";
import { booksRouter, exportRouter, importRouter } from "./routes/books.js";
import { isbnOcrRouter } from "./routes/isbnOcr.js";
import { cbdbRouter } from "./routes/sources/cbdb.js";
import { legieRouter } from "./routes/sources/legie.js";
import { databazeknihRouter } from "./routes/sources/databazeknih.js";
import { clientErrorRouter } from "./routes/clientError.js";
import {
  globalLimiter,
  writeLimiter,
  scraperLimiter,
  ocrLimiter,
  clientErrorLimiter,
} from "./middleware/rateLimit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3001;
// Certs live alongside the database so rsync deploys can't touch them.
const CERT_DIR = DATA_DIR;

const app = express();
// Trust loopback/LAN proxy so express-rate-limit sees the real client IP.
app.set("trust proxy", "loopback, linklocal, uniquelocal");

// At info/warn/error, emit a compact one-line summary. Full headers/body
// detail is only useful when something's wrong, so dump that at debug level
// via a separate middleware (toggled by LOG_LEVEL=debug).
app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "debug";
    },
    customSuccessMessage: (req, res, time) =>
      `${req.method} ${req.url} ${res.statusCode} ${time}ms`,
    customErrorMessage: (req, res, err) =>
      `${req.method} ${req.url} ${res.statusCode} ${err?.message ?? "err"}`,
    serializers: {
      req: (r) => ({ method: r.method, url: r.url }),
      res: (r) => ({ statusCode: r.statusCode }),
    },
  }),
);
if (logger.isLevelEnabled("debug")) {
  app.use((req, _res, next) => {
    logger.debug(
      { method: req.method, url: req.url, headers: req.headers, query: req.query },
      "req detail",
    );
    next();
  });
}
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));

// Every /api request passes through globalLimiter and gets req.user populated
// if a valid token is present. Individual routes (or requireAuth) decide auth.
app.use("/api", globalLimiter, attachUser);

app.use("/api/auth", authRouter);

// Book CRUD — GETs public, writes protected inside the router.
app.use("/api/books", writeLimiter, booksRouter);
app.use("/api/export", exportRouter);
app.use("/api/import", writeLimiter, importRouter);

// Scrapers + OCR only make sense for authenticated users adding books.
app.use("/api/isbn-ocr", ocrLimiter, requireAuth, isbnOcrRouter);
app.use("/api/cbdb", scraperLimiter, requireAuth, cbdbRouter);
app.use("/api/legie", scraperLimiter, requireAuth, legieRouter);
app.use("/api/databazeknih", scraperLimiter, requireAuth, databazeknihRouter);

// Client error reports are fire-and-forget telemetry — intentionally public so
// unauthenticated errors (e.g. a crash on the login page) still reach us.
app.use("/api/log/client", clientErrorLimiter, clientErrorRouter);

// Static SPA — must come after API routes
const distDir = resolve(__dirname, "../dist");
app.use(express.static(distDir));
app.get(/(.*)/, (_req, res) => {
  res.sendFile(resolve(distDir, "index.html"));
});

await seedDefaultAdmin();

try {
  const ssl = {
    key: readFileSync(resolve(CERT_DIR, "key.pem")),
    cert: readFileSync(resolve(CERT_DIR, "cert.pem")),
  };
  https.createServer(ssl, app).listen(PORT, () => {
    logger.info({ port: PORT, tls: true }, `Library API → https://localhost:${PORT}`);
  });
} catch {
  app.listen(PORT, () => {
    logger.info({ port: PORT, tls: false }, `Library API → http://localhost:${PORT}`);
  });
}
