import { connectToMongoDb } from "@/app/lib/mongodb/client";

async function doTransaction<T>(
  callback: (session: any) => Promise<T>,
  maxRetryTimes: number = 0,
): Promise<T> {
  let retry = 0;

  while (true) {
    try {
      return await executeTransaction(callback);
    } catch (error) {
      if (retry < maxRetryTimes) {
        retry += 1;
        console.log(`Retrying transaction... attempt ${retry}`);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Add latency
        continue;
      } else {
        throw error;
      }
    }
  }
}

async function executeTransaction<T>(
  callback: (session: any) => Promise<T>,
): Promise<T> {
  const conn = connectToMongoDb();
  const session = await conn.startSession();
  session.startTransaction();
  try {
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export default doTransaction;
