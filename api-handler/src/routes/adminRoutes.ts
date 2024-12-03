import { Router } from "express";
import { AdminController } from "../controllers/adminController";
import { adminAuthHandler } from "../middleware/authHandler";
import { ResearcherManagementController } from "../controllers/researcherManagementController";

class AdminRouter {
  public router: Router;

  constructor() {
    this.router = Router();
  }

  routes() {
    this.router.post("/signup", AdminController.prototype.createAdminAccount);
    this.router.get(
      "/email/verify",
      AdminController.prototype.verifyAdminAccount
    );

    this.router.post("/login", AdminController.prototype.loginAdminAccount);

    this.router.post(
      "/researcher",
      adminAuthHandler,
      AdminController.prototype.addResearcher
    );

    this.router.delete(
      "/researcher/delete",
      adminAuthHandler,
      ResearcherManagementController.prototype.deleteResearcher
    );

    this.router.get(
      "/researchers",
      adminAuthHandler,
      ResearcherManagementController.prototype.getAllResearchers
    )

    this.router.put(
      "/researcher/update/:id",
      adminAuthHandler,
      ResearcherManagementController.prototype.updateResearcher
    )

    this.router.post(
      "/department",
      adminAuthHandler,
      AdminController.prototype.addDepartments
    );

    return this.router;
  }
}

export const adminRouter = new AdminRouter();
