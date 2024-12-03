import createError from "http-errors";
import { Request, Response, NextFunction } from "express";
import {
  deleteResearcherSchema,
  researcherUpdateSchema,
} from "../lib/validators";
import { ResearcherModel } from "../models/researcher";
import { AdminModel } from "../models/admin";
import mongoose from "mongoose";
import { PaperModel } from "../models/paper";
import { config } from "../config";

export class ResearcherManagementController {
  public async getAllResearchers(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;
      const {
        department,
        sort,
        gender,
        page: pageQuery,
        limit: limitQuery,
      } = req.query;

      const page = parseInt(pageQuery as string) || 1;
      const limit = parseInt(limitQuery as string) || 5;
      const skip = (page - 1) * limit;

      if (limit > config.API_LIMIT) {
        throw new createError.BadRequest(
          `Limit exceeds the maximum limit of ${config.API_LIMIT}`
        );
      }

      const query: any = { admin_id: admin.id };

      if (department) {
        query.department = department;
      }

      if (gender) {
        query.gender = gender;
      }

      const sortOptions: any = { createdAt: -1 };
      if (sort) {
        switch (sort) {
          case "name":
            sortOptions.name = 1;
            break;
          case "-name":
            sortOptions.name = -1;
            break;
          case "hIndex":
            sortOptions.h_index = 1;
            break;
          case "-hIndex":
            sortOptions.h_index = -1;
            break;
          case "iIndex":
            sortOptions.i_index = 1;
            break;
          case "-iIndex":
            sortOptions.i_index = -1;
            break;
          case "totalPapers":
            sortOptions.totalPapers = 1;
            break;
          case "-totalPapers":
            sortOptions.totalPapers = -1;
            break;
        }
      }

      const total = await ResearcherModel.countDocuments(query);

      const researchers = await ResearcherModel.find(query, {
        _id: 0,
        name: 1,
        scholar_id: 1,
        email: 1,
        department: 1,
        gender: 1,
        citations: 1,
        h_index: 1,
        i_index: 1,
        totalPapers: 1,
        positions: 1,
      })
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);

      return res.status(200).json({
        researchers,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public async updateResearcher(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;
      const { id } = req.params;

      const validationResult = researcherUpdateSchema.safeParse(req.body);

      if (!validationResult.success) {
        throw new createError.BadRequest(
          validationResult.error.errors.map((err) => err.message).join(", ")
        );
      }

      const updateData = validationResult.data;

      const researcher = await ResearcherModel.findOneAndUpdate(
        { scholar_id: id, admin_id: admin.id },
        { $set: updateData },
        { new: true, projection: { _id: 0 } }
      );

      if (!researcher) {
        throw new createError.NotFound("Researcher not found");
      }

      return res.status(200).json({
        message: "Researcher updated successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  public async deleteResearcher(
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
      researcher.previousAdmins.push(admin.id as mongoose.Types.ObjectId);

      await Promise.all([
        researcher.save(),
        PaperModel.updateMany(
          {
            "researcher.researcher_id": researcher._id,
          },
          {
            $unset: {
              "researcher.department": "",
              admin_id: "",
            },
            $push: {
              previous: {
                admin_id: admin.id,
                department: researcher.department,
              },
            },
          }
        ),
      ]);

      return res.status(201).json({
        message: "Researcher updated successfully",
        updatedPositions: researcher.positions,
      });
    } catch (error) {
      next(error);
    }
  }
}
