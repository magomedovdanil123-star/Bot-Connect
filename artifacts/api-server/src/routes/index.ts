import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import imagesRouter from "./images";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(imagesRouter);

export default router;
