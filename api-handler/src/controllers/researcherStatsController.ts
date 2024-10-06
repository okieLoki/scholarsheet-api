import { NextFunction, Request, Response } from "express";
import { PaperModel } from "../models/paper";
import { ResearcherModel } from "../models/researcher";
import { PublicationFetchingFiltersResearcher } from "../types";
import { publicationFetchingFiltersValidator } from "../lib/validators";
import mongoose, { PipelineStage } from "mongoose";
import createHttpError from "http-errors";

export class ResearcherStatsController {
  public async getResearcherData(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin_id = req.admin.id as string;
      const scholar_id = req.query.scholar_id as string;

      if (!scholar_id) {
        throw new createHttpError.BadRequest("Scholar ID is required");
      }

      const researcher = await ResearcherModel.findOne(
        {
          admin_id,
          scholar_id,
        },
        {
          name: 1,
          scholar_id: 1,
          email: 1,
          department: 1,
          citations: 1,
          h_index: 1,
          i_index: 1,
          totalPapers: 1,
          positions: 1,
          admin_id: 1,
        }
      )
        .populate({
          path: "admin_id",
          select: "institute_name",
        })
        .lean();

      if (!researcher) {
        throw new createHttpError.NotFound("Researcher not found");
      }

      res.status(200).json(researcher);
    } catch (error) {
      next(error);
    }
  }

  async getCardStatsData(req: Request, res: Response, next: NextFunction) {
    try {
      const admin_id = req.admin.id as string;
      const scholar_id = req.query.scholar_id as string;

      if (!scholar_id) {
        throw new createHttpError.BadRequest("Scholar ID is required");
      }

      const [researcher, papers] = await Promise.all([
        ResearcherModel.findOne({ admin_id, scholar_id }),
        PaperModel.find({
          "researcher.scholar_id": scholar_id,
        }),
      ]);

      if (!researcher) {
        throw new createHttpError.NotFound("Researcher not found");
      }

      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      const currentYearCitations = papers.reduce(
        (sum, paper) => sum + (paper.totalCitations || 0),
        0
      );
      const lastYearCitations = researcher.citations || 0;

      const citationIncrease =
        ((currentYearCitations - lastYearCitations) / lastYearCitations) * 100;

      const totalPapersCurrentYear = papers.filter((paper) => {
        const publicationYear = new Date(paper.publicationDate).getFullYear();
        return publicationYear === currentYear;
      }).length;

      const totalPapersLastYear = papers.filter((paper) => {
        const publicationYear = new Date(paper.publicationDate).getFullYear();
        return publicationYear === lastYear;
      }).length;

      const totalPapersIncrease =
        ((totalPapersCurrentYear - totalPapersLastYear) / totalPapersLastYear) *
        100;

      const response = {
        citations: {
          [currentYear]: currentYearCitations,
          [lastYear]: lastYearCitations,
          increasePercentage: citationIncrease.toFixed(2),
        },
        totalPapers: {
          [currentYear]: totalPapersCurrentYear,
          [lastYear]: totalPapersLastYear,
          total: papers.length,
          increasePercentage: totalPapersIncrease.toFixed(2),
        },
        hIndex: researcher.h_index || 0,
        i10Index: researcher.i_index || 0,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getAnalyticsGraphData(req: Request, res: Response, next: NextFunction) {
    try {
      const admin_id = req.admin.id as string;
      const scholar_id = req.query.scholar_id as string;
      const criteria = req.query.criteria as string;

      if (
        !["totalPapers", "totalCitations", "hIndex", "i10Index"].includes(
          criteria
        )
      ) {
        throw new createHttpError.BadRequest(
          "Invalid criteria, must be either totalPapers, totalCitations, hIndex or i10Index"
        );
      }

      const pipeline: PipelineStage[] = [
        {
          $match: {
            "researcher.scholar_id": scholar_id,
            admin_id: admin_id,
            publicationDate: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$publicationDate",
            papers: {
              $push: {
                citations: "$totalCitations",
              },
            },
            count: { $sum: 1 },
            totalCitations: { $sum: "$totalCitations" },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ];

      const result = await PaperModel.aggregate(pipeline);

      let graphData;
      let cumulativePapers: any[] = [];

      switch (criteria) {
        case "totalPapers":
          graphData = result.map((item) => ({
            year: parseInt(item._id),
            value: item.count,
          }));
          break;
        case "totalCitations":
          graphData = result.map((item) => ({
            year: parseInt(item._id),
            value: item.totalCitations,
          }));
          break;
        case "hIndex":
        case "i10Index":
          graphData = result.map((item, index) => {
            cumulativePapers = [...cumulativePapers, ...item.papers];
            const sortedCitations = cumulativePapers
              .map((p) => p.citations)
              .sort((a, b) => b - a);

            let h = 0;
            while (h < sortedCitations.length && sortedCitations[h] >= h + 1) {
              h++;
            }

            const i10Count = cumulativePapers.filter(
              (p) => p.citations >= 10
            ).length;

            return {
              year: parseInt(item._id),
              value: criteria === "hIndex" ? h : i10Count,
            };
          });
          break;
      }

      const nullDatePapers = await PaperModel.find({
        "researcher.scholar_id": scholar_id,
        admin_id: admin_id,
        publicationDate: null,
      });

      if (nullDatePapers.length > 0) {
        const nullYearData = { year: null, value: 0 };
        switch (criteria) {
          case "totalPapers":
            nullYearData.value = nullDatePapers.length;
            break;
          case "totalCitations":
            nullYearData.value = nullDatePapers.reduce(
              (sum, paper) => sum + (paper.totalCitations || 0),
              0
            );
            break;
          case "hIndex":
          case "i10Index":
            cumulativePapers = [
              ...cumulativePapers,
              ...nullDatePapers.map((p) => ({
                citations: p.totalCitations || 0,
              })),
            ];
            const sortedCitations = cumulativePapers
              .map((p) => p.citations)
              .sort((a, b) => b - a);

            let h = 0;
            while (h < sortedCitations.length && sortedCitations[h] >= h + 1) {
              h++;
            }

            const i10Count = cumulativePapers.filter(
              (p) => p.citations >= 10
            ).length;

            nullYearData.value = criteria === "hIndex" ? h : i10Count;
            break;
        }
        graphData.push(nullYearData);
      }

      res.status(200).json(graphData);
    } catch (error) {
      next(error);
    }
  }

  async getTopResearchersInTheSameDepartmentData(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin_id = req.admin.id as string;
      const scholar_id = req.query.scholar_id as string;
      const criteria = req.query.criteria as string;
      const limit = parseInt(req.query.limit as string) || 5;

      if (!scholar_id) {
        throw new createHttpError.BadRequest("Scholar ID is required");
      }

      if (
        !["totalPapers", "citations", "h_index", "i_index"].includes(criteria)
      ) {
        throw new createHttpError.BadRequest("Invalid criteria");
      }

      // First, get the department of the specified scholar
      const specifiedScholar = await ResearcherModel.findOne({
        scholar_id,
        admin_id,
      });
      if (!specifiedScholar) {
        throw new createHttpError.NotFound("Specified scholar not found");
      }

      const pipeline: mongoose.PipelineStage[] = [
        {
          $match: {
            admin_id: new mongoose.Types.ObjectId(admin_id),
            department: specifiedScholar.department,
          },
        },
        { $sort: { [criteria]: -1 } },
        {
          $setWindowFields: {
            sortBy: { [criteria]: -1 },
            output: {
              rank: {
                $rank: {},
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            scholar_id: 1,
            department: 1,
            totalPapers: 1,
            citations: 1,
            h_index: 1,
            i_index: 1,
            rank: 1,
          },
        },
      ];

      const allResearchers = await ResearcherModel.aggregate(pipeline);

      const specifiedResearcher = allResearchers.find(
        (r) => r.scholar_id === scholar_id
      );
      const researcherRank = specifiedResearcher
        ? specifiedResearcher.rank
        : null;

      const topResearchers = allResearchers.slice(0, limit);

      if (
        specifiedResearcher &&
        !topResearchers.some((r) => r.scholar_id === scholar_id)
      ) {
        topResearchers.push(specifiedResearcher);
      }

      res.status(200).json({
        topResearchers,
        researcher: {
          rank: researcherRank,
          ...specifiedResearcher,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getReseachTopicsData(req: Request, res: Response, next: NextFunction) {
    try {
      const admin_id = req.admin.id as string;
      const scholar_id = req.query.scholar_id as string;

      if (!scholar_id) {
        throw new createHttpError.BadRequest("Scholar ID is required");
      }

      const tags = await PaperModel.aggregate([
        {
          $match: {
            "researcher.scholar_id": scholar_id,
            admin_id: new mongoose.Types.ObjectId(admin_id),
          },
        },
        {
          $unwind: "$tags",
        },
        {
          $group: {
            _id: "$tags",
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      res.status(200).json(tags);
    } catch (error) {
      next(error);
    }
  }

  async getJournalDiversityData(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin_id = req.admin.id as string;
      const scholar_id = req.query.scholar_id as string;

      if (!scholar_id) {
        throw new createHttpError.BadRequest("Scholar ID is required");
      }

      const journals = await PaperModel.aggregate([
        {
          $match: {
            "researcher.scholar_id": scholar_id,
            admin_id: new mongoose.Types.ObjectId(admin_id),
          },
        },
        {
          $group: {
            _id: "$journal",
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      res.status(200).json(journals);
    } catch (error) {
      next(error);
    }
  }

  async getPreFilterData(req: Request, res: Response, next: NextFunction) {
    try {
      const admin_id = req.admin.id as string;
      const scholar_id = req.query.scholar_id as string;

      if(!scholar_id){
        throw new createHttpError.BadRequest("Scholar ID is required");
      }

      const researcher = await ResearcherModel.findOne({
        admin_id,
        scholar_id,
      });

      if (!researcher)
        throw new createHttpError.NotFound("Researcher not found");

      const pipeline: PipelineStage[] = [
        {
          $match: {
            admin_id: new mongoose.Types.ObjectId(admin_id),
            "researcher.scholar_id": scholar_id,
          },
        },
        { $unwind: { path: "$tags", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: null,
            years: {
              $addToSet: { $substr: ["$publicationDate", 0, 4] },
            },
            journals: { $addToSet: "$journal" },
            topics: {
              $addToSet: {
                $cond: {
                  if: { $isArray: "$tags" },
                  then: {
                    $reduce: {
                      input: "$tags",
                      initialValue: [],
                      in: {
                        $concatArrays: ["$$value", { $ifNull: ["$$this", []] }],
                      },
                    },
                  },
                  else: "$tags",
                },
              },
            },
            citationsRange: {
              $push: "$totalCitations",
            },
          },
        },
        {
          $project: {
            _id: 0,
            years: 1,
            journals: 1,
            topics: 1,
            minCitations: { $min: "$citationsRange" },
            maxCitations: { $max: "$citationsRange" },
          },
        },
      ];

      const result = await PaperModel.aggregate(pipeline);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getTopPublicationsData(
    req: Request,
    res: Response,
    next: NextFunction
  ){
    try {
      const admin_id = req.admin.id as string;
      const scholar_id = req.query.scholar_id as string;
      const filters = req.body as PublicationFetchingFiltersResearcher;
      if (!scholar_id) {
        throw new createHttpError.BadRequest("Scholar ID is required");
      }

    } catch (error) {
      next(error);
    }
  }
}
