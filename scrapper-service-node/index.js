import express from "express";
import { databaseConnection } from "./config/dbConnection.js";
import { rabbitMq } from "./config/rabbitmq.js";
import { l } from "./config/logger.js";
import { config } from "./constants/config.js";
import { scrapperEventHandler } from "./services/handlers/scrapperEventHandler.js";

const init = async () => {
  try {
    await databaseConnection();
    await rabbitMq.rabbitmqConnect();

    const app = express();

    app.use(express.json());

    app.get("/", (req, res) => {
      res.status(200).json({
        message: "Scrapper service is running",
      });
    });

    app.listen(config.PORT || 3000);

    await scrapperEventHandler.listenForCalculatorEvents();
  } catch (error) {
    l.error("Error initializing app:", error);
  }
};

init();
