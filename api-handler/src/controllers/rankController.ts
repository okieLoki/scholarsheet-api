import { NextFunction, Request, Response } from "express";
import { rankService } from "../lib/services/rankService";
import createError from "http-errors";

export class RankController {
  public async getRankData(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = req.admin;
      const criteria = req.query.criteria as string;

      if (!criteria) {
        throw new createError.BadRequest("Criteria is required");
      }

      if (["totalPapers", "citations"].indexOf(criteria) === -1) {
        throw new createError.BadRequest(
          "Invalid criteria, must be either totalPapers or citations"
        );
      }

      const rankings = await rankService.getAllRanks(criteria);

      let instituteRank;

      rankings.forEach((entry, index) => {
        entry.rank = index + 1;
        if (entry._id && entry._id.equals(admin.id)) {
          instituteRank = entry.rank;
        }
      });

      res.status(200).json({
        instituteRank,
        rankings,
      });
    } catch (error) {
      next(error);
    }
  }
}
