import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

// Decoded JWT payload for our session
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      login: string;
      name: string;
      rol: string;
      empresaId: string;
      empresaNombre: string;
      empresaPlan: string;
      permisos: string[];
      sucursalesPermitidas: string[];
      grupoId?: string | null;
      debeCambiarPass: boolean;
    };
  }
  interface User {
    id: string;
    login: string;
    name: string;
    rol: string;
    empresaId: string;
    empresaNombre: string;
    empresaPlan: string;
    permisos: string[];
    sucursalesPermitidas: string[];
    grupoId?: string | null;
    debeCambiarPass: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    login: string;
    name: string;
    rol: string;
    empresaId: string;
    empresaNombre: string;
    empresaPlan: string;
    permisos: string[];
    sucursalesPermitidas: string[];
    grupoId?: string | null;
    debeCambiarPass: boolean;
  }
}

function parseArray(v: string | null | undefined): string[] {
  if (!v) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        login: { label: "Login", type: "text" },
        password: { label: "Password", type: "password" },
        empresaId: { label: "Empresa", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials?.password) {
          throw new Error("Login y contraseña son requeridos");
        }

        const usuario = await db.usuario.findFirst({
          where: {
            login: credentials.login,
            activo: true,
          },
          include: {
            empresa: true,
            grupo: true,
          },
        });

        if (!usuario) {
          throw new Error("Usuario no encontrado o inactivo");
        }

        // Check empresa license
        if (!usuario.empresa.activo) {
          throw new Error("Empresa inactiva. Contacte al administrador");
        }
        if (
          usuario.empresa.fechaVencimiento &&
          new Date() > usuario.empresa.fechaVencimiento
        ) {
          throw new Error("Licencia vencida. Contacte al administrador");
        }

        // If empresaId provided, validate it matches
        if (credentials.empresaId && credentials.empresaId !== usuario.empresaId) {
          throw new Error("No tiene acceso a esta empresa");
        }

        const valid = await bcrypt.compare(
          credentials.password,
          usuario.passwordHash
        );
        if (!valid) {
          throw new Error("Contraseña incorrecta");
        }

        // Update last login
        await db.usuario.update({
          where: { id: usuario.id },
          data: { ultimoLogin: new Date() },
        });

        // Get permisos from grupo
        let permisos: string[] = [];
        if (usuario.rol === "admin" || usuario.grupo?.esAdmin) {
          permisos = ["*"];
        } else if (usuario.grupo) {
          permisos = parseArray(usuario.grupo.permisos);
        }

        const sucursalesPermitidas = parseArray(usuario.sucursalesPermitidas);

        return {
          id: usuario.id,
          login: usuario.login,
          name: usuario.nombre,
          rol: usuario.rol,
          empresaId: usuario.empresaId,
          empresaNombre: usuario.empresa.nombre,
          empresaPlan: usuario.empresa.plan,
          permisos,
          sucursalesPermitidas,
          grupoId: usuario.grupoId,
          debeCambiarPass: usuario.debeCambiarPass,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
  jwt: {
    maxAge: 60 * 60 * 24 * 7,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.login = user.login;
        token.name = user.name;
        token.rol = user.rol;
        token.empresaId = user.empresaId;
        token.empresaNombre = user.empresaNombre;
        token.empresaPlan = user.empresaPlan;
        token.permisos = user.permisos;
        token.sucursalesPermitidas = user.sucursalesPermitidas;
        token.grupoId = user.grupoId;
        token.debeCambiarPass = user.debeCambiarPass;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id,
        login: token.login,
        name: token.name,
        rol: token.rol,
        empresaId: token.empresaId,
        empresaNombre: token.empresaNombre,
        empresaPlan: token.empresaPlan,
        permisos: token.permisos,
        sucursalesPermitidas: token.sucursalesPermitidas,
        grupoId: token.grupoId,
        debeCambiarPass: token.debeCambiarPass,
      };
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  secret: process.env.NEXTAUTH_SECRET || "cobranzas-flow-dev-secret-change-in-production",
};
