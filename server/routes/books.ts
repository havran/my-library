import { Router } from "express";
import {
  getAllBooks,
  getBook,
  addBook,
  updateBook,
  deleteBook,
  searchBooks,
  exportAllBooks,
  importBooks,
  clearAllBooks,
} from "../db.js";
import { requireAuth } from "../auth.js";

export const booksRouter: Router = Router();

// ── Public reads ──────────────────────────────────────────────────────────────

booksRouter.get("/search", (req, res) => {
  const q = String(req.query.q ?? "");
  res.json(searchBooks(q));
});

booksRouter.get("/", (_req, res) => {
  res.json(getAllBooks());
});

booksRouter.get("/:id", (req, res) => {
  const book = getBook(req.params.id);
  if (!book) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(book);
});

// ── Protected writes ──────────────────────────────────────────────────────────

booksRouter.post("/", requireAuth, (req, res) => {
  addBook(req.body);
  res.json({ ok: true });
});

booksRouter.put("/:id", requireAuth, (req, res) => {
  updateBook(String(req.params.id), req.body);
  res.json({ ok: true });
});

booksRouter.delete("/:id", requireAuth, (req, res) => {
  deleteBook(String(req.params.id));
  res.json({ ok: true });
});

booksRouter.delete("/", requireAuth, (_req, res) => {
  clearAllBooks();
  res.json({ ok: true });
});

export const exportRouter: Router = Router();
// Export dumps the full DB — protect it.
exportRouter.get("/", requireAuth, (_req, res) => {
  res.json(exportAllBooks());
});

export const importRouter: Router = Router();
importRouter.post("/", requireAuth, (req, res) => {
  try {
    const count = importBooks(req.body);
    res.json({ count });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import failed";
    res.status(400).json({ error: msg });
  }
});
