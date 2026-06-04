import type { Express, Request, Response } from "express";
import { createSessionToken } from "./auth";
import { getSessionCookieOptions } from "./cookies";

export function registerOAuthRoutes(app: Express) {
  app.get("/api/auth/quick-admin", async (_req: Request, res: Response) => {
    try {
      res.status(200).json({
        success: true,
        email: "admin@test.com",
        password: "123456",
        message: "Quick admin is ready",
      });
    } catch (error) {
      console.error("[Auth] Quick admin creation failed", error);
      res.status(500).json({ error: "Quick admin creation failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as {
        email?: string;
        password?: string;
      };

      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      // دخول مؤقت بدون Database
      const sessionToken = await createSessionToken({
        userId: 1,
        email,
        role: "admin",
      });

      const cookieOptions = getSessionCookieOptions(req);

      res.cookie("sessionToken", sessionToken, cookieOptions);
      res.status(200).json({
        success: true,
        user: {
          id: 1,
          name: "Saja",
          email,
          role: "admin",
        },
      });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      const cookieOptions = getSessionCookieOptions(req);
      res.clearCookie("sessionToken", cookieOptions);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("[Auth] Logout failed", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  app.post("/api/auth/register-admin", async (req: Request, res: Response) => {
    try {
      const { name, email, password } = req.body as {
        name?: string;
        email?: string;
        password?: string;
      };

      if (!name || !email || !password) {
        res.status(400).json({ error: "Name, email, and password are required" });
        return;
      }

      res.status(201).json({
        success: true,
        message: "Admin account created successfully",
        user: {
          id: 1,
          name,
          email,
          role: "admin",
        },
      });
    } catch (error) {
      console.error("[Auth] Admin registration failed", error);
      res.status(500).json({ error: "Admin registration failed" });
    }
  });
}