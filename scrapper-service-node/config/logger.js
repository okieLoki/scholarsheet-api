import pino from "pino";
import { config } from "../constants/config.js";

export const l = pino({
  name: "api-service",
  level: config.LOG_LEVEL,
});
