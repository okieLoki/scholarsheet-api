import { queues } from "../../config/enum";
import { rabbitmq } from "../../config/rabbitmq";
import { PaperModel } from "../../models/paper";
import { ResearcherModel } from "../../models/researcher";
import { l } from "../../config/logger";
import axios from "axios";
import { socketService } from "../../config/socket";
import mongoose from "mongoose";

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

          const updatedReseacher = await ResearcherModel.findOneAndUpdate(
            {
              _id: researcher_id,
            },
            {
              $set: {
                totalPapers: papers.length,
              },
            }
          );

          // format date as we do not receive perfect date every time and add tags
          const paperPromises = papers.map(async (paper) => {
            const yearOfPublication = paper.publicationDate.split("/")[0];

            const predictResponse = await axios.post(
              "http://localhost:5000/predict",
              {
                title: paper.title,
                description: paper.description,
              }
            );

            const tags = predictResponse.data.predicted_tags;

            return PaperModel.updateOne(
              { _id: paper._id },
              {
                $set: {
                  tags,
                  publicationDate: yearOfPublication,
                  "researcher.department":
                  updatedReseacher?.department,
                },
              }
            );
          });

          await Promise.all([
            paperPromises,
            socketService.sendNotification(
              updatedReseacher?.admin_id as mongoose.Types.ObjectId,
              `Successfully imported data for ${updatedReseacher?.name}`
            ),
          ]);

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
