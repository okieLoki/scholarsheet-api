import { queues } from "../../config/enum";
import { rabbitmq } from "../../config/rabbitmq";
import { PaperModel } from "../../models/paper";
import { ResearcherModel } from "../../models/researcher";
import { l } from "../../config/logger";
import axios from "axios";
import { socketService } from "../../config/socket";
import mongoose from "mongoose";
import { Resend } from "resend";
import { config } from "../../config";
import { AdminModel } from "../../models/admin";

const resend = new Resend("re_XbxaXhyg_2mrLdDwjfhbhHGCfH5R2tceH");

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

          const updatedResearcher = await ResearcherModel.findOneAndUpdate(
            {
              _id: researcher_id,
            },
            {
              $set: {
                totalPapers: papers.length,
              },
            }
          );

          const admin = await AdminModel.findById(updatedResearcher.admin_id);

          // format date as we do not receive perfect date every time and add tags
          const paperPromises = papers.map(async (paper) => {
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
                },
              }
            );
          });

          console.log(admin);

          await Promise.all([
            paperPromises,
            socketService.sendNotification(
              updatedResearcher?.admin_id as mongoose.Types.ObjectId,
              `Successfully imported data for ${updatedResearcher?.name}`
            ),
            (async () => {
              try {
                if (!admin || !admin.email) {
                  l.warn("No admin email found for notification");
                  return;
                }

                const emailResponse = await resend.emails.send({
                  from: "noreply@scholarsheet.com",
                  to: [admin.email, "uddeeptaraajkashyap@gmail.com"],
                  subject: "Data Imported",
                  html: `Successfully imported data for ${updatedResearcher?.name} and updated total papers to ${papers.length}`,
                });

                l.info("Email sent successfully", emailResponse);
              } catch (emailError) {
                l.error(emailError, "[CalculatorService: Resend Email Error]");
                // Consider additional error handling or fallback notification method
              }
            })(),
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
