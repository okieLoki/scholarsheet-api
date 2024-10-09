import { PaperModel } from "../../models/paper";
import { ResearcherModel } from "../../models/researcher";
import { AdminModel } from "../../models/admin";
import { rankService } from "../../lib/services/rankService";
import { PipelineStage } from "mongoose";
import { PublicationFetchingFiltersAdmin } from "../../types";
import { adminStatshtmlReport } from "../templates/adminStatsReportTemplate";


export class AdminStatsService {
  async getDepartments(adminId: string): Promise<string[]> {
    const admin = await AdminModel.findById(adminId, { departments: 1 }).lean();
    return admin?.departments || [];
  }

  async getCardStatsData(adminId: string, department?: string) {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;

    const matchStage: any = { admin_id: adminId };
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
                  { $arrayElemAt: [{ $split: ["$publicationDate", "/"] }, 0] },
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
                $cond: [{ $eq: ["$_id", currentYear] }, "$publicationCount", 0],
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
        admin_id: adminId,
        ...(department && { department }),
      }),
    ]);

    const result = paperStats[0] || {
      citations: { [currentYear]: 0, [lastYear]: 0, growth: null },
      publications: { [currentYear]: 0, [lastYear]: 0, growth: null },
      totalPapers: 0,
    };

    result.totalResearchers = researcherCount;

    return result;
  }

  async getAnalyticsGraphData(
    adminId: string,
    department?: string,
    criteria: string = "totalPapers"
  ) {
    const matchStage: any = { admin_id: adminId };
    if (department) {
      matchStage["researcher.department"] = department;
    }

    const aggregationPipeline: PipelineStage[] = [
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

    const result = await PaperModel.aggregate(aggregationPipeline);

    return result.reduce((acc, item) => {
      acc[item.year] = item.value;
      return acc;
    }, {} as Record<string, number>);
  }

  async getTopResearchersData(
    adminId: string,
    department?: string,
    year?: number,
    criteria: string = "totalCitations",
    page: number = 1,
    limit: number = 5
  ) {
    const skip = (page - 1) * limit;

    const matchStage: any = { admin_id: adminId };
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
      {
        $facet: {
          metadata: [{ $count: "total" }, { $addFields: { page, limit } }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ];

    const result = await PaperModel.aggregate(aggregationPipeline);

    return {
      researchers: result[0].data,
      pagination: {
        total: result[0].metadata[0]?.total || 0,
        page,
        limit,
        pages: Math.ceil((result[0].metadata[0]?.total || 0) / limit),
      },
    };
  }

  async getResearchTopicsData(
    adminId: string,
    department?: string,
    year?: number
  ) {
    const matchStage: any = { admin_id: adminId };
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

    return PaperModel.aggregate(aggregationPipeline);
  }

  async getJournalDiversityData(
    adminId: string,
    department?: string,
    year?: number
  ) {
    const matchStage: any = { admin_id: adminId };
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

    return PaperModel.aggregate(aggregationPipeline);
  }

  async getPreFilterData(adminId: string, department?: string) {
    const matchStage: any = { admin_id: adminId };
    if (department) {
      matchStage["researcher.department"] = department;
    }

    const aggregationPipeline: PipelineStage[] = [
      { $match: matchStage },
      { $unwind: { path: "$tags", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          years: { $addToSet: { $substr: ["$publicationDate", 0, 4] } },
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
          citationsRange: { $push: "$totalCitations" },
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
    return result[0];
  }

  async getTopPublicationsData(
    adminId: string,
    department?: string,
    filters?: PublicationFetchingFiltersAdmin,
    page: number = 1,
    limit: number = 10
  ) {
    const skip = (page - 1) * limit;

    const matchStage: any = { admin_id: adminId };
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

    return {
      publications: result[0].data,
      pagination: {
        total: result[0].metadata[0]?.total || 0,
        page,
        limit,
        pages: Math.ceil((result[0].metadata[0]?.total || 0) / limit),
      },
    };
  }

  async getRankData(adminId: string) {
    return rankService.getRankOfInstitute(adminId);
  }

  async getGenderDistributionData(adminId: string, department?: string) {
    const matchStage: any = { admin_id: adminId };
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

    return {
      distribution: genderDistribution,
      percentages: genderPercentages,
      totalResearchers,
    };
  }

  async generateReport(adminId: string, department?: string, year?: number) {
    const currentYear = new Date().getFullYear();
    const generationTime = new Date().toLocaleString();

    const [
      cardStats,
      analyticsGraphTotalPapers,
      analyticsGraphTotalCitations,
      topResearchers,
      researchTopics,
      journalDiversity,
      rankData,
      genderDistribution,
    ] = await Promise.all([
      this.getCardStatsData(adminId, department),
      this.getAnalyticsGraphData(adminId, department, "totalPapers"),
      this.getAnalyticsGraphData(adminId, department, "totalCitations"),
      this.getTopResearchersData(adminId, department, year),
      this.getResearchTopicsData(adminId, department, year),
      this.getJournalDiversityData(adminId, department, year),
      this.getRankData(adminId),
      this.getGenderDistributionData(adminId, department),
    ]);

    return adminStatshtmlReport(
      year,
      department,
      generationTime,
      currentYear,
      cardStats,
      topResearchers,
      rankData,
      analyticsGraphTotalPapers,
      analyticsGraphTotalCitations,
      researchTopics,
      journalDiversity,
      genderDistribution
    );
  }
}

const adminStatsService = new AdminStatsService();
export { adminStatsService };
