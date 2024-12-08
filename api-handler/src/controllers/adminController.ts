import { NextFunction, Request, Response } from "express";
import { AdminModel } from "../models/admin";
import {
  addResearcherValidator,
  bulkResearcherUploadSchema,
  createAdminAccountValidator,
  loginAccountValidator,
} from "../lib/validators";
import { sendEmailVerificationMail } from "../lib/services/emailService";
import { config } from "../config";
import { ResearcherModel } from "../models/researcher";
import { ResearcherData } from "../types";
import { researcherScrapper } from "../lib/scrapper/researcherScapper";
import { rabbitmq } from "../config/rabbitmq";
import { queues } from "../config/enum";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
import createError from "http-errors";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import xlsx from "xlsx";
import { File as MulterFile } from "multer";
import { PaperModel } from "../models/paper";
import z from "zod";

declare global {
  namespace Express {
    interface Request {
      admin: AdminInterface;
      file: MulterFile;
    }
  }
}

interface AdminInterface {
  id: mongoose.Types.ObjectId | string;
  email: string;
}

export class AdminController {
  public async createAdminAccount(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { institute_name, email, password, address } =
        createAdminAccountValidator.parse(req.body);

      const existingAdmin = await AdminModel.findOne({ email });

      if (!existingAdmin?.verified) await AdminModel.deleteOne({ email });

      if (existingAdmin) throw new createError.Conflict("User already exists");

      const hashedPassword = await bcrypt.hash(password, 12);
      const emailVerificationToken = crypto.randomBytes(16).toString("hex");

      await AdminModel.create({
        institute_name,
        email,
        uuid: uuidv4(),
        password: hashedPassword,
        address,
        email_verification_token: emailVerificationToken,
        email_verification_token_expiry: new Date(Date.now() + 3600000),
      });

      // await sendEmailVerificationMail(email, emailVerificationToken);

      return res.status(201).json({
        message: "Account created successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  public async verifyAdminAccount(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const token = req.query.token;

      if (!token) throw new createError.BadRequest("Token is required");

      const admin = await AdminModel.findOne({
        email_verification_token: token,
      });

      if (!admin) throw new createError.NotFound("Invalid or expired token");

      admin.verified = true;
      admin.email_verification_token = undefined;
      admin.email_verification_token_expiry = undefined;

      await admin.save();

      return res
        .status(200)
        .send("Email verified successfully. You can now login");
    } catch (error) {
      next(error);
    }
  }

  public async loginAdminAccount(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { email, password } = loginAccountValidator.parse(req.body);

      const admin = await AdminModel.findOne({ email });

      if (!admin) throw new createError.NotFound("User not found");

      if (!admin.verified)
        throw new createError.Unauthorized("User not verified");

      const isPasswordValid = await bcrypt.compare(password, admin.password);

      if (!isPasswordValid)
        throw new createError.Unauthorized("Invalid password");

      const token = await jwt.sign(
        { id: admin._id.toString() },
        config.JWT_SECRET,
        { expiresIn: "180d" }
      );

      res.setHeader("Authorization", `Bearer ${token}`);

      return res.status(200).json({
        token,
        user: {
          email: admin.email,
          institute_name: admin.institute_name,
          address: admin.address,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public async addDepartments(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = req.admin;
      const departments = req.body.departments as string[];

      const updatedAdmin = await AdminModel.findByIdAndUpdate(
        admin.id,
        { $addToSet: { departments: { $each: departments } } },
        { new: true }
      );

      return res.status(200).json({
        message: "Departments added successfully",
        departments: updatedAdmin?.departments,
      });
    } catch (error) {
      next(error);
    }
  }

  public async addResearcher(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = req.admin;
      const adminData = await AdminModel.findById(admin.id, {
        departments: 1,
        institute_name: 1,
      });

      let { scholar_id, email, department, positions, gender } =
        addResearcherValidator.parse(req.body);

      if (positions?.length) {
        // Check for multiple current positions
        const currentPositions = positions.filter(
          (position) => position.current
        );
        if (currentPositions.length > 1) {
          throw new createError.BadRequest(
            "Only one current position is allowed"
          );
        }

        positions.forEach((position, index) => {
          if (position.current) {
            if (position.end) {
              throw new createError.BadRequest(
                `Position ${
                  index + 1
                }: Current position should not have an end date`
              );
            }
          } else {
            if (!position.start || !position.end) {
              throw new createError.BadRequest(
                `Position ${
                  index + 1
                }: Both start and end dates are required for non-current positions`
              );
            }

            if (new Date(position.start) > new Date(position.end)) {
              throw new createError.BadRequest(
                `Position ${index + 1}: Start date must be before end date`
              );
            }
          }
        });

        const sortedPositions = [...positions].sort(
          (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
        );

        const nonCurrentPositions = sortedPositions.filter(
          (pos) => !pos.current
        );
        for (let i = 0; i < nonCurrentPositions.length; i++) {
          for (let j = i + 1; j < nonCurrentPositions.length; j++) {
            const currentPos = nonCurrentPositions[i];
            const nextPos = nonCurrentPositions[j];

            if (
              currentPos.end &&
              new Date(currentPos.end) >= new Date(nextPos.start)
            ) {
              throw new createError.BadRequest(
                "Positions have overlapping date ranges"
              );
            }
          }
        }

        const uniquePositions = sortedPositions.filter(
          (pos, index, self) =>
            index ===
            self.findIndex(
              (t) =>
                t.position === pos.position &&
                t.institute === pos.institute &&
                t.start === pos.start &&
                t.end === pos.end
            )
        );

        positions = uniquePositions;
      }

      if (positions && positions.length > 0) {
        positions[positions.length - 1].institute = adminData!.institute_name;
      }

      const researcher = await ResearcherModel.findOne({ scholar_id });

      if (researcher) {
        if (!researcher.admin_id) {
          // @ts-ignore
          researcher.admin_id = admin.id as mongoose.Types.ObjectId;

          if (positions) {
            researcher.positions.push(...positions);
          }

          researcher.department = department;
          researcher.email = email;

          await researcher.save();

          return res.status(200).json({
            message: "Researcher added successfully",
          });
        } else if (researcher.admin_id.toString() === admin.id.toString()) {
          throw new createError.BadRequest("Researcher already added by you");
        } else {
          throw new createError.BadRequest(
            "Researcher already added by another admin"
          );
        }
      }

      if (!adminData?.departments.includes(department)) {
        throw new createError.BadRequest(
          "Please add the department before adding researcher"
        );
      }

      const researcherData: ResearcherData =
        await researcherScrapper.getResearcherData(scholar_id);

      const newResearcher = await ResearcherModel.create({
        scholar_id,
        email,
        department,
        positions,
        admin_id: admin.id,
        citations: researcherData.citations,
        h_index: researcherData.hIndex,
        i_index: researcherData.i10Index,
        name: researcherData.name,
        gender,
      });

      await rabbitmq.publish(
        queues.RESEARCHER_QUEUE,
        JSON.stringify({
          admin_id: newResearcher.admin_id,
          researcher: {
            researcher_id: newResearcher._id,
            name: newResearcher.name,
            scholar_id: newResearcher.scholar_id,
          },
        })
      );

      return res.status(201).json({
        message: "Researcher added successfully",
      });
    } catch (error) {
      console.log(error);
      next(error);
    }
  }

  public async bulkUploadResearchers(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      // Check if file is uploaded
      if (!req.file) {
        throw new createError.BadRequest("Excel file is required");
      }

      // Read the uploaded Excel file
      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert Excel to JSON
      const data = xlsx.utils.sheet_to_json(worksheet);

      // Validate the uploaded data
      const parsedData = bulkResearcherUploadSchema.parse({
        scholars: data.map((row: any) => ({
          scholar_id: row["Scholar ID"],
          email: row["Email"],
          department: row["Department"],
          gender: row["Gender"],
          positions: [
            row["Position 1"]
              ? {
                  position: row["Position 1"],
                  institute: row["Institute 1"],
                  start: row["Start Date 1"],
                  end: row["End Date 1"] || null,
                  current: row["Current 1"] === "Yes",
                }
              : null,
            row["Position 2"]
              ? {
                  position: row["Position 2"],
                  institute: row["Institute 2"],
                  start: row["Start Date 2"],
                  end: row["End Date 2"] || null,
                  current: row["Current 2"] === "Yes",
                }
              : null,
            row["Position 3"]
              ? {
                  position: row["Position 3"],
                  institute: row["Institute 3"],
                  start: row["Start Date 3"],
                  end: row["End Date 3"] || null,
                  current: row["Current 3"] === "Yes",
                }
              : null,
          ].filter(Boolean),
        })),
      });

      const admin = req.admin;
      const adminData = await AdminModel.findById(admin.id, {
        departments: 1,
        institute_name: 1,
      });

      // Validate departments and process researchers
      const processedResearchers = [];
      const errors: string[] = [];

      for (const scholarData of parsedData.scholars) {
        try {
          // Check if department exists
          if (!adminData?.departments.includes(scholarData.department)) {
            errors.push(
              `Department ${scholarData.department} not added for this admin`
            );
            continue;
          }

          // Validate positions
          if (scholarData.positions.length > 0) {
            // Check for multiple current positions
            const currentPositions = scholarData.positions.filter(
              (position) => position.current
            );
            if (currentPositions.length > 1) {
              errors.push(
                `Scholar ${scholarData.scholar_id}: Only one current position is allowed`
              );
              continue;
            }

            // Validate position dates
            scholarData.positions.forEach((position, index) => {
              if (position.current) {
                if (position.end) {
                  errors.push(
                    `Scholar ${scholarData.scholar_id}, Position ${
                      index + 1
                    }: Current position should not have an end date`
                  );
                  throw new Error("Invalid position");
                }
              } else {
                if (!position.start || !position.end) {
                  errors.push(
                    `Scholar ${scholarData.scholar_id}, Position ${
                      index + 1
                    }: Both start and end dates are required for non-current positions`
                  );
                  throw new Error("Invalid position");
                }

                if (new Date(position.start) > new Date(position.end)) {
                  errors.push(
                    `Scholar ${scholarData.scholar_id}, Position ${
                      index + 1
                    }: Start date must be before end date`
                  );
                  throw new Error("Invalid position");
                }
              }
            });

            // Check for overlapping positions
            const sortedPositions = [...scholarData.positions].sort(
              (a, b) =>
                new Date(a.start).getTime() - new Date(b.start).getTime()
            );
            const nonCurrentPositions = sortedPositions.filter(
              (pos) => !pos.current
            );
            for (let i = 0; i < nonCurrentPositions.length; i++) {
              for (let j = i + 1; j < nonCurrentPositions.length; j++) {
                const currentPos = nonCurrentPositions[i];
                const nextPos = nonCurrentPositions[j];

                if (
                  currentPos.end &&
                  new Date(currentPos.end) >= new Date(nextPos.start)
                ) {
                  errors.push(
                    `Scholar ${scholarData.scholar_id}: Positions have overlapping date ranges`
                  );
                  throw new Error("Overlapping positions");
                }
              }
            }
          }

          // Check if researcher already exists
          const existingResearcher = await ResearcherModel.findOne({
            scholar_id: scholarData.scholar_id,
          });

          if (existingResearcher) {
            if (existingResearcher.admin_id) {
              if (
                existingResearcher.admin_id.toString() === admin.id.toString()
              ) {
                errors.push(
                  `Scholar ${scholarData.scholar_id} already added by you`
                );
              } else {
                errors.push(
                  `Scholar ${scholarData.scholar_id} already added by another admin`
                );
              }
              continue;
            }
          }

          // Fetch researcher data
          const researcherData = await researcherScrapper.getResearcherData(
            scholarData.scholar_id
          );

          // Add last position's institute as current admin's institute
          if (scholarData.positions.length > 0) {
            scholarData.positions[scholarData.positions.length - 1].institute =
              adminData!.institute_name;
          }

          // Create researcher
          const newResearcher = await ResearcherModel.create({
            scholar_id: scholarData.scholar_id,
            email: scholarData.email,
            department: scholarData.department,
            positions: scholarData.positions,
            admin_id: admin.id,
            citations: researcherData.citations,
            h_index: researcherData.hIndex,
            i_index: researcherData.i10Index,
            name: researcherData.name,
            gender: scholarData.gender,
          });

          // Publish to queue
          await rabbitmq.publish(
            queues.RESEARCHER_QUEUE,
            JSON.stringify({
              admin_id: newResearcher.admin_id,
              researcher: {
                researcher_id: newResearcher._id,
                name: newResearcher.name,
                scholar_id: newResearcher.scholar_id,
              },
            })
          );

          processedResearchers.push(newResearcher);
        } catch (scholarError) {
          // Individual scholar processing error
          if (scholarError instanceof Error) {
            errors.push(scholarError.message);
          }
        }
      }

      // Respond with results
      return res.status(200).json({
        message: "Bulk upload processed",
        processed: processedResearchers.length,
        total: parsedData.scholars.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      // Validation or other errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid Excel format",
          errors: error.errors.map((e) => e.message),
        });
      }
      next(error);
    }
  }

  public async refetchResearcherData(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const admin = req.admin;
      const { id } = req.params;

      if (!id) throw new createError.BadRequest("Scholar ID is required");

      const researcher = await ResearcherModel.findOne({
        scholar_id: id,
        admin_id: admin.id,
      });

      if (!researcher) {
        throw new createError.NotFound("Researcher not found");
      }

      if (
        researcher.lastFetch &&
        // @ts-ignore
        new Date().getTime() - new Date(researcher.lastFetch).getTime() <
          24 * 60 * 60 * 1000
      ) {
        throw new createError.BadRequest(
          `You can fetch after ${
            24 -
            Math.floor(
              (new Date().getTime() -
                // @ts-ignore
                new Date(researcher.lastFetch).getTime()) /
                (60 * 60 * 1000)
            )
          } hours (24 hours cooldown)`
        );
      }

      await PaperModel.deleteMany({
        "researcher.researcher_id": researcher._id,
      });

      await rabbitmq.publish(
        queues.RESEARCHER_QUEUE,
        JSON.stringify({
          admin_id: researcher.admin_id,
          researcher: {
            researcher_id: researcher._id,
            name: researcher.name,
            scholar_id: researcher.scholar_id,
          },
        })
      );

      return res.status(200).json({
        message: "Data fetch initiated",
      });
    } catch (error) {
      next(error);
    }
  }
}
