import { Router, type IRouter } from "express";
import healthRouter from "./health";
import deltaInstallRouter from "./delta-install";
import cocoXSignRouter from "./cocox-sign";
import authRouter from "./auth";
import cocoXInstallRouter from "./cocox-installs";
import cocoXIpShareRouter from "./cocox-ip-share";
import namedScriptsRouter from "./named-scripts";

const router: IRouter = Router();
router.use(namedScriptsRouter);
router.use(cocoXIpShareRouter);

router.use(healthRouter);
router.use(deltaInstallRouter);
router.use(cocoXSignRouter);
router.use(authRouter);
router.use(cocoXInstallRouter);

export default router;
