import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import imagesRouter from "./images";
import voiceRouter from "./voice";
import storageRouter from "./storage";
import { soundDesignRouter } from "./sound-design";
import videoRouter from "./video";
import youtubeRouter from "./youtube";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(imagesRouter);
router.use(voiceRouter);
router.use(storageRouter);
router.use(soundDesignRouter);
router.use(videoRouter);
router.use(youtubeRouter);

export default router;
