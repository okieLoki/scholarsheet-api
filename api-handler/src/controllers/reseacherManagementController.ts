import createError from "http-errors";
import { Request, Response, NextFunction } from "express";
import { deleteResearcherSchema } from "../lib/validators";
import { ResearcherModel } from "../models/researcher";
import { AdminModel } from "../models/admin";

export class ReseacherManagementController {
  public async deleteReseacher(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;

      const { scholar_id, end_date } = deleteResearcherSchema.parse(req.query);

      const [adminData, researcher] = await Promise.all([
        AdminModel.findOne(
          { _id: admin.id },
          {
            institute_name: 1,
          }
        ),
        ResearcherModel.findOne({ scholar_id }),
      ]);

      if (!researcher) throw new createError.NotFound("Researcher not found");

      if (
        !researcher.admin_id ||
        researcher.admin_id.toString() !== admin.id.toString()
      ) {
        throw new createError.Forbidden(
          "You do not have permission to modify this researcher"
        );
      }

      const parsedEndDate = end_date;

      const updatedPositions = researcher.positions.map((position) => {
        if (
          !position.end &&
          position.current &&
          position.institute === adminData?.institute_name
        ) {
          return {
            ...position,
            end: parsedEndDate,
            current: false,
          };
        }
        return position;
      });

      // @ts-ignore
      researcher.positions = updatedPositions;
      researcher.admin_id = null;

      await researcher.save();

      return res.status(201).json({
        message: "Researcher updated successfully",
        updatedPositions: researcher.positions,
      });
    } catch (error) {
      next(error);
    }
  }
}
