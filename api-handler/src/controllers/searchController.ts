import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { ResearcherModel } from "../models/researcher";

export class SearchController {
  public async searchReseacher(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const query = req.query.query as string;

      if (!query) {
        throw new createHttpError.BadRequest("Query is required");
      }

      const researchers = await ResearcherModel.find(
        {
          $text: { $search: query },
        },
        {
          _id: 0,
          name: 1,
          scholar_id: 1,
          department: 1,
        }
      ).lean();

      res.status(200).json(researchers);
    } catch (error) {
      next(error);
    }
  }
}
