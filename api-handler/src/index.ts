import express, { Application } from "express";
import { config } from "./config";
import morgan from "morgan";
import { adminRouter } from "./routes/adminRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { databaseConnection } from "./config/mongodb";
import { rabbitmq } from "./config/rabbitmq";
import { calculatorService } from "./services/calculator-service/calculator.service";
import { statsRouter } from "./routes/statsRoutes";
import { researcherProfileRouter } from "./routes/reseacherRoute";

const init = async () => {
  const app: Application = express();

  config.verifyConfig();

  await databaseConnection();
  await rabbitmq.rabbitmqConnect();

  app.use(express.json());
  app.use(morgan("dev"));

  // ROUTES
  app.use("/admin", adminRouter.routes());
  app.use("/admin/stats", statsRouter.routes());
  app.use("/admin/reseacher", researcherProfileRouter.routes());

  app.use(errorHandler);

  // RABBMITMQ
  await calculatorService.listenForCalculatorEvents();

  app.listen(config.PORT, async () => {
    console.log(`Server is running on port ${config.PORT}`);
  });
};
init();
