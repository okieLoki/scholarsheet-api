import express, { Application } from "express";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import { databaseConnection } from "./config/mongodb";
import { rabbitmq } from "./config/rabbitmq";
import { calculatorService } from "./services/calculator-service/calculator.service";
import { initializeRoutes } from "./routes/routes";
import { createServer } from "http";
import { socketService } from "./config/socket";
import morgan from "morgan";
import { l } from "./config/logger";

const init = async () => {
  const app: Application = express();

  config.verifyConfig();

  await databaseConnection();
  await rabbitmq.rabbitmqConnect();

  app.use(express.json());
  app.use(morgan("dev"));

  initializeRoutes(app);

  app.use(errorHandler);

  const httpServer = createServer(app);

  socketService.init(httpServer);

  await calculatorService.listenForCalculatorEvents();

  httpServer.listen(config.PORT, async () => {
    l.info(`Server is running on port ${config.PORT}`);
  });
};

init();
