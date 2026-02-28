import { compare } from "bcryptjs";
import {
  getServerSession,
  type NextAuthOptions,
} from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import {
  createUser,
  findUserByEmail,
  findUserByIdentifier,
  updateUserById,
} from "@/server/db";

const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      identifier: { label: "Username or Email", type: "text" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const identifier = credentials?.identifier?.trim() ?? "";
      const password = credentials?.password ?? "";

      if (!identifier || !password) {
        return null;
      }

      const user = await findUserByIdentifier(identifier);
      if (!user || !user.passwordHash) {
        return null;
      }

      const isValid = await compare(password, user.passwordHash);
      if (!isValid) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.username,
        image: user.avatarUrl || null,
        role: user.role,
        phone: user.phone,
      };
    },
  }),
];

if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? "tokko-dev-secret",
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth",
  },
  providers,
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider !== "google") {
        return true;
      }

      const email = (profile?.email ?? user?.email ?? "").trim().toLowerCase();
      if (!email) {
        return false;
      }

      const displayName =
        (profile?.name?.trim() || user?.name?.trim() || email.split("@")[0] || "User Tokko").slice(
          0,
          50,
        );
      const rawProfile = profile as Record<string, unknown> | null | undefined;
      const profilePicture =
        rawProfile && typeof rawProfile.picture === "string" ? rawProfile.picture : "";

      try {
        const existing = await findUserByEmail(email);
        if (existing) {
          if (profilePicture && profilePicture !== existing.avatarUrl) {
            await updateUserById(existing.id, { avatarUrl: profilePicture });
          }
          return true;
        }

        await createUser({
          username: displayName,
          email,
          phone: "",
          avatarUrl: profilePicture,
          passwordHash: null,
          role: adminEmail && email === adminEmail ? "admin" : "user",
        });
      } catch (error) {
        console.error("Failed to sync Google user to database:", error);
        const fallbackUser = await findUserByEmail(email);
        if (!fallbackUser) {
          return false;
        }
      }

      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user?.email) {
        const dbUser = await findUserByEmail(user.email);
        if (dbUser) {
          token.userId = dbUser.id;
          token.username = dbUser.username;
          token.role = dbUser.role;
          token.phone = dbUser.phone;
          token.avatarUrl = dbUser.avatarUrl;
        }
      }

      if (!token.userId && token.email) {
        const dbUser = await findUserByEmail(token.email);
        if (dbUser) {
          token.userId = dbUser.id;
          token.username = dbUser.username;
          token.role = dbUser.role;
          token.phone = dbUser.phone;
          token.avatarUrl = dbUser.avatarUrl;
        }
      }

      if (trigger === "update" && token.email) {
        const dbUser = await findUserByEmail(token.email);
        if (dbUser) {
          token.userId = dbUser.id;
          token.username = dbUser.username;
          token.role = dbUser.role;
          token.phone = dbUser.phone;
          token.avatarUrl = dbUser.avatarUrl;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (!session.user) {
        return session;
      }

      session.user.id = token.userId ?? "";
      session.user.username = token.username ?? session.user.name ?? "User";
      session.user.role = token.role ?? "user";
      session.user.phone = token.phone ?? "";
      session.user.image = token.avatarUrl || session.user.image || null;

      return session;
    },
  },
};

export const getServerAuthSession = () => getServerSession(authOptions);
