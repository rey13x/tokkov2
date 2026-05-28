import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      username: string;
      email?: string;
      role: "user" | "admin";
      phone: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    username?: string;
    email?: string;
    role?: "user" | "admin";
    phone?: string;
    avatarUrl?: string;
  }
}
