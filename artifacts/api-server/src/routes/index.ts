import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import imagesRouter from "./images";
import voiceRouter from "./voice";
import storageRouter from "./storage";
import localStorageRouter from "./local-storage";
import { soundDesignRouter } from "./sound-design";
import videoRouter from "./video";
import youtubeRouter from "./youtube";
import uploadsRouter from "./uploads";
import instagramRouter from "./instagram";
import horoscopeVisualLibraryRouter from "./horoscope-visual-library";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(imagesRouter);
router.use(voiceRouter);
router.use(storageRouter);
router.use(localStorageRouter);
router.use(soundDesignRouter);
router.use(videoRouter);
router.use(youtubeRouter);
router.use(uploadsRouter);
router.use(instagramRouter);
router.use(horoscopeVisualLibraryRouter);

export default router;
