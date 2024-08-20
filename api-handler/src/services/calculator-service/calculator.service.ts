import { queues } from "../../config/enum";
import { rabbitmq } from "../../config/rabbitmq";
import { PaperModel } from "../../models/paper";
import { ResearcherModel } from "../../models/researcher";
import { l } from "../../config/logger";
import axios from "axios";

class CalculatorService {
  public async listenForCalculatorEvents() {
    try {
      rabbitmq.consume(queues.CALCULATION_QUEUE, async (msg) => {
        if (msg) {
          const msgToJSON = JSON.parse(msg.content.toString());
          const { researcher_id } = msgToJSON;

          l.info(
            `Received message from queue: ${queues.CALCULATION_QUEUE} with researcher_id: ${researcher_id}`
          );

          const papers = await PaperModel.find({
            "researcher.researcher_id": researcher_id,
          });

          await ResearcherModel.updateOne(
            {
              _id: researcher_id,
            },
            {
              $set: {
                totalPapers: papers.length,
              },
            }
          );

          const departmentOfTheResearcher = await ResearcherModel.findOne(
            {
              _id: researcher_id,
            },
            {
              department: 1,
              _id: 0,
            }
          );

          // format date as we do not receive perfect date every time and add tags
          for (const paper of papers) {
            const yearOfPublication = paper.publicationDate.split("/")[0];

            const response = await axios.post("http://localhost:5000/predict", {
              title: paper.title,
              description: paper.description,
            });

            const tags = response.data.predicted_tags;

            await PaperModel.updateOne(
              {
                _id: paper._id,
              },
              {
                $set: {
                  tags,
                  publicationDate: yearOfPublication,
                  "researcher.department": departmentOfTheResearcher!.department,
                },
              }
            );
          }

          rabbitmq.ack(msg);
        }
      });
    } catch (error) {
      l.error(error, "[CalculatorService: listenForCalculatorEvents]");
      throw error;
    }
  }
}

export const calculatorService = new CalculatorService();
