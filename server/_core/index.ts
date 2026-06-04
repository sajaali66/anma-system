import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { createSessionToken, verifySessionToken } from "./auth";
import { getUserByEmail, getUserById } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.listen(port, () => {
      server.close(() => resolve(true));
    });

    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }

  throw new Error("No port available");
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/health", (_req, res) => {
    res.json({ success: true });
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body ?? {};

      const user = await getUserByEmail(String(email));

      if (!user || user.passwordHash !== String(password)) {
        return res.status(401).json({
          error: "بيانات الدخول غير صحيحة",
        });
      }

      const token = await createSessionToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      res.cookie("sessionToken", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({
        error: "Login failed",
      });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const token = req.cookies?.sessionToken;

      if (!token) {
        return res.json(null);
      }

      const payload = await verifySessionToken(token);

      if (!payload?.userId) {
        return res.json(null);
      }

      const user = await getUserById(payload.userId);

      if (!user) {
        return res.json(null);
      }

      return res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      });
    } catch {
      return res.json(null);
    }
  });

  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie("sessionToken", {
      path: "/",
    });

    res.json({ success: true });
  });

  registerOAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = await findAvailablePort(3000);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();