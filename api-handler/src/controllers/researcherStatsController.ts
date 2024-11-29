import { NextFunction, Request, Response } from "express";
import { PaperModel } from "../models/paper";
import { ResearcherModel } from "../models/researcher";
import { PublicationFetchingFiltersResearcher } from "../types";
import { publicationFetchingFiltersValidatorResearcher } from "../lib/validators";
import mongoose, { PipelineStage } from "mongoose";
import createHttpError from "http-errors";
import { config } from "../config";

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

  public async getCardStatsData(
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

      const citationsByYear = papers.reduce((acc, paper) => {
        const publicationYear = new Date(paper.publicationDate).getFullYear();
        if (!acc[publicationYear]) {
          acc[publicationYear] = 0;
        }
        acc[publicationYear] += paper.totalCitations || 0;
        return acc;
      }, {} as Record<number, number>);

      const currentYearCitations = Object.entries(citationsByYear).reduce(
        (sum, [year, citations]) => {
          return sum + (parseInt(year) <= currentYear ? citations : 0);
        },
        0
      );

      const lastYearCitations = Object.entries(citationsByYear).reduce(
        (sum, [year, citations]) => {
          return sum + (parseInt(year) <= lastYear ? citations : 0);
        },
        0
      );

      const citationIncrease =
        lastYearCitations !== 0
          ? ((currentYearCitations - lastYearCitations) / lastYearCitations) *
            100
          : 100;

      const totalPapersCurrentYear = papers.filter((paper) => {
        const publicationYear = new Date(paper.publicationDate).getFullYear();
        return publicationYear === currentYear;
      }).length;

      const totalPapersLastYear = papers.filter((paper) => {
        const publicationYear = new Date(paper.publicationDate).getFullYear();
        return publicationYear === lastYear;
      }).length;

      const totalPapersIncrease =
        totalPapersLastYear !== 0
          ? ((totalPapersCurrentYear - totalPapersLastYear) /
              totalPapersLastYear) *
            100
          : 100;

      const response = {
        citations: {
          [currentYear]: currentYearCitations,
          [lastYear]: lastYearCitations,
          growth:
            citationIncrease > 0
              ? `${citationIncrease.toFixed(2)}% increase`
              : `${Math.abs(citationIncrease).toFixed(2)}% decrease`,
        },
        publications: {
          [currentYear]: totalPapersCurrentYear,
          [lastYear]: totalPapersLastYear,
          growth:
            totalPapersIncrease > 0
              ? `${totalPapersIncrease.toFixed(2)}% increase`
              : `${Math.abs(totalPapersIncrease).toFixed(2)}% decrease`,
        },
        totalPapers: papers.length || 0,
        hIndex: researcher.h_index || 0,
        i10Index: researcher.i_index || 0,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public async getAnalyticsGraphData(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
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

  public async getTopResearchersInTheSameDepartmentData(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin_id = req.admin.id as string;
      const scholar_id = req.query.scholar_id as string;
      const criteria = req.query.criteria as string;
      const limit = parseInt(req.query.limit as string) || 5;
      const page = parseInt(req.query.page as string) || 1;

      if (limit > config.API_LIMIT) {
        throw new createHttpError.BadRequest(
          `Limit exceeds the maximum limit of ${config.API_LIMIT}`
        );
      }

      if (!scholar_id) {
        throw new createHttpError.BadRequest("Scholar ID is required");
      }

      if (
        !["totalPapers", "citations", "h_index", "i_index"].includes(criteria)
      ) {
        throw new createHttpError.BadRequest("Invalid criteria");
      }

      const specifiedScholar = await ResearcherModel.findOne({
        scholar_id,
        admin_id,
      }).lean();
      if (!specifiedScholar) {
        throw new createHttpError.NotFound("Specified scholar not found");
      }

      const department = specifiedScholar.department;

      const pipeline: mongoose.PipelineStage[] = [
        {
          $match: {
            admin_id: new mongoose.Types.ObjectId(admin_id),
            department,
          },
        },
        { $sort: { [criteria]: -1 } },
        {
          $setWindowFields: {
            sortBy: { [criteria]: -1 },
            output: {
              rank: { $rank: {} },
            },
          },
        },
        {
          $facet: {
            metadata: [
              { $count: "total" },
              {
                $addFields: {
                  page,
                  limit,
                  pages: {
                    $ceil: { $divide: ["$total", limit] },
                  },
                },
              },
            ],
            data: [
              { $skip: (page - 1) * limit },
              { $limit: limit },
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
            ],
            specifiedResearcher: [
              { $match: { scholar_id } },
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
            ],
          },
        },
      ];

      const result = await ResearcherModel.aggregate(pipeline);
      const topResearchers = result[0].data;
      const metadata = result[0].metadata[0];
      const specifiedResearcherData = result[0].specifiedResearcher[0];

      res.status(200).json({
        topResearchers,
        researcher: specifiedResearcherData
          ? {
              rank: specifiedResearcherData.rank,
              ...specifiedResearcherData,
            }
          : null,
        pagination: {
          total: metadata?.total || 0,
          page,
          limit,
          pages: metadata?.pages || 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public async getReseachTopicsData(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin_id = req.admin.id as string;
      const scholar_id = req.query.scholar_id as string;
      const year = req.query.year ? parseInt(req.query.year as string) : null;

      if (!scholar_id) {
        throw new createHttpError.BadRequest("Scholar ID is required");
      }

      const pipeline: PipelineStage[] = [
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
      ];

      if (year) {
        pipeline.unshift({
          $match: {
            publicationDate: { $regex: `^${year}` },
          },
        });
      }

      const tags = await PaperModel.aggregate(pipeline);

      res.status(200).json(tags);
    } catch (error) {
      next(error);
    }
  }

  public async getJournalDiversityData(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin_id = req.admin.id as string;
      const scholar_id = req.query.scholar_id as string;
      const year = req.query.year ? parseInt(req.query.year as string) : null;

      if (!scholar_id) {
        throw new createHttpError.BadRequest("Scholar ID is required");
      }

      const pipeline: PipelineStage[] = [
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
      ];

      if (year) {
        pipeline.unshift({
          $match: {
            publicationDate: { $regex: `^${year}` },
          },
        });
      }

      const journals = await PaperModel.aggregate(pipeline);

      res.status(200).json(journals);
    } catch (error) {
      next(error);
    }
  }

  public async getPreFilterData(
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

  public async getTopPublicationsData(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin_id = req.admin.id as string;
      const scholar_id = req.query.scholar_id as string;
      const filters = req.body as PublicationFetchingFiltersResearcher;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      if (limit > config.API_LIMIT) {
        throw new createHttpError.BadRequest(
          `Limit exceeds the maximum limit of ${config.API_LIMIT}`
        );
      }

      publicationFetchingFiltersValidatorResearcher.parse(filters);

      if (!scholar_id) {
        throw new createHttpError.BadRequest("Scholar ID is required");
      }

      let sortCriteria: Record<string, 1 | -1> = { totalCitations: -1 };

      const matchStage = {
        "researcher.scholar_id": scholar_id,
        admin_id: new mongoose.Types.ObjectId(admin_id),
      };
      if (filters) {
        if (filters.year) {
          matchStage["publicationDate"] = {
            $in: filters.year.map((year) => new RegExp(`^${year}`)),
          };
        }
        if (filters.journal) {
          matchStage["journal"] = { $in: filters.journal };
        }
        if (filters.topic) {
          matchStage["tags"] = { $in: filters.topic };
        }
        if (filters.citationsRange) {
          matchStage["totalCitations"] = {
            $gte: filters.citationsRange[0],
            $lte: filters.citationsRange[1],
          };
        }
        if (filters.sort) {
          const [sort, order] = filters.sort.split(":");
          sortCriteria = { [sort]: order === "asc" ? 1 : -1 };
        }
      }
      console.log(sortCriteria);
      const aggregationPipeline: PipelineStage[] = [
        { $match: matchStage },
        {
          $project: {
            _id: 0,
            title: 1,
            year: { $substr: ["$publicationDate", 0, 4] },
            citations: "$totalCitations",
            author: "$researcher.name",
            coAuthors: {
              $filter: {
                input: "$authors",
                as: "author",
                cond: { $ne: ["$$author", "$researcher.name"] },
              },
            },
            topics: "$tags",
            publicationLink: 1,
            pdfLink: 1,
            description: 1,
            journal: 1,
            department: "$researcher.department",
            googleScholarId: "$researcher.researcher_id",
          },
        },
        { $sort: sortCriteria },
        {
          $facet: {
            metadata: [{ $count: "total" }, { $addFields: { page, limit } }],
            data: [{ $skip: skip }, { $limit: limit }],
          },
        },
      ];

      const result = await PaperModel.aggregate(aggregationPipeline);

      const responseData = {
        publications: result[0].data,
        pagination: {
          total: result[0].metadata[0]?.total || 0,
          page,
          limit,
          pages: Math.ceil((result[0].metadata[0]?.total || 0) / limit),
        },
      };

      res.status(200).json(responseData);
    } catch (error) {
      next(error);
    }
  }
}
