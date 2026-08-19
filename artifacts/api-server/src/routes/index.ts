import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import imagesRouter from "./images";
import voiceRouter from "./voice";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(imagesRouter);
router.use(voiceRouter);

export default router;
