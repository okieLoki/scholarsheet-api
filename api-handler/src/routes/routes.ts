import { Application } from "express";
import { adminRouter } from "./adminRoutes";
import { statsRouter } from "./statsRoutes";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";

const swaggerDocument = YAML.load("./src/api.yaml");

export const initializeRoutes = (app: Application) => {
  app.use("/admin", adminRouter.routes());
  app.use("/admin/stats", statsRouter.routes());
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};
