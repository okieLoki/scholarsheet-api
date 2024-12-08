import { rabbitMq } from "../../config/rabbitmq.js";
import { queues } from "../../constants/config.js";
import { Paper } from "../../schemas/paper.js";
import { Researcher } from "../../schemas/researcher.js";
import { fetchAllPublicationDetails } from "../scrapper/scrapper.js";
import { l } from "../../config/logger.js";

class ScrapperEventHandler {
  async listenForCalculatorEvents() {
    try {
      rabbitMq.consume(queues.RESEACHER_QUEUE, async (msg) => {
        if (!msg) return;

        const { admin_id, researcher } = JSON.parse(msg.content.toString());
        const { researcher_id, name, scholar_id } = researcher;

        l.info(`Fetching papers for scholar_id: ${scholar_id}`);

        const fetchedPapers = await fetchAllPublicationDetails(scholar_id);

        const metrics = this.calculateMetrics(fetchedPapers);

        const updatedResearcher = await Researcher.findOneAndUpdate(
          { _id: researcher_id },
          {
            $set: {
              totalPapers: fetchedPapers.length,
              h_index: metrics.hIndex,
              i_index: metrics.i10Index,
              citations: metrics.totalCitations,
              lastFetch: new Date(),
            },
          }
        );

        const papersToInsert = fetchedPapers.map((paper) => ({
          researcher: {
            researcher_id,
            name,
            scholar_id,
            department: updatedResearcher.department,
          },
          admin_id,
          title: paper.title,
          link: paper.link,
          authors: paper.authors,
          publicationDate: paper.publicationDate,
          journal: paper.journal,
          volume: paper.volume,
          issue: paper.issue,
          pages: paper.pages,
          publisher: paper.publisher,
          description: paper.description,
          totalCitations: paper.totalCitations,
          link: paper.link,
          pdfLink: paper.pdfLink,
        }));

        l.info(`Inserting ${papersToInsert.length} papers for ${name}`);

        await Paper.insertMany(papersToInsert);

        rabbitMq.ack(msg);
      });
    } catch (error) {
      l.error(`Error consuming messages: ${error}`);
      throw error;
    }
  }

  calculateMetrics(papers) {
    let hIndex = 0;
    let i10Index = 0;
    let totalCitations = 0;

    papers.forEach((paper) => {
      const citations = Number(paper.totalCitations) || 0;
      totalCitations += citations;
      if (citations >= 10) i10Index += 1;
      if (citations >= hIndex + 1) hIndex += 1;
    });

    return { hIndex, i10Index, totalCitations };
  }
}

export const scrapperEventHandler = new ScrapperEventHandler();
