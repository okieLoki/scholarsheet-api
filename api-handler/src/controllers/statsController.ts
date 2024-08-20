import { NextFunction, Request, Response } from "express";
import { PaperModel } from "../models/paper";
import createHttpError from "http-errors";
import { ResearcherModel } from "../models/researcher";

export class StatsController {
  public async totalPublicationsYearWise(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;

      const papers = await PaperModel.find({
        admin_id: admin.id,
      });

      const publicationCountYearWise = papers.reduce((acc, paper) => {
        const year = paper.publicationDate.split("/")[0];
        acc[year] = acc[year] ? acc[year] + 1 : 1;
        return acc;
      }, {});

      return res.status(200).json({
        publicationCountYearWise,
      });
    } catch (error) {
      next(error);
    }
  }

  public async totalPublicationsDepartmentWise(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;

      const papers = await PaperModel.find({
        admin_id: admin.id,
      });

      const publicationCountDepartmentWise = papers.reduce((acc, paper) => {
        const department = paper.researcher!.department;
        acc[department] = acc[department] ? acc[department] + 1 : 1;
        return acc;
      }, {});

      return res.status(200).json({
        publicationCountDepartmentWise,
      });
    } catch (error) {
      next(error);
    }
  }

  public async totalPublicationsofDepartmentYearWise(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;
      const department = req.query.department as string;

      if (!department) {
        const papers = await PaperModel.find({
          admin_id: admin.id,
        });

        const publicationCountDepartmentYearWise = papers.reduce(
          (acc, paper) => {
            const year = paper.publicationDate.split("/")[0];
            const department = paper.researcher!.department;
            acc[department] = acc[department] ? acc[department] : {};
            acc[department][year] = acc[department][year]
              ? acc[department][year] + 1
              : 1;
            return acc;
          },
          {}
        );

        return res.status(200).json({
          publicationCountDepartmentYearWise,
        });
      } else {
        const papers = await PaperModel.find({
          admin_id: admin.id,
          "researcher.department": department,
        });

        const publicationCountDepartmentYearWise = papers.reduce(
          (acc, paper) => {
            const year = paper.publicationDate.split("/")[0];
            acc[year] = acc[year] ? acc[year] + 1 : 1;
            return acc;
          },
          {}
        );

        return res.status(200).json({
          publicationCountDepartmentYearWise,
        });
      }
    } catch (error) {
      next(error);
    }
  }

  public async topResearchersAcrossDepartmentsAccordingToCitations(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;

      const count = parseInt(req.query.count as string) || 1;
      const criteria = req.query.criteria as string;

      if (
        !["citations", "h_index", "i_index", "totalPapers"].includes(criteria)
      ) {
        throw new createHttpError.BadRequest(
          "Invalid criteria, valid criteria are citations, h_index, i_index, totalPapers"
        );
      }

      const researchers = await ResearcherModel.find({
        admin_id: admin.id,
      });

      const departmentGroups = researchers.reduce((acc: any, researcher) => {
        if (!acc[researcher.department]) {
          acc[researcher.department] = [];
        }
        acc[researcher.department].push(researcher);
        return acc;
      }, {});

      const topPublishers = Object.keys(departmentGroups).map((department) => {
        const sortedResearchers = departmentGroups[department].sort(
          (a, b) => b[criteria] - a[criteria]
        );
        return {
          department,
          topPublisher: sortedResearchers.slice(0, count),
        };
      });

      res.status(200).json({ topPublishers });
    } catch (error) {
      next(error);
    }
  }

  public async topTagsOfPublication(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;

      const count = parseInt(req.query.count as string) || 1;

      const papers = await PaperModel.find({
        admin_id: admin.id,
      });

      const tags = papers.reduce((acc, paper) => {
        for (const tag of paper.tags) {
          acc[tag] = acc[tag] ? acc[tag] + 1 : 1;
        }
        return acc;
      }, {});

      const sortedTags = Object.keys(tags).sort((a, b) => tags[b] - tags[a]);

      res.status(200).json({
        topTags: sortedTags.slice(0, count),
      });
    } catch (error) {
      next(error);
    }
  }

  public async averageCitationsPerPaper(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;

      const papers = await PaperModel.find({ admin_id: admin.id });

      const totalCitations = papers.reduce(
        (sum, paper) => sum + paper.totalCitations,
        0
      );
      const averageCitations = totalCitations / papers.length;

      res.status(200).json({ averageCitations });
    } catch (error) {
      next(error);
    }
  }

  public async mostCitedPapers(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;
      const limit = parseInt(req.query.limit as string) || 10;

      const papers = await PaperModel.find({ admin_id: admin.id })
        .sort({ totalCitations: -1 })
        .limit(limit);

      res.status(200).json({ mostCitedPapers: papers });
    } catch (error) {
      next(error);
    }
  }

  public async publicationTrends(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;

      const papers = await PaperModel.find({ admin_id: admin.id });

      const trends = papers.reduce((acc, paper) => {
        const year = paper.publicationDate.split("/")[0];
        if (!acc[year]) {
          acc[year] = { papers: 0, citations: 0 };
        }
        acc[year].papers++;
        acc[year].citations += paper.totalCitations;
        return acc;
      }, {});

      res.status(200).json({ publicationTrends: trends });
    } catch (error) {
      next(error);
    }
  }

  public async researcherCollaborationNetwork(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;

      const papers = await PaperModel.find({ admin_id: admin.id });

      const collaborations = {};

      papers.forEach((paper) => {
        paper.authors.forEach((author1) => {
          paper.authors.forEach((author2) => {
            if (author1 !== author2) {
              if (!collaborations[author1]) collaborations[author1] = {};
              collaborations[author1][author2] =
                (collaborations[author1][author2] || 0) + 1;
            }
          });
        });
      });

      res.status(200).json({ collaborationNetwork: collaborations });
    } catch (error) {
      next(error);
    }
  }

  public async researcherProductivity(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;

      const researchers = await ResearcherModel.find({ admin_id: admin.id });

      const productivity = researchers.map((researcher) => ({
        name: researcher.name,
        department: researcher.department,
        papersCount: researcher.totalPapers,
        // @ts-ignore
        citationsPerPaper: researcher.citations / researcher.totalPapers,
      }));

      res.status(200).json({ researcherProductivity: productivity });
    } catch (error) {
      next(error);
    }
  }

  public async departmentComparison(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;

      const researchers = await ResearcherModel.find({ admin_id: admin.id });

      const comparison = researchers.reduce((acc, researcher) => {
        if (!acc[researcher.department]) {
          acc[researcher.department] = {
            papers: 0,
            citations: 0,
            researchers: 0,
          };
        }
        acc[researcher.department].papers += researcher.totalPapers;
        acc[researcher.department].citations += researcher.citations;
        acc[researcher.department].researchers++;
        return acc;
      }, {});

      res.status(200).json({ departmentComparison: comparison });
    } catch (error) {
      next(error);
    }
  }

  public async journalDiversity(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;

      const papers = await PaperModel.find({ admin_id: admin.id });

      const journals = new Map();

      papers.forEach((paper) => {
        const journal = paper.journal;

        if (journal == "") return;

        if (!journals.has(journal)) {
          journals.set(journal, 1);
        } else {
          journals.set(journal, journals.get(journal) + 1);
        }
      });

      const totalJournals = journals.size;

      res.status(200).json({
        totalJournals,
        journalDiversity: Array.from(journals.entries()),
      });
    } catch (error) {
      next(error);
    }
  }

  public async researcherGrowth(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;

      const papers = await PaperModel.find({ admin_id: admin.id });

      const growth = papers.reduce((acc, paper) => {
        const year = paper.publicationDate.split("/")[0];
        if (!acc[year]) acc[year] = new Set();
        acc[year].add(paper.researcher!.researcher_id.toString());
        return acc;
      }, {});

      const yearlyGrowth = Object.keys(growth).map((year) => ({
        year,
        researcherCount: growth[year].size,
      }));

      res.status(200).json({ researcherGrowth: yearlyGrowth });
    } catch (error) {
      next(error);
    }
  }
}
