import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db, horoscopeVisualLibraryTable } from "@workspace/db";
import { seedHoroscopeVisualLibrary } from "../lib/horoscope-visual-library";

const router = Router();

router.get("/horoscope/visual-library", async (_req, res, next) => {
  try {
    const rows = await db.select({
      id: horoscopeVisualLibraryTable.id,
      zodiacSign: horoscopeVisualLibraryTable.zodiacSign,
      symbol: horoscopeVisualLibraryTable.symbol,
      label: horoscopeVisualLibraryTable.label,
      kind: horoscopeVisualLibraryTable.kind,
      provider: horoscopeVisualLibraryTable.provider,
      sourceId: horoscopeVisualLibraryTable.sourceId,
      title: horoscopeVisualLibraryTable.title,
      sourceUrl: horoscopeVisualLibraryTable.sourceUrl,
      creator: horoscopeVisualLibraryTable.creator,
      creatorUrl: horoscopeVisualLibraryTable.creatorUrl,
      license: horoscopeVisualLibraryTable.license,
      licenseUrl: horoscopeVisualLibraryTable.licenseUrl,
      attribution: horoscopeVisualLibraryTable.attribution,
      width: horoscopeVisualLibraryTable.width,
      height: horoscopeVisualLibraryTable.height,
      durationSeconds: horoscopeVisualLibraryTable.durationSeconds,
      isActive: horoscopeVisualLibraryTable.isActive,
      createdAt: horoscopeVisualLibraryTable.createdAt,
    }).from(horoscopeVisualLibraryTable)
      .where(eq(horoscopeVisualLibraryTable.isActive, true))
      .orderBy(desc(horoscopeVisualLibraryTable.createdAt));
    return res.json({ assets: rows });
  } catch (error) {
    return next(error);
  }
});

router.post("/horoscope/visual-library/seed", async (_req, res, next) => {
  try {
    const result = await seedHoroscopeVisualLibrary();
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

export default router;