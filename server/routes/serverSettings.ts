import { Router, type Request, type Response, type NextFunction } from "express";
import { setServerSetting } from "../db.js";
import {
  OCR_PROVIDERS,
  getConfiguredProviderId,
  isOcrProviderId,
  resetOcrProvider,
} from "../ocr/index.js";

export const serverSettingsRouter: Router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

serverSettingsRouter.get("/", (_req, res) => {
  res.json({
    ocrProvider: getConfiguredProviderId(),
    ocrProviders: [...OCR_PROVIDERS],
  });
});

serverSettingsRouter.put("/ocr-provider", requireAdmin, (req, res) => {
  const { provider } = (req.body ?? {}) as { provider?: unknown };
  if (!isOcrProviderId(provider)) {
    res.status(400).json({ error: "invalid provider" });
    return;
  }
  setServerSetting("ocr_provider", provider);
  resetOcrProvider();
  res.json({ ok: true, ocrProvider: provider });
});
