import { Router } from "express";
import { adminAuthHandler } from "../middleware/authHandler";
import { AdminStatsController } from "../controllers/adminStatsController";

class StatsRouter {
  public router: Router;

  constructor() {
    this.router = Router();
  }

  routes() {

    this.router.get(
      "/departments",
      adminAuthHandler,
      AdminStatsController.prototype.getDepartments
    )

    this.router.get(
      "/card-data",
      adminAuthHandler,
      AdminStatsController.prototype.getCardStatsData
    );

    this.router.get(
      "/analytics-graph",
      adminAuthHandler,
      AdminStatsController.prototype.getAnalyticsGraphData
    );

    this.router.get(
      "/top-researchers",
      adminAuthHandler,
      AdminStatsController.prototype.getTopResearchersData
    );

    this.router.get(
      "/research-topics",
      adminAuthHandler,
      AdminStatsController.prototype.getResearchTopicsData
    );

    this.router.get(
      "/journal-diversity",
      adminAuthHandler,
      AdminStatsController.prototype.getJournalDiversityData
    );

    this.router.get(
      "/filter-data",
      adminAuthHandler,
      AdminStatsController.prototype.getPreFilterData
    );

    this.router.post(
      "/top-publications",
      adminAuthHandler,
      AdminStatsController.prototype.getTopPublicationsData
    );

    this.router.get(
      "/rank", 
      adminAuthHandler,
      AdminStatsController.prototype.getRankData
    )

    return this.router;
  }
}

export const adminStatsRouter = new StatsRouter();
