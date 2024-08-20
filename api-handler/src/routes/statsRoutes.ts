import { Router } from "express";
import { StatsController } from "../controllers/statsController";
import { adminAuthHandler } from "../middleware/authHandler";

class StatsRouter {
  public router: Router;

  constructor() {
    this.router = Router();
  }

  routes() {
    this.router.get(
      "/publications/yearwise",
      adminAuthHandler,
      StatsController.prototype.totalPublicationsYearWise
    );
    this.router.get(
      "/publications/department",
      adminAuthHandler,
      StatsController.prototype.totalPublicationsDepartmentWise
    );
    this.router.get(
      "/publications/department/yearwise",
      adminAuthHandler,
      StatsController.prototype.totalPublicationsofDepartmentYearWise
    );
    this.router.get(
      "/researchers/department/top",
      adminAuthHandler,
      StatsController.prototype
        .topResearchersAcrossDepartmentsAccordingToCitations
    );
    this.router.get(
      "/tags/publication/top",
      adminAuthHandler,
      StatsController.prototype.topTagsOfPublication
    );
    this.router.get(
      "/publications/average-citations",
      adminAuthHandler,
      StatsController.prototype.averageCitationsPerPaper
    );
    this.router.get(
      "/publications/most-cited",
      adminAuthHandler,
      StatsController.prototype.mostCitedPapers
    );
    this.router.get(
      "/publications/trends",
      adminAuthHandler,
      StatsController.prototype.publicationTrends
    );
    this.router.get(
      "/researchers/collaboration-network",
      adminAuthHandler,
      StatsController.prototype.researcherCollaborationNetwork
    );
    this.router.get(
      "/researchers/productivity",
      adminAuthHandler,
      StatsController.prototype.researcherProductivity
    );
    this.router.get(
      "/departments/comparison",
      adminAuthHandler,
      StatsController.prototype.departmentComparison
    );
    this.router.get(
      "/publications/journal-diversity",
      adminAuthHandler,
      StatsController.prototype.journalDiversity
    );
    this.router.get(
      "/researchers/growth",
      adminAuthHandler,
      StatsController.prototype.researcherGrowth
    );
    

    return this.router;
  }

  
}

export const statsRouter = new StatsRouter();
