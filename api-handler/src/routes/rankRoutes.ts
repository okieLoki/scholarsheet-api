import { Router } from "express";
import { adminAuthHandler } from "../middleware/authHandler";
import { RankController } from "../controllers/rankController";

class RankRouter {
  public router: Router;

  constructor() {
    this.router = Router();
  }

  routes() {
    this.router.get(
      "/",
      adminAuthHandler,
      RankController.prototype.getRankData
    );

    return this.router;
  }
}

export const rankRouter = new RankRouter();
