import { Request, Response, NextFunction } from "express";
import createError from "http-errors";
import jwt from "jsonwebtoken";
import { AdminModel } from "../models/admin";
import { config } from "../config";
import mongoose from "mongoose";

declare global {
  namespace Express {
    interface Request {
      admin: AdminInterface;
    }
  }
}

interface AdminInterface {
  id: mongoose.Types.ObjectId | string;
  email: string;
}

export const adminAuthHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {

  console.log("adminAuthHandler");
  try {
    if (!req.headers.authorization)
      throw new createError.Unauthorized("Token is absent");

    const [_, token] = req.headers.authorization.split(" ");

    const decoded = jwt.verify(token, config.JWT_SECRET) as AdminInterface;

    const admin = await AdminModel.findById(decoded.id);

    if (!admin?.verified)
      throw new createError.Unauthorized("User not verified");

    if (!admin)
      throw new createError.Unauthorized("Invalid token, or no user found");

    req.admin = {
      id: admin._id,
      email: admin.email,
    };

    next();
  } catch (error) {
    next(error);
  }
};
