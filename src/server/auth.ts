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
  isAdminEmail,
  updateUserLastActive,
} from "@/server/db";

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

      // Check if user's email is in admin_emails and update role if needed
      let role = user.role;
      if (user.email && user.role !== "admin") {
        const isAdmin = await isAdminEmail(user.email);
        if (isAdmin) {
          role = "admin";
          // Update user role in database
          await updateUserById(user.id, { role: "admin" });
        }
      }

      return {
        id: user.id,
        email: user.email,
        name: user.username,
        image: user.avatarUrl || null,
        role: role,
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
    error: "/auth",
  },
  providers,
  events: {},
  callbacks: {
    async signIn({ account, profile, user }) {
      // Allow credentials provider without database check
      if (account?.provider !== "google") {
        return true;
      }

      // Google OAuth flow
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
        // Check if user exists
        const existing = await findUserByEmail(email);
        if (existing) {
          // Check if user should be admin based on admin_emails list
          const isAdmin = await isAdminEmail(email);
          if (isAdmin && existing.role !== "admin") {
            await updateUserById(existing.id, { role: "admin" });
          }
          
          // Update avatar if changed
          if (profilePicture && profilePicture !== existing.avatarUrl) {
            await updateUserById(existing.id, { avatarUrl: profilePicture });
          }
          return true;
        }

        // Create new user from Google
        const adminRole = await isAdminEmail(email);
        await createUser({
          username: displayName,
          email,
          phone: "",
          avatarUrl: profilePicture,
          passwordHash: null,
          role: adminRole ? "admin" : "user",
        });
      } catch (error) {
        console.error("Failed to sync Google user:", error);
        // Check if user was created despite error
        const fallbackUser = await findUserByEmail(email);
        if (!fallbackUser) {
          return false;
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.username = user.name ?? undefined;
        token.role = (user as any).role;
        token.phone = (user as any).phone;
        token.avatarUrl = user.image ?? undefined;
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

      // Update user last active time
      if (token.userId) {
        await updateUserLastActive(token.userId as string).catch(() => {});
      }

      return session;
    },
  },
};

export const getServerAuthSession = () => getServerSession(authOptions);
