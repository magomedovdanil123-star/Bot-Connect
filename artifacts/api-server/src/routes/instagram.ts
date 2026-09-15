import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, instagramConnectionsTable } from "@workspace/db";
import {
  completeInstagramAuthorization,
  createInstagramAuthorizationUrl,
  listInstagramConnections,
} from "../lib/instagram";

const router = Router();

router.get("/instagram/connect", (_req, res, next) => {
  try {
    res.redirect(createInstagramAuthorizationUrl());
  } catch (error) {
    next(error);
  }
});

router.get("/instagram/callback", async (req, res, next): Promise<void> => {
  try {
    const errorDescription = typeof req.query.error_description === "string"
      ? req.query.error_description
      : typeof req.query.error === "string" ? req.query.error : "";
    if (errorDescription) {
      res.status(400).send(`<h1>Instagram не подключён</h1><p>${escapeHtml(errorDescription)}</p>`);
      return;
    }
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !state) {
      res.status(400).send("Instagram authorization was cancelled.");
      return;
    }
    const result = await completeInstagramAuthorization(code, state);
    const names = result.accounts.map((account) => account.username || account.displayName || "без названия").join(", ");
    res.send(`<h1>Instagram подключён</h1><p>Добавлены аккаунты: ${escapeHtml(names)}</p><script>setTimeout(() => window.close(), 1200)</script>`);
  } catch (error) {
    next(error);
  }
});

router.get("/instagram/accounts", async (_req, res, next) => {
  try {
    res.json({ accounts: await listInstagramConnections() });
  } catch (error) {
    next(error);
  }
});

router.delete("/instagram/accounts/:id", async (req, res, next): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid Instagram account id" });
      return;
    }
    const deleted = await db.delete(instagramConnectionsTable)
      .where(eq(instagramConnectionsTable.id, id))
      .returning({ id: instagramConnectionsTable.id });
    if (!deleted.length) {
      res.status(404).json({ error: "Instagram account not found" });
      return;
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character] || character));
}

export default router;