import { config } from "../constants/config.js";
import mongoose from "mongoose";

export const databaseConnection = async () => {
  mongoose.connect(config.DATABASE_URL);

  const db = mongoose.connection;

  db.on("error", console.error.bind(console, "connection error:"));
  db.once("open", () => {
    console.log("Connected to database");
  });
};
