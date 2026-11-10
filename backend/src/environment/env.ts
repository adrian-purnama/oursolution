function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

/**
 * True for "development" / "dev" and for any suffixed variant such as
 * "development-fedier" or "dev_api" (case-insensitive). The suffix lets several
 * development apps share one MongoDB server while each keeps its own database.
 */
export function isDevelopmentBuild(name: string): boolean {
  return /^(development|dev)([-_].+)?$/i.test(name);
}

/** The build name, which is also the database name. */
function build(): string {
  const raw = process.env.BUILD?.trim();
  if (!raw) return "development";
  if (/^(development|dev)$/i.test(raw)) return "development";
  return raw;
}

const MIN_JWT_SECRET_LENGTH = 32;

function jwtSecret(buildName: string): string {
  const value = required("JWT_SECRET");
  if (value.length < MIN_JWT_SECRET_LENGTH) {
    const message = `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`;
    if (!isDevelopmentBuild(buildName)) throw new Error(message);
    console.warn(`[WARN] ${message} (allowed in development only)`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT) || 8000,
  build: build(),
  isDevelopment: isDevelopmentBuild(build()),
  mongodbUrl: required("MONGODB_URL"),
  frontendUrl: required("FRONTEND_URL"),
  brevoApiKey: required("BREVO_API_KEY"),
  brevoSenderEmail: required("BREVO_SENDER_EMAIL"),
  jwtSecret: jwtSecret(build()),
};
