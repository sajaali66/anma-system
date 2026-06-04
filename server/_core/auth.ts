import "dotenv/config";
import { SignJWT, jwtVerify } from "jose";

type SessionPayload = {
  userId: number;
  email: string;
  role: "user" | "admin";
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const secret = getJwtSecret();

  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const secret = getJwtSecret();

    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    const userId = payload.userId;
    const email = payload.email;
    const role = payload.role;

    if (
      typeof userId !== "number" ||
      typeof email !== "string" ||
      (role !== "user" && role !== "admin")
    ) {
      return null;
    }

    return {
      userId,
      email,
      role,
    };
  } catch (error) {
    return null;
  }
}