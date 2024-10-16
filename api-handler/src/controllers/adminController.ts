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
        { expiresIn: "1d" }
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

  public async addReseacher(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = req.admin;
      const { scholar_id, email, department, positions, gender } =
        addResearcherValidator.parse(req.body);

      if (positions?.length) {
        for (const position of positions) {
          if (position.end) {
            if (new Date(position.start) > new Date(position.end))
              throw new createError.BadRequest(
                "End date must be greater than start date"
              );
          }
        }
      }

      const researcher = await ResearcherModel.findOne({ scholar_id });

      if (researcher) {
        if (researcher.admin_id!.toString() === admin.id.toString())
          throw new createError.BadRequest("Researcher already added by you");
        else
          throw new createError.BadRequest(
            "Researcher already added by another admin"
          );
      }

      const adminDepartments = await AdminModel.findById(admin.id, {
        departments: 1,
      });

      if (!adminDepartments?.departments.includes(department))
        throw new createError.BadRequest(
          "Please add the department before adding researcher"
        );

      const reseacherData: ResearcherData =
        await researcherScrapper.getResearcherData(scholar_id);

      const newResearcher = await ResearcherModel.create({
        scholar_id,
        email,
        department,
        positions,
        admin_id: admin.id,
        citations: reseacherData.citations,
        h_index: reseacherData.hIndex,
        i_index: reseacherData.i10Index,
        name: reseacherData.name,
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
