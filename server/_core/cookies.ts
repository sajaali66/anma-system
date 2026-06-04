import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): CookieOptions {
  const isLocal = LOCAL_HOSTS.has(req.hostname);

  const isSecure = isSecureRequest(req);

  return {
    httpOnly: true,
    path: "/",

    // 👇 مهم جدًا
    sameSite: isLocal ? "lax" : "none",

    // 👇 secure فقط إذا HTTPS
    secure: isSecure && !isLocal,
  };
}