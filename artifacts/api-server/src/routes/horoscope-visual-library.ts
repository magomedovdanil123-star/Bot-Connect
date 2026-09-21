import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db, horoscopeVisualLibraryTable } from "@workspace/db";
import { getHoroscopeSceneVisuals, seedHoroscopeVisualLibrary } from "../lib/horoscope-visual-library";

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

router.get("/horoscope/visual-library/plan", async (req, res, next) => {
  try {
    const topic = typeof req.query.topic === "string" ? req.query.topic : "";
    const sceneCount = Math.min(60, Math.max(1, Number(req.query.sceneCount) || 6));
    const rotationKey = typeof req.query.rotationKey === "string" ? req.query.rotationKey : topic;
    const visuals = await getHoroscopeSceneVisuals(topic, sceneCount, { rotationKey });
    return res.json({
      sceneCount,
      plan: visuals.map((visual, index) => ({
        scene: index + 1,
        kind: visual.kind,
        zodiacSign: visual.zodiacSign,
        label: visual.label,
        provider: visual.provider,
        objectPath: visual.storageAsset.object_path,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

export default router;