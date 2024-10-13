// global.d.ts
import { Connection } from "mongoose";

// Ensure this file is treated as a module.
export {};

declare global {
  var mongooseConnections: {
    [key: string]: {
      conn: Connection;
    };
  };

  var ethereum: any;
}

