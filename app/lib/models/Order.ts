import { Document, Model, model, models, Schema } from "mongoose";
import { connectToMongoDb } from "@/app/lib/mongodb/client";
import { v4 as uuidv4 } from "uuid";
import User from "./User";
import Book from "./Book";
import doTransaction from "@/app/lib/mongodb/transaction";
import logger from "@/app/lib/logger/winstonLogger";

export enum OrderStatus {
  PENDING = 0,
  CONFIRMED = 1,
  CANCELLED = 2,
  DELIVERED = 3,
}

export interface IOrderUserId {
  // user id
  user_id: string;
}

export interface IOrderBasicInfo extends IOrderUserId {
  // unique order id
  order_id: string;
  // order status
  status?: number;
}

export interface IOrderWithBooks extends IOrderUserId {
  // books
  books: Map<string, number>;
}

export interface IOrder extends IOrderBasicInfo, IOrderWithBooks, Document {}

const OrderSchema = new Schema<IOrder>({
  order_id: { type: String, required: true, unique: true, default: uuidv4 },
  user_id: { type: String, required: true },
  books: { type: Map, required: true },
  status: { type: Number, required: false, default: OrderStatus.PENDING },
});

const connection = connectToMongoDb();
const Order =
  models.Order || connection.model<IOrder>("Order", OrderSchema, "orders");
export default Order;

// create new orders
// input: orderInfo: IOrderWithBooks[]
// output: IOrder[] | String
// return orders if successful, error message if failed
export async function createOrders(
  orderInfo: IOrderWithBooks[],
): Promise<IOrder[] | String> {
  try {
    return doTransaction(async (session) => {
      let allBookCount = new Map();
      for (const order of orderInfo) {
        if (
          !order ||
          order === undefined ||
          !order.user_id ||
          order.user_id === undefined ||
          !order.books ||
          order.books === undefined ||
          order.books.size === 0
        ) {
          throw new Error("Order must have at least one book");
        }

        order.books = new Map(Object.entries(order.books));

        // check if any book count is not greater than 0
        const orderCounts = Array.from(order.books.values());
        if (orderCounts.some((count) => count <= 0)) {
          throw new Error("Book order count must be greater than 0");
        }

        order.books.forEach((count, bookId) => {
          allBookCount.set(bookId, (allBookCount.get(bookId) || 0) + count);
        });
      }

      // check if user exists
      var userIds = Array.from(
        new Set(orderInfo.map((order) => order.user_id)),
      );
      const users = await User.find({
        user_id: { $in: userIds },
      });

      if (users.length !== userIds.length) {
        throw new Error("Some users are not found");
      }

      // check if all books are valid

      const bookIds = Array.from(
        new Set(
          orderInfo.map((order) => Array.from(order.books.keys())).flat(),
        ),
      );

      console.log(bookIds);

      const books = await Book.find({
        book_id: { $in: bookIds },
        deleted: false,
      });

      if (books.length !== bookIds.length) {
        throw new Error("Some books are not found");
      }

      console.log(books);

      // check if all books have enough stocks
      books.forEach((book) => {
        const bookOrderCount = allBookCount.get(book.book_id) || 0;
        if (book.stock_count < bookOrderCount) {
          throw new Error("Not enough stock for book ", book.book_id);
        }
      });

      const bulkOps = orderInfo.map((order) => {
        return {
          insertOne: {
            document: {
              user_id: order.user_id,
              books: order.books,
            },
          },
        };
      });

      return Order.bulkWrite(bulkOps).then(() => {
        return Order.find({
          user_id: { $in: Array.from(userIds) },
        });
      });
    });
  } catch (error) {
    logger.error("Error upserting order: ", error);
    return `${error}`;
  }
}

export async function updateOrderStatus(
  orderInfo: IOrderBasicInfo[],
): Promise<IOrder[] | String> {
  try {
    return doTransaction(async (session) => {
      const orderIds = Array.from(
        new Set(orderInfo.map((order) => order.order_id)),
      );
      const orders = await Order.find({
        order_id: { $in: orderIds },
      });
      if (orders.length !== orderIds.length) {
        throw new Error("Some orders are not found");
      }

      // can't update delivered orders
      if (orders.some((order) => order.status === OrderStatus.DELIVERED)) {
        throw new Error("Can't update delivered orders");
      }

      const bulkOps = orderInfo.map((order) => {
        return {
          updateOne: {
            filter: {
              order_id: order.order_id,
            },
            update: { $set: { status: order.status } },
          },
        };
      });

      // for any order that is not cancelled, check the stock availability
      const notCancelledOrders = orders.filter((order) => {
        // find order in orderInfo
        const info = orderInfo.find((info) => info.order_id === order.order_id);
        if (info === undefined) {
          return false;
        }
        return info.status !== OrderStatus.CANCELLED;
      });

      const bookIds = Array.from(
        new Set(
          notCancelledOrders
            .map((order) => Array.from(order.books.keys()))
            .flat(),
        ),
      );

      console.log(bookIds);

      const books = await Book.find({
        book_id: { $in: bookIds },
        deleted: false,
      });

      if (books.length !== bookIds.length) {
        throw new Error("Some books are not found");
      }

      const allBookCount = new Map();
      notCancelledOrders.forEach((order) => {
        order.books.forEach((count: number, bookId: string) => {
          allBookCount.set(bookId, (allBookCount.get(bookId) || 0) + count);
        });
      });

      books.forEach((book) => {
        const bookOrderCount = allBookCount.get(book.book_id) || 0;
        if (book.stock_count < bookOrderCount) {
          throw new Error("Not enough stock for book ", book.book_id);
        }
      });

      // for all delivered orders, reduce the stock
      const allDeliveredOrders = orders.filter((order) => {
        // find order in orderInfo
        const info = orderInfo.find((info) => info.order_id === order.order_id);
        if (info === undefined) {
          return false;
        }
        return info.status === OrderStatus.DELIVERED;
      });

      const allDeliveredBookCount = new Map();
      allDeliveredOrders.forEach((order) => {
        order.books.forEach((count: number, bookId: string) => {
          allDeliveredBookCount.set(
            bookId,
            (allDeliveredBookCount.get(bookId) || 0) + count,
          );
        });
      });

      const bulkUpdateStockOps = Array.from(allDeliveredBookCount.keys()).map(
        (bookId) => {
          return {
            updateOne: {
              filter: {
                book_id: bookId,
              },
              update: {
                $inc: { stock_count: -allDeliveredBookCount.get(bookId) },
              },
            },
          };
        },
      );

      console.log(bulkUpdateStockOps);

      return await Book.bulkWrite(bulkUpdateStockOps).then(async () => {
        return Order.bulkWrite(bulkOps).then(() => {
          return Order.find({
            order_id: { $in: Array.from(orderIds) },
          });
        });
      });
    });
  } catch (error) {
    logger.error("Error upserting order: ", error);
    return `${error}`;
  }
}
