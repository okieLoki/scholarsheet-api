import { NextFunction, Request, Response } from "express";
import { AdminModel } from "../models/admin";
import {
  addResearcherValidator,
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

  
}
