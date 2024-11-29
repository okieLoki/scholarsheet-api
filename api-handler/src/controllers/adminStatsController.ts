import { NextFunction, Request, Response } from "express";
import { PaperModel } from "../models/paper";
import { ResearcherModel } from "../models/researcher";
import createHttpError from "http-errors";
import { AdminModel } from "../models/admin";
import { PublicationFetchingFiltersAdmin } from "../types";
import { publicationFetchingFiltersValidatorAdmin } from "../lib/validators";
import { rankService } from "../lib/services/rankService";
import { PipelineStage } from "mongoose";
import { config } from "../config";
import { adminStatsService } from "../lib/services/adminStatsService";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { cloudinaryService } from "../lib/services/cloudinaryService";

export class AdminStatsController {
  public async getDepartments(req: Request, res: Response, next: NextFunction) {
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

      res.status(200).json({
        departments: departments[0].departments,
      });
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
      const admin = req.admin;
      const department = req.query.department as string | undefined;
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      const adminDepartments = await AdminModel.findById(admin.id, {
        departments: 1,
      });

      if (department && !adminDepartments?.departments.includes(department))
        throw new createHttpError.BadRequest("Invalid department");

      const matchStage = { admin_id: admin.id };
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
              totalPapers: { $sum: "$publicationCount" },
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
              totalPapers: 1,
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
        totalPapers: paperStats[0]?.totalPapers || 0,
        totalResearchers: researcherCount,
      };

      result.citations.growth = formatGrowth(result.citations.growth);
      result.publications.growth = formatGrowth(result.publications.growth);

      res.status(200).json(result);
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
      const admin = req.admin;
      const department = req.query.department as string | undefined;
      const criteria = req.query.criteria as string;

      const adminDepartments = await AdminModel.findById(admin.id, {
        departments: 1,
      });

      if (department && !adminDepartments?.departments.includes(department))
        throw new createHttpError.BadRequest("Invalid department");

      if (
        !["totalPapers", "totalCitations", "hIndex", "i10index"].includes(
          criteria
        )
      ) {
        throw new createHttpError.BadRequest(
          "Invalid or missing criteria, valid criteria are 'totalPapers', 'totalCitations', 'hIndex', and 'i10index'"
        );
      }

      const matchStage = { admin_id: admin.id };
      if (department) {
        matchStage["researcher.department"] = department;
      }

      let aggregationPipeline: PipelineStage[];

      if (criteria === "hIndex" || criteria === "i10index") {
        aggregationPipeline = [
          { $match: matchStage },
          {
            $group: {
              _id: "$publicationDate",
              papers: { $push: { citations: "$totalCitations" } },
            },
          },
          {
            $project: {
              _id: 0,
              year: "$_id",
              value: {
                $size: {
                  $filter: {
                    input:
                      criteria === "hIndex"
                        ? {
                            $range: [
                              0,
                              {
                                $max: [
                                  { $size: "$papers" },
                                  { $max: "$papers.citations" },
                                ],
                              },
                            ],
                          }
                        : "$papers",
                    as: criteria === "hIndex" ? "i" : "paper",
                    cond:
                      criteria === "hIndex"
                        ? {
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
                          }
                        : { $gte: ["$$paper.citations", 10] },
                  },
                },
              },
            },
          },
          { $sort: { year: 1 } },
        ];
      } else {
        aggregationPipeline = [
          { $match: matchStage },
          {
            $group: {
              _id: "$publicationDate",
              value:
                criteria === "totalPapers"
                  ? { $sum: 1 }
                  : { $sum: "$totalCitations" },
            },
          },
          {
            $match: {
              _id: { $ne: "" },
            },
          },
          {
            $project: {
              _id: 0,
              year: "$_id",
              value: 1,
            },
          },
          { $sort: { year: 1 } },
        ];
      }

      const result = await PaperModel.aggregate(aggregationPipeline);

      const formattedResult = result.reduce((acc, item) => {
        acc[item.year] = item.value;
        return acc;
      }, {} as Record<string, number>);

      res.status(200).json(formattedResult);
    } catch (error) {
      next(error);
    }
  }

  public async getTopResearchersData(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;
      const department = req.query.department as string | undefined;
      const criteria = req.query.criteria as string;

      // YEAR means hIndex, iIndex, totalCitations, totalPapers for that year
      const year = req.query.year ? parseInt(req.query.year as string) : null;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 5;
      const skip = (page - 1) * limit;

      if (limit > config.API_LIMIT) {
        throw new createHttpError.BadRequest(
          `Limit exceeds the maximum limit of ${config.API_LIMIT}`
        );
      }

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

      const matchStage = { admin_id: admin.id };
      if (department) {
        matchStage["researcher.department"] = department;
      }
      if (year) {
        matchStage["publicationDate"] = new RegExp(`^${year}`);
      }

      const aggregationPipeline: PipelineStage[] = [
        { $match: matchStage },
        {
          $group: {
            _id: "$researcher.researcher_id",
            name: { $first: "$researcher.name" },
            department: { $first: "$researcher.department" },
            totalPapers: { $sum: 1 },
            totalCitations: { $sum: "$totalCitations" },
            papers: { $push: { citations: "$totalCitations" } },
            scholar_id: { $first: "$researcher.scholar_id" },
          },
        },
        {
          $project: {
            _id: 0,
            researcher_id: "$_id",
            name: 1,
            department: 1,
            scholar_id: 1,
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
        {
          $facet: {
            metadata: [{ $count: "total" }, { $addFields: { page, limit } }],
            data: [{ $skip: skip }, { $limit: limit }],
          },
        },
      ];

      const result = await PaperModel.aggregate(aggregationPipeline);

      const responseData = {
        researchers: result[0].data,
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

  public async getResearchTopicsData(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;
      const department = req.query.department as string | undefined;
      const year = req.query.year ? parseInt(req.query.year as string) : null;

      const adminDepartments = await AdminModel.findById(admin.id, {
        departments: 1,
      });

      if (department && !adminDepartments?.departments.includes(department))
        throw new createHttpError.BadRequest("Invalid department");

      const matchStage = { admin_id: admin.id };
      if (department) {
        matchStage["researcher.department"] = department;
      }
      if (year) {
        matchStage["publicationDate"] = new RegExp(`^${year}`);
      }

      const aggregationPipeline: PipelineStage[] = [
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

      const result = await PaperModel.aggregate(aggregationPipeline);
      res.status(200).json(result);
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
      const admin = req.admin;
      const department = req.query.department as string | undefined;
      const year = req.query.year ? parseInt(req.query.year as string) : null;

      const adminDepartments = await AdminModel.findById(admin.id, {
        departments: 1,
      });

      if (department && !adminDepartments?.departments.includes(department))
        throw new createHttpError.BadRequest("Invalid department");

      const matchStage = { admin_id: admin.id };
      if (department) {
        matchStage["researcher.department"] = department;
      }
      if (year) {
        matchStage["publicationDate"] = new RegExp(`^${year}`);
      }

      const aggregationPipeline: PipelineStage[] = [
        { $match: matchStage },
        {
          $group: {
            _id: "$journal",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ];

      const result = await PaperModel.aggregate(aggregationPipeline);
      res.status(200).json(result);
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
      const admin = req.admin;
      const department = req.query.department as string | undefined;

      const adminDepartments = await AdminModel.findById(admin.id, {
        departments: 1,
      });

      if (department && !adminDepartments?.departments.includes(department))
        throw new createHttpError.BadRequest("Invalid department");

      const matchStage = { admin_id: admin.id };
      if (department) {
        matchStage["researcher.department"] = department;
      }

      const aggregationPipeline: PipelineStage[] = [
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

      const result = await PaperModel.aggregate(aggregationPipeline);
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
      const admin = req.admin;
      const department = req.query.department as string | undefined;
      const filters = req.body as PublicationFetchingFiltersAdmin;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      if (limit > config.API_LIMIT) {
        throw new createHttpError.BadRequest(
          `Limit exceeds the maximum limit of ${config.API_LIMIT}`
        );
      }

      publicationFetchingFiltersValidatorAdmin.parse(filters);
      const adminDepartments = await AdminModel.findById(admin.id, {
        departments: 1,
      });
      if (department && !adminDepartments?.departments.includes(department))
        throw new createHttpError.BadRequest("Invalid department");

      const matchStage = { admin_id: admin.id };
      if (department) {
        matchStage["researcher.department"] = department;
      }

      let sortCriteria: Record<string, 1 | -1> = { totalCitations: -1 };

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
        if (filters.sort) {
          const [field, order] = filters.sort.split(":");
          sortCriteria = { [field]: order === "asc" ? 1 : -1 };
        }
      }

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

  public async getRankData(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = req.admin;
      const ranks = await rankService.getRankOfInstitute(String(admin.id));

      res.status(200).json(ranks);
    } catch (error) {
      next(error);
    }
  }

  public async getGenderDistributionData(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;
      const { department } = req.query as {
        department?: string;
      };

      const adminDepartments = await AdminModel.findById(admin.id, {
        departments: 1,
      });

      if (department && !adminDepartments?.departments.includes(department))
        throw new createHttpError.BadRequest("Invalid department");

      const matchStage: any = { admin_id: admin.id };

      if (department) {
        matchStage["department"] = department;
      }

      const aggregationPipeline: PipelineStage[] = [
        { $match: matchStage },
        {
          $group: {
            _id: "$gender",
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            gender: "$_id",
            count: 1,
          },
        },
      ];

      const result = await ResearcherModel.aggregate(aggregationPipeline);

      const genderDistribution = {
        male: 0,
        female: 0,
        others: 0,
      };

      result.forEach((item) => {
        if (item.gender in genderDistribution) {
          genderDistribution[item.gender as keyof typeof genderDistribution] =
            item.count;
        } else {
          genderDistribution.others += item.count;
        }
      });

      const totalResearchers = Object.values(genderDistribution).reduce(
        (a, b) => a + b,
        0
      );

      const genderPercentages = Object.entries(genderDistribution).reduce(
        (acc, [gender, count]) => {
          acc[gender as keyof typeof genderDistribution] =
            totalResearchers > 0
              ? ((count / totalResearchers) * 100).toFixed(2) + "%"
              : "0%";
          return acc;
        },
        {} as Record<keyof typeof genderDistribution, string>
      );

      res.status(200).json({
        distribution: genderDistribution,
        percentages: genderPercentages,
        totalResearchers,
      });
    } catch (error) {
      next(error);
    }
  }

  public async generateReport(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = req.admin;
      const { department, year } = req.query as {
        department?: string;
        year?: number;
      };

      const htmlReport = await adminStatsService.generateReport(
        admin.id as string,
        department,
        year
      );
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.setContent(htmlReport, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        margin: {
          top: "1in",
          right: "1in",
          bottom: "1in",
          left: "1in",
        },
      });
      await browser.close();

      const randomString = Math.random().toString(36).substring(7);

      const fileName = `admin-report-${Date.now()}-${randomString}.pdf`;
      const filePath = path.join(__dirname, "files", fileName);
      fs.writeFileSync(filePath, pdfBuffer);

      const fileUrl = await cloudinaryService.uploadFile(filePath, "reports");

      fs.unlinkSync(filePath);

      res.status(200).json({
        fileUrl: fileUrl,
        message: "Report generated and uploaded successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  public async getStatsDataForYearRange(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;
      const { department, startYear, endYear } = req.query;

      if (!startYear || !endYear)
        throw new createHttpError.BadRequest(
          "Start year and end year are required"
        );
      if (
        isNaN(parseInt(startYear as string)) ||
        isNaN(parseInt(endYear as string))
      )
        throw new createHttpError.BadRequest("Invalid year");
      if (parseInt(startYear as string) > parseInt(endYear as string))
        throw new createHttpError.BadRequest(
          "Start year cannot be greater than end year"
        );

      const adminDepartments = await AdminModel.findById(admin.id, {
        departments: 1,
      });

      if (
        department &&
        !adminDepartments?.departments.includes(department as string)
      )
        throw new createHttpError.BadRequest("Invalid department");

      const matchConditions: any = {
        admin_id: admin.id,
        publicationDate: {
          $gte: startYear,
          $lte: endYear,
        },
      };

      if (department) {
        matchConditions["researcher.department"] = department;
      }

      const papers = await PaperModel.find(matchConditions)
        .select("totalCitations")
        .lean();

      const totalPapers = papers.length;
      const totalCitations = papers.reduce(
        (sum, paper) => sum + (paper.totalCitations || 0),
        0
      );

      const citationCounts = papers
        .map((paper) => paper.totalCitations || 0)
        .sort((a, b) => b - a);

      let hIndex = 0;
      for (let i = 0; i < citationCounts.length; i++) {
        if (citationCounts[i] >= i + 1) {
          hIndex = i + 1;
        } else {
          break;
        }
      }

      const i10index = citationCounts.filter(
        (citations) => citations >= 10
      ).length;

      res.status(200).json({
        totalPapers,
        totalCitations,
        hIndex,
        i10index,
      });
    } catch (error) {
      next(error);
    }
  }
}
