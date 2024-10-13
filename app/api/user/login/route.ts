import { type NextRequest } from "next/server";
import { userLogin } from "@/app/lib/models/User";

// Login user with username and password
// GET /api/user/login?username=xxx&password=xxx
// Return the user object if user login
// Return 404 if user login failed
// Parameter username and password are required
// The password will be hashed before comparing
// The password hashing is done in the model
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const username = searchParams.get("username");
  const password = searchParams.get("password");
  if (!username || !password) {
    return new Response("Parameter username and password are required", {
      status: 400,
    });
  }

  const user = await userLogin(username, password);
  if (!user) {
    return new Response("User login failed", { status: 404 });
  }

  return new Response(JSON.stringify(user), { status: 200 });
}
