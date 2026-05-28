import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";
import { sendSafeError } from "../middleware/error.middleware.js";
import { getJwtSecret, normalizeOrigin } from "../config/security.js";
import { verifyGoogleIdToken } from "../utils/google-token.js";
import { clearAuthCookie, setAuthCookie } from "../utils/auth-cookie.js";

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

const GOOGLE_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_PROVIDER = "google";
const PASSWORD_AUTH_PROVIDER = "password";

function buildSessionUser(user, authProvider = PASSWORD_AUTH_PROVIDER) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    designation: user.designation ?? null,
    avatarUrl: user.avatarUrl ?? null,
    department: user.department ?? null,
    manager: user.manager ?? null,
    createdAt: user.createdAt ?? null,
    authProvider,
  };
}

function getGoogleLoginConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_LOGIN_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI,
    clientUrl: normalizeOrigin(process.env.CLIENT_URL || "https://planitt-crm-client.vercel.app"),
  };
}

function signToken(user, authProvider = PASSWORD_AUTH_PROVIDER) {
  const secret = getJwtSecret();
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      email: user.email,
      authProvider,
    },
    secret,
    { expiresIn: "7d" }
  );
}

export async function signup(req, res) {
  try {
    const { name, password } = req.body;
    const email = normalizeEmail(req.body?.email);

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ error: "User already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashed, role: "EMPLOYEE", authProvider: PASSWORD_AUTH_PROVIDER },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        designation: true,
        avatarUrl: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdAt: true,
      },
    });

    const token = signToken(user);
    setAuthCookie(res, token);

    return res.status(201).json({ token, user: buildSessionUser(user, PASSWORD_AUTH_PROVIDER) });
  } catch (err) {
    return sendSafeError(res, err, "Unable to create account");
  }
}

export async function login(req, res) {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body?.email);

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // #region agent log
      fetch("http://127.0.0.1:7655/ingest/6ce29a90-8aa2-4d64-ba64-939786193f6a",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"1645cd"},body:JSON.stringify({sessionId:"1645cd",runId:"auth-debug",hypothesisId:"H1-invalid-credentials",location:"server/src/controllers/auth.controller.js:98",message:"Login failed because user was not found",data:{email:email ?? null,origin:req.headers.origin ?? null,host:req.headers.host ?? null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return res.status(404).json({ error: "User not found" });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      // #region agent log
      fetch("http://127.0.0.1:7655/ingest/6ce29a90-8aa2-4d64-ba64-939786193f6a",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"1645cd"},body:JSON.stringify({sessionId:"1645cd",runId:"auth-debug",hypothesisId:"H1-invalid-credentials",location:"server/src/controllers/auth.controller.js:105",message:"Login failed due to invalid password",data:{email:user.email,origin:req.headers.origin ?? null,host:req.headers.host ?? null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = signToken(user);
    setAuthCookie(res, token);
    // #region agent log
    fetch("http://127.0.0.1:7655/ingest/6ce29a90-8aa2-4d64-ba64-939786193f6a",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"1645cd"},body:JSON.stringify({sessionId:"1645cd",runId:"auth-debug",hypothesisId:"H2-cookie-session-flow",location:"server/src/controllers/auth.controller.js:111",message:"Login succeeded and auth cookie set",data:{userId:user.id,email:user.email,origin:req.headers.origin ?? null,host:req.headers.host ?? null,userAgent:req.headers["user-agent"] ?? null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    return res.json({
      token,
      user: buildSessionUser({
        ...user,
        avatarUrl: user.avatarUrl ?? null,
      }, PASSWORD_AUTH_PROVIDER),
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to login");
  }
}

export async function getCurrentUser(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        designation: true,
        avatarUrl: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(buildSessionUser(user, req.user.authProvider ?? PASSWORD_AUTH_PROVIDER));
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch current user");
  }
}

export async function getGoogleLoginUrl(_req, res) {
  try {
    const config = getGoogleLoginConfig();
    if (!config.clientId || !config.redirectUri) {
      // #region agent log
      fetch("http://127.0.0.1:7655/ingest/6ce29a90-8aa2-4d64-ba64-939786193f6a",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"1645cd"},body:JSON.stringify({sessionId:"1645cd",runId:"auth-debug",hypothesisId:"H3-google-config-missing",location:"server/src/controllers/auth.controller.js:170",message:"Google auth URL request failed due to missing config",data:{hasClientId:Boolean(config.clientId),hasRedirectUri:Boolean(config.redirectUri),origin:_req.headers.origin ?? null,host:_req.headers.host ?? null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return res.status(400).json({
        error: "Google login is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_LOGIN_REDIRECT_URI.",
      });
    }

    const state = jwt.sign(
      {
        nonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
      getJwtSecret(),
      { expiresIn: "10m" }
    );

    const scopes = ["openid", "email", "profile"];
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      scope: scopes.join(" "),
      state,
    });

    return res.json({
      authUrl: `${GOOGLE_AUTH_BASE_URL}?${params.toString()}`,
    });
  } catch (err) {
    // #region agent log
    fetch("http://127.0.0.1:7655/ingest/6ce29a90-8aa2-4d64-ba64-939786193f6a",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"1645cd"},body:JSON.stringify({sessionId:"1645cd",runId:"auth-debug",hypothesisId:"H3-google-config-missing",location:"server/src/controllers/auth.controller.js:199",message:"Google auth URL handler threw error",data:{errorMessage:err?.message ?? "unknown",origin:_req.headers.origin ?? null,host:_req.headers.host ?? null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return sendSafeError(res, err, "Unable to start Google login");
  }
}

export async function handleGoogleLoginCallback(req, res) {
  const config = getGoogleLoginConfig();
  const loginUrl = `${config.clientUrl}/login`;

  try {
    const { code, state, error } = req.query;
    if (error) {
      return res.redirect(`${loginUrl}?google=denied`);
    }

    if (!code || !state) {
      return res.redirect(`${loginUrl}?google=missing_code`);
    }

    jwt.verify(state, getJwtSecret());

    if (!config.clientId || !config.clientSecret || !config.redirectUri) {
      return res.redirect(`${loginUrl}?google=missing_config`);
    }

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok) {
      return res.redirect(`${loginUrl}?google=token_failed`);
    }

    const idTokenPayload = await verifyGoogleIdToken(tokenPayload.id_token, config.clientId);
    const email = normalizeEmail(idTokenPayload.email);
    if (!email) {
      return res.redirect(`${loginUrl}?google=email_missing`);
    }

    const avatarUrl = typeof idTokenPayload.picture === "string" ? idTokenPayload.picture : null;

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
      },
    });

    if (!existingUser) {
      return res.redirect(`${loginUrl}?google=user_not_found`);
    }

    const user = await prisma.user.update({
      where: { email },
      data: { avatarUrl, authProvider: GOOGLE_AUTH_PROVIDER },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
      },
    });

    const appToken = signToken(user, GOOGLE_AUTH_PROVIDER);
    setAuthCookie(res, appToken);
    const tokenQuery = new URLSearchParams({
      google: "connected",
      token: appToken,
    });
    return res.redirect(`${loginUrl}?${tokenQuery.toString()}`);
  } catch (_err) {
    return res.redirect(`${loginUrl}?google=failed`);
  }
}

export async function logout(_req, res) {
  clearAuthCookie(res);
  return res.status(204).send();
}
