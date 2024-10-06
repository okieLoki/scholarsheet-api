import { Application } from "express";
import { adminRouter } from "./adminRoutes";
import { adminStatsRouter } from "./adminStatsRoutes";
import { reseacherStatsRouter } from "./reseacherStatsRoute";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import { searchRouter } from "./searchRoutes";

const swaggerDocument = YAML.load("./src/api.yaml");

export const initializeRoutes = (app: Application) => {
  app.use("/admin", adminRouter.routes());
  app.use("/admin/stats", adminStatsRouter.routes());
  app.use("/researcher/stats", reseacherStatsRouter.routes());
  app.use("/search", searchRouter.routes());
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};
