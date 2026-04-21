import { Router } from "express";
import { getAllUserSettings, setUserSetting } from "../db.js";

export const settingsRouter: Router = Router();

settingsRouter.get("/", (req, res) => {
  const settings = getAllUserSettings(req.user!.sub);
  res.json(settings);
});

settingsRouter.put("/:key", (req, res) => {
  const { key } = req.params;
  if (!key || key.length > 64) {
    res.status(400).json({ error: "invalid key" });
    return;
  }
  if (req.body === undefined) {
    res.status(400).json({ error: "body required" });
    return;
  }
  setUserSetting(req.user!.sub, key, req.body);
  res.json({ ok: true });
});
