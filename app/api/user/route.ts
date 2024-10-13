import { type NextRequest } from "next/server";
import User, { createUser } from "@/app/lib/models/User";

// This api is used to get user information by user_id or username
// GET /api/user?user_id=xxx
// GET /api/user?username=xxx
// If user_id is provided, username will be ignored
// If both user_id and username are not provided, return 400
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const user_id = searchParams.get("user_id");
  const username = searchParams.get("username");
  if (!user_id && !username) {
    return new Response("Parameter user_id or username is required", {
      status: 400,
    });
  }

  if (!!user_id && !!username) {
    return new Response(
      "Parameter user_id and username cannot be provided at the same time",
      {
        status: 400,
      },
    );
  }

  let findOptions: any = {};
  if (user_id) {
    findOptions["user_id"] = user_id;
  }

  if (username) {
    findOptions["username"] = username;
  }

  const user = await User.findOne(findOptions, [
    "user_id",
    "username",
    "priviledge",
  ]);
  if (user) {
    return new Response(JSON.stringify(user), { status: 200 });
  } else {
    return new Response("User not found", { status: 404 });
  }
}

// This api is used to create a new user
// username and password is required in the post form data
// PUT /api/user
// {
//  "username": "xxx",
//  "password": "xxx"
// }
// If user already exists, return 400
// If user is created successfully, return 200
// If user creation failed, return 500
// The password will be hashed before saving
// The password hashing is done in the model
export async function PUT(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const username = searchParams.get("username");
  const password = searchParams.get("password");
  if (!username || !password) {
    return new Response("Parameter username and password are required", {
      status: 400,
    });
  }

  // find duplicated user
  const user = await User.findOne({ username });
  if (user) {
    return new Response("User already exists", { status: 400 });
  }

  // create new user
  const newUser = await createUser(username, password);
  if (!newUser) {
    return new Response("Failed to create user", { status: 500 });
  }

  return new Response(JSON.stringify(newUser), { status: 200 });
}
