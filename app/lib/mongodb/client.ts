import mongoose, { Connection } from "mongoose";

export function isDuplicateKeyError(error: any): boolean {
  return error && error.code == 11000;
}

declare global {
  var mongoose: any; // This must be a `var` and not a `let / const`
}

let cached = global.mongooseConnections;

if (!cached) {
  cached = global.mongooseConnections = {};
}

// a common function to connect to mongodb
function connectToDatabase(uri: string): Connection {
  let cached = global.mongooseConnections[uri];
  if (!cached) {
    cached = global.mongooseConnections[uri] = {
      conn: mongoose.createConnection(uri, { autoIndex: false }),
    };
  }
  return cached.conn;
}

// 连接至discord库
export function connectToMongoDb(): Connection {
  const mongoURI = process.env.MONGODB_URI!;
  if (!mongoURI) {
    throw new Error("Please define the MONGODB_URI environment variable");
  }
  return connectToDatabase(mongoURI);
}

