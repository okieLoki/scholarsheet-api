import { NextFunction, Request, Response } from "express";
import { PaperModel } from "../models/paper";
import createHttpError from "http-errors";
import { ResearcherModel } from "../models/researcher";

export class ResearcherProfileController {
  public async fetchResearcherProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const scholar_id = req.params.scholarId;

      const researcher = await ResearcherModel.findOne({
        scholar_id,
      });

      if (!researcher) {
        throw new createHttpError.NotFound("Researcher not found");
      }

      res.status(200).json({
        status: "success",
        researcher,
      });
    } catch (error) {
      next(error);
    }
  }

  public async yearVsPublication(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const scholar_id = req.params.scholarId;
      const limit = parseInt(req.query.limit as string) || 10;

      const papers = await PaperModel.find({
        "researcher.scholar_id": scholar_id,
      });

      const yearVsPublication = {};

      for (const paper of papers) {
        const yearOfPublication = paper.publicationDate;

        if (yearVsPublication[yearOfPublication]) {
          yearVsPublication[yearOfPublication] += 1;
        } else {
          yearVsPublication[yearOfPublication] = 1;
        }
      }

      res.status(200).json({
        status: "success",
        yearVsPublication: Object.entries(yearVsPublication).slice(0, limit),
      });
    } catch (error) {
      next(error);
    }
  }

  public async getDomainsThatResearcherHasPublishedIn(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const scholar_id = req.params.scholarId;

      const papers = await PaperModel.find(
        {
          "researcher.scholar_id": scholar_id,
        },
        {
          tags: 1,
        }
      ).lean();

      const domains = {};

      papers.forEach((paper) => {
        paper.tags.forEach((tag) => {
          if (domains[tag]) {
            domains[tag] += 1;
          } else {
            domains[tag] = 1;
          }
        });
      });

      res.status(200).json({
        domains,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getHIndexYearly(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const scholar_id = req.params.scholarId;

      const papers = await PaperModel.find({
        "researcher.scholar_id": scholar_id,
      })
        .sort({
          publicationDate: 1,
        })
        .lean();

      const yearlyHIndex = {};
      const cumulativePapers = [];

      papers.forEach((paper) => {
        const year = paper.publicationDate;

        // @ts-ignore
        cumulativePapers.push(paper);

        const citations = cumulativePapers

          // @ts-ignore
          .map((p) => p.totalCitations)
          .sort((a, b) => b - a);
        let hIndex = 0;
        for (let i = 0; i < citations.length; i++) {
          if (citations[i] >= i + 1) {
            hIndex = i + 1;
          } else {
            break;
          }
        }

        yearlyHIndex[year] = hIndex;
      });

      // Sort the result by year
      const sortedResult = Object.fromEntries(
        Object.entries(yearlyHIndex).sort(
          ([a], [b]) => parseInt(a) - parseInt(b)
        )
      );

      res.json(sortedResult);
    } catch (error) {
      next(error);
    }
  }

  public async getiIndexYearly(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const scholar_id = req.params.scholarId;
      const iValue = parseInt(req.query.iValue as string) || 10;

      const papers = await PaperModel.find({
        "researcher.scholar_id": scholar_id,
      })
        .sort({
          publicationDate: 1,
        })
        .lean();

      const yearlyIIndex = {};

      const cumulativePapers = [];

      papers.forEach((paper) => {
        const year = paper.publicationDate;

        // @ts-ignore
        cumulativePapers.push(paper);

        const citations = cumulativePapers

          // @ts-ignore
          .map((p) => p.totalCitations)
          .sort((a, b) => b - a);
        let iIndex = 0;
        for (let i = 0; i < citations.length; i++) {
          if (citations[i] >= iValue) {
            iIndex = i + 1;
          } else {
            break;
          }
        }

        yearlyIIndex[year] = iIndex;
      });

      const sortedResult = Object.fromEntries(
        Object.entries(yearlyIIndex).sort(
          ([a], [b]) => parseInt(a) - parseInt(b)
        )
      );

      res.json(sortedResult);
    } catch (error) {
      next(error);
    }
  }
}

export const researcherProfileController = new ResearcherProfileController();
