import { Router } from "express";
import { SearchController } from "../controllers/searchController";
import { adminAuthHandler } from "../middleware/authHandler";

class SearchRouter {
  public router: Router;

  constructor() {
    this.router = Router();
  }

  routes() {
    this.router.get(
      "/researcher",
      adminAuthHandler,
      SearchController.prototype.searchReseacher
    );

    return this.router;
  }
}

export const searchRouter = new SearchRouter();
