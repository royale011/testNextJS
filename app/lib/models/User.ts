import { Document, Model, model, models, Schema } from "mongoose";
import { connectToMongoDb } from "@/app/lib/mongodb/client";
import { v4 as uuidv4 } from "uuid";
import logger from "@/app/lib/logger/winstonLogger";
import bcrypt from "bcryptjs";

export enum Priviledge {
  ADMIN = "admin",
  USER = "user",
}

export interface IUser extends Document {
  // unique user id
  user_id: string;
  // user name
  username: string;
  // password, hashed
  password: string;
  // user priviledge
  priviledge?: string;
}

export interface IUserReturn {
  // unique user id
  user_id: string;
  // user name
  username: string;
  // user priviledge
  priviledge?: string;
}

const UserSchema = new Schema<IUser>({
  user_id: { type: String, required: true, unique: true, default: uuidv4 },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  priviledge: { type: String, required: false },
});

const connection = connectToMongoDb();
const User =
  models.User || connection.model<IUser>("User", UserSchema, "users");
export default User;

// create the hash of the password
// parameter password: the password to be hashed
// return the hashed password
// return empty string if error
// the salt rounds is defined in the environment variable SALT_ROUNDS
// default is 10
export async function hash(password: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(Number(process.env.SALT_ROUNDS) || 10);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    logger.error(error);
    return "";
  }
}

// create a new user
// return the user object if user is created successfully
// return null if user creation failed
// username and password are required
// priviledge is optional
// the password will be hashed before saving
export async function createUser(
  username: string,
  password: string,
  priviledge?: string,
): Promise<IUserReturn | null> {
  // hash the password here
  const hashedPassword = await hash(password);
  if (hashedPassword === "") {
    return null;
  }

  const user = new User({
    username,
    password: hashedPassword,
    priviledge,
  });

  const saveResult = await user.save();

  if (saveResult) {
    logger.debug("User created successfully: ", username);
    return {
      user_id: user.user_id,
      username: user.username,
      priviledge: user.priviledge,
    };
  }

  logger.error("User creation failed: ", username);
  return null;
}

// login user with password
// return the user object if user login successfully
// return null if user login failed
// username and password are required
// the password will be hashed
export async function userLogin(
  username: string,
  password: string,
): Promise<IUserReturn | null> {
  const user = await User.findOne({ username });
  if (user) {
    const compareResult = await bcrypt.compare(password, user.password);
    if (!compareResult) {
      logger.error("User password not match: ", username);
      return null;
    }

    logger.debug("User login successfully: ", username);
    return {
      user_id: user.user_id,
      username: user.username,
      priviledge: user.priviledge,
    };
  }

  logger.error("User not found: ", username);
  return null;
}
