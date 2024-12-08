import pino from "pino";
import { config } from "./index";

export const l = pino({
  name: "api-service",
  level: config.LOG_LEVEL,
});
