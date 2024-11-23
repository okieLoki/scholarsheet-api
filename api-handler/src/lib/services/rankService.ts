import mongoose, { PipelineStage } from "mongoose";
import { ResearcherModel } from "../../models/researcher";

class RankService {
  public async getRankOfInstitute(adminId: string) {
    const pipelines: Record<string, PipelineStage[]> = {
      totalPapers: [
        {
          $group: {
            _id: "$admin_id",
            totalPapers: { $sum: "$totalPapers" },
          },
        },
        { $sort: { totalPapers: -1 } },
      ],
      totalCitations: [
        {
          $group: {
            _id: "$admin_id",
            totalCitations: { $sum: "$citations" },
          },
        },
        { $sort: { totalCitations: -1 } },
      ],
    };

    const [paperRankings, citationRankings] = await Promise.all([
      ResearcherModel.aggregate(pipelines.totalPapers),
      ResearcherModel.aggregate(pipelines.totalCitations),
    ]);

    console.log(paperRankings);
    console.log(adminId);

    const paperRank =
      paperRankings.findIndex(
        (entry) =>
          entry._id && entry._id.equals(new mongoose.Types.ObjectId(adminId))
      ) + 1;

    const citationRank =
      citationRankings.findIndex(
        (entry) =>
          entry._id && entry._id.equals(new mongoose.Types.ObjectId(adminId))
      ) + 1;
    return {
      totalPapersRank: paperRank,
      totalCitationsRank: citationRank,
    };
  }

  public async getAllRanks(criteria: string) {
    const pipeline: PipelineStage[] = [
      {
        $group: {
          _id: "$admin_id",
          totalPapers: { $sum: "$totalPapers" },
          totalCitations: { $sum: "$citations" },
        },
      },
    ];

    if (criteria === "totalPapers") {
      pipeline.push({ $sort: { totalPapers: -1 } });
    } else {
      pipeline.push({ $sort: { totalCitations: -1 } });
    }

    const rankings = await ResearcherModel.aggregate(pipeline);
    return rankings;
  }
}

export const rankService = new RankService();
