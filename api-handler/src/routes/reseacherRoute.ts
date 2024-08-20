import { Router } from "express";
import { ResearcherProfileController } from "../controllers/reseacherProfileController";
import { adminAuthHandler } from "../middleware/authHandler";

class ResearcherProfileRouter {
  public router: Router;

  constructor() {
    this.router = Router();
  }

  routes() {
    this.router.get(
      "/profile/:scholarId",
      //   adminAuthHandler,
      ResearcherProfileController.prototype.fetchResearcherProfile
    );

    this.router.get(
      "/profile/:scholarId/yearVsPublication",
      //   adminAuthHandler,
      ResearcherProfileController.prototype.yearVsPublication
    );

    this.router.get(
      "/profile/:scholarId/publicationsVsHIndex",
      //   adminAuthHandler,
      ResearcherProfileController.prototype.getHIndexYearly
    );

    this.router.get(
      "/profile/:scholarId/domains",
      //   adminAuthHandler,
      ResearcherProfileController.prototype
        .getDomainsThatResearcherHasPublishedIn
    );

    this.router.get(
      "/profile/:scholarId/iIndex",
      //   adminAuthHandler,
      ResearcherProfileController.prototype.getiIndexYearly
    );

    return this.router;
  }
}

export const researcherProfileRouter = new ResearcherProfileRouter();
