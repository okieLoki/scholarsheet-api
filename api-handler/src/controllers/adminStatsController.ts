import { NextFunction, Request, Response } from "express";
import { PaperModel } from "../models/paper";
import { ResearcherModel } from "../models/researcher";
import createHttpError from "http-errors";
import { AdminModel } from "../models/admin";
import { PublicationFetchingFilters } from "../types";
import { publicationFetchingFiltersValidator } from "../lib/validators";


export class AdminStatsController {
  async getDepartments(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = req.admin;
      const departments = await AdminModel.find(
        {
          _id: admin.id,
        },
        {
          _id: 0,
          departments: 1,
        }
      ).lean();

      res.json({
        departments: departments[0].departments,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCardStatsData(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = req.admin;
      const department = req.query.department as string | undefined;
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      const adminDepartments = await AdminModel.findById(admin.id, {
        departments: 1,
      });

      if (department && !adminDepartments?.departments.includes(department))
        throw new createHttpError.BadRequest("Invalid department");

      const matchStage: any = { admin_id: admin.id };
      if (department) {
        matchStage["researcher.department"] = department;
      }

      const [paperStats, researcherCount] = await Promise.all([
        PaperModel.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: {
                $toInt: {
                  $cond: [
                    {
                      $eq: [
                        {
                          $arrayElemAt: [
                            { $split: ["$publicationDate", "/"] },
                            0,
                          ],
                        },
                        "",
                      ],
                    },
                    "0",
                    {
                      $arrayElemAt: [{ $split: ["$publicationDate", "/"] }, 0],
                    },
                  ],
                },
              },
              publicationCount: { $sum: 1 },
              citationCount: { $sum: "$totalCitations" },
            },
          },
          {
            $group: {
              _id: null,
              currentYearCitations: {
                $sum: {
                  $cond: [{ $eq: ["$_id", currentYear] }, "$citationCount", 0],
                },
              },
              lastYearCitations: {
                $sum: {
                  $cond: [{ $eq: ["$_id", lastYear] }, "$citationCount", 0],
                },
              },
              currentYearPublications: {
                $sum: {
                  $cond: [
                    { $eq: ["$_id", currentYear] },
                    "$publicationCount",
                    0,
                  ],
                },
              },
              lastYearPublications: {
                $sum: {
                  $cond: [{ $eq: ["$_id", lastYear] }, "$publicationCount", 0],
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              citations: {
                [currentYear]: "$currentYearCitations",
                [lastYear]: "$lastYearCitations",
                growth: {
                  $cond: [
                    { $eq: ["$lastYearCitations", 0] },
                    null,
                    {
                      $multiply: [
                        {
                          $divide: [
                            {
                              $subtract: [
                                "$currentYearCitations",
                                "$lastYearCitations",
                              ],
                            },
                            "$lastYearCitations",
                          ],
                        },
                        100,
                      ],
                    },
                  ],
                },
              },
              publications: {
                [currentYear]: "$currentYearPublications",
                [lastYear]: "$lastYearPublications",
                growth: {
                  $cond: [
                    { $eq: ["$lastYearPublications", 0] },
                    null,
                    {
                      $multiply: [
                        {
                          $divide: [
                            {
                              $subtract: [
                                "$currentYearPublications",
                                "$lastYearPublications",
                              ],
                            },
                            "$lastYearPublications",
                          ],
                        },
                        100,
                      ],
                    },
                  ],
                },
              },
            },
          },
        ]),
        ResearcherModel.countDocuments({
          admin_id: admin.id,
          ...(department && { department }),
        }),
      ]);

      const formatGrowth = (value: number | null) => {
        if (value === null) return "N/A (no data for previous year)";
        return value > 0
          ? `${value.toFixed(2)}% increase`
          : `${Math.abs(value).toFixed(2)}% decrease`;
      };

      const result = {
        citations: paperStats[0]?.citations || {
          [currentYear]: 0,
          [lastYear]: 0,
          growth: null,
        },
        publications: paperStats[0]?.publications || {
          [currentYear]: 0,
          [lastYear]: 0,
          growth: null,
        },
        totalResearchers: researcherCount,
      };

      result.citations.growth = formatGrowth(result.citations.growth);
      result.publications.growth = formatGrowth(result.publications.growth);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getAnalyticsGraphData(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = req.admin;
      const department = req.query.department as string | undefined;
      const criteria = req.query.criteria as string;

      const adminDepartments = await AdminModel.findById(admin.id, {
        departments: 1,
      });

      if (department && !adminDepartments?.departments.includes(department))
        throw new createHttpError.BadRequest("Invalid department");

      if (!["totalPapers", "totalCitations"].includes(criteria)) {
        throw new createHttpError.BadRequest(
          "Invalid or missing criteria, valid criteria are 'totalPapers' and 'totalCitations'"
        );
      }

      const matchStage: any = { admin_id: admin.id };
      if (department) {
        matchStage["researcher.department"] = department;
      }

      const aggregationPipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: { $substr: ["$publicationDate", 0, 4] },
            count: { $sum: 1 },
            citations: { $sum: "$totalCitations" },
          },
        },
        {
          $project: {
            _id: 0,
            year: "$_id",
            value: criteria === "totalPapers" ? "$count" : "$citations",
          },
        },
        { $sort: { year: -1 } },
      ];

      // @ts-ignore
      const result = await PaperModel.aggregate(aggregationPipeline);

      const formattedResult = result.reduce((acc, item) => {
        acc[item.year] = item.value;
        return acc;
      }, {} as Record<string, number>);

      res.json(formattedResult);
    } catch (error) {
      next(error);
    }
  }

  async getTopResearchersData(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = req.admin;
      const department = req.query.department as string | undefined;
      const criteria = req.query.criteria as string;
      const limit = parseInt(req.query.limit as string) || 5;

      const adminDepartments = await AdminModel.findById(admin.id, {
        departments: 1,
      });

      if (department && !adminDepartments?.departments.includes(department))
        throw new createHttpError.BadRequest("Invalid department");

      if (
        !["totalCitations", "totalPapers", "hIndex", "i10index"].includes(
          criteria
        )
      ) {
        throw new createHttpError.BadRequest(
          "Invalid or missing criteria, valid criteria are 'totalPapers', 'totalCitations', 'hIndex' and 'i10index'"
        );
      }

      const matchStage: any = { admin_id: admin.id };
      if (department) {
        matchStage["researcher.department"] = department;
      }

      const aggregationPipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: "$researcher.researcher_id",
            name: { $first: "$researcher.name" },
            department: { $first: "$researcher.department" },
            totalPapers: { $sum: 1 },
            totalCitations: { $sum: "$totalCitations" },
            papers: { $push: { citations: "$totalCitations" } },
          },
        },
        {
          $project: {
            _id: 0,
            researcher_id: "$_id",
            name: 1,
            department: 1,
            totalPapers: 1,
            totalCitations: 1,
            hIndex: {
              $size: {
                $filter: {
                  input: {
                    $range: [0, { $max: ["$totalPapers", "$totalCitations"] }],
                  },
                  as: "i",
                  cond: {
                    $gte: [
                      {
                        $size: {
                          $filter: {
                            input: "$papers",
                            as: "p",
                            cond: { $gte: ["$$p.citations", "$$i"] },
                          },
                        },
                      },
                      "$$i",
                    ],
                  },
                },
              },
            },
            i10index: {
              $size: {
                $filter: {
                  input: "$papers",
                  as: "paper",
                  cond: { $gte: ["$$paper.citations", 10] },
                },
              },
            },
          },
        },
        { $sort: { [criteria]: -1 } },
        { $limit: limit },
      ];

      // @ts-ignore
      const result = await PaperModel.aggregate(aggregationPipeline);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getResearchTopicsData(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = req.admin;
      const department = req.query.department as string | undefined;

      const adminDepartments = await AdminModel.findById(admin.id, {
        departments: 1,
      });

      if (department && !adminDepartments?.departments.includes(department))
        throw new createHttpError.BadRequest("Invalid department");

      const matchStage: any = { admin_id: admin.id };
      if (department) {
        matchStage["researcher.department"] = department;
      }

      const aggregationPipeline = [
        { $match: matchStage },
        { $unwind: "$tags" },
        {
          $group: {
            _id: "$tags",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ];

      // @ts-ignore
      const result = await PaperModel.aggregate(aggregationPipeline);
      res.json(result);
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
      const admin = req.admin;
      const department = req.query.department as string | undefined;

      const adminDepartments = await AdminModel.findById(admin.id, {
        departments: 1,
      });

      if (department && !adminDepartments?.departments.includes(department))
        throw new createHttpError.BadRequest("Invalid department");

      const matchStage: any = { admin_id: admin.id };
      if (department) {
        matchStage["researcher.department"] = department;
      }

      const aggregationPipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: "$journal",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ];

      // @ts-ignore
      const result = await PaperModel.aggregate(aggregationPipeline);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getPreFilterData(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = req.admin;
      const department = req.query.department as string | undefined;

      const adminDepartments = await AdminModel.findById(admin.id, {
        departments: 1,
      });

      if (department && !adminDepartments?.departments.includes(department))
        throw new createHttpError.BadRequest("Invalid department");

      const matchStage: any = { admin_id: admin.id };
      if (department) {
        matchStage["researcher.department"] = department;
      }

      const aggregationPipeline = [
        { $match: matchStage },
        { $unwind: { path: "$tags", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: null,
            years: {
              $addToSet: { $substr: ["$publicationDate", 0, 4] },
            },
            journals: { $addToSet: "$journal" },
            authors: { $addToSet: "$researcher.name" },
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
            authors: 1,
            topics: 1,
            minCitations: { $min: "$citationsRange" },
            maxCitations: { $max: "$citationsRange" },
          },
        },
      ];

      // @ts-ignore
      const result = await PaperModel.aggregate(aggregationPipeline);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getTopPublicationsData(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;
      const department = req.query.department as string | undefined;
      const filters = req.body as PublicationFetchingFilters;

      publicationFetchingFiltersValidator.parse(filters);

      const adminDepartments = await AdminModel.findById(admin.id, {
        departments: 1,
      });

      if (department && !adminDepartments?.departments.includes(department))
        throw new createHttpError.BadRequest("Invalid department");

      // validate filters
      if (filters.year && !Array.isArray(filters.year)) {
        throw new createHttpError.BadRequest("Invalid year filter");
      }
      if (filters.journal && !Array.isArray(filters.journal)) {
        throw new createHttpError.BadRequest("Invalid journal filter");
      }
      if (filters.author && !Array.isArray(filters.author)) {
        throw new createHttpError.BadRequest("Invalid author filter");
      }
      if (filters.topic && !Array.isArray(filters.topic)) {
        throw new createHttpError.BadRequest("Invalid topic filter");
      }
      if (filters.citationsRange && !Array.isArray(filters.citationsRange)) {
        throw new createHttpError.BadRequest("Invalid citationsRange filter");
      }
      if (filters.citationsRange && filters.citationsRange.length !== 2) {
        throw new createHttpError.BadRequest(
          "Invalid citationsRange filter, it should be an array of length 2"
        );
      }

      const limit = parseInt(req.query.limit as string) || 10;

      const matchStage: any = { admin_id: admin.id };

      if (department) {
        matchStage["researcher.department"] = department;
      }

      if (filters) {
        if (filters.year) {
          matchStage["publicationDate"] = {
            $in: filters.year.map((year) => new RegExp(`^${year}`)),
          };
        }
        if (filters.journal) {
          matchStage["journal"] = { $in: filters.journal };
        }
        if (filters.author) {
          matchStage["researcher.name"] = { $in: filters.author };
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
      }

      const aggregationPipeline = [
        { $match: matchStage },
        {
          $project: {
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
        { $sort: { citations: -1 } },
        { $limit: limit },
      ];

      // @ts-ignore
      const result = await PaperModel.aggregate(aggregationPipeline);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}
