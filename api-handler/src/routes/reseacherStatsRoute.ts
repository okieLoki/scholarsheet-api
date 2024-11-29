import { Router } from "express";
import { ResearcherStatsController } from "../controllers/researcherStatsController";
import { adminAuthHandler } from "../middleware/authHandler";

class ResearcherStatsRouter {
  public router: Router;

  constructor() {
    this.router = Router();
  }

  routes() {
    this.router.get(
      "/profile",
      adminAuthHandler,
      ResearcherStatsController.prototype.getResearcherData
    );

    this.router.get(
      "/card-data",
      adminAuthHandler,
      ResearcherStatsController.prototype.getCardStatsData
    );

    this.router.get(
      "/analytics-graph",
      adminAuthHandler,
      ResearcherStatsController.prototype.getAnalyticsGraphData
    );

    this.router.get(
      "/top-researchers-department",
      adminAuthHandler,
      ResearcherStatsController.prototype
        .getTopResearchersInTheSameDepartmentData
    );

    this.router.get(
      "/research-topics",
      adminAuthHandler,
      ResearcherStatsController.prototype.getReseachTopicsData
    );

    this.router.get(
      "/journal-diversity",
      adminAuthHandler,
      ResearcherStatsController.prototype.getJournalDiversityData
    );

    this.router.get(
      "/filter-data",
      adminAuthHandler,
      ResearcherStatsController.prototype.getPreFilterData
    );

    this.router.post(
      "/top-publications",
      adminAuthHandler,
      ResearcherStatsController.prototype.getTopPublicationsData
    );

    this.router.get(
      "/year-range",
      adminAuthHandler,
      ResearcherStatsController.prototype.getStatsDataForYearRange
    );

    return this.router;
  }
}

export const reseacherStatsRouter = new ResearcherStatsRouter();
