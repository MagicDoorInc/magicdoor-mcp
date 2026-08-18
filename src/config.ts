/**
 * Where the server points and which key it presents. Everything comes from the environment,
 * because an MCP client launches this process with no command line of its own.
 */
export interface Config {
  apiKey: string;
  authUrl: string;
  apiUrl: string;
}

const ENVIRONMENTS = {
  production: { auth: "https://auth.magicdoor.com", api: "https://api.portal.magicdoor.com" },
  staging: { auth: "https://auth.magicdoor-test.com", api: "https://api.portal.magicdoor-test.com" },
  demo: { auth: "https://auth.magicdoor-demo.com", api: "https://api.portal.magicdoor-demo.com" },
  development: { auth: "https://auth.magicdoor.dev", api: "https://api.portal.magicdoor.dev" },
} as const;

export type EnvironmentName = keyof typeof ENVIRONMENTS;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiKey = env.MAGICDOOR_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "MAGICDOOR_API_KEY is not set. Create a key in MagicDoor under Settings → API keys, " +
        "then pass it to this server as the MAGICDOOR_API_KEY environment variable.",
    );
  }

  const name = (env.MAGICDOOR_ENV?.trim() || "production") as EnvironmentName;
  const hosts = ENVIRONMENTS[name];
  if (!hosts) {
    throw new Error(
      `MAGICDOOR_ENV is "${name}", which is not a MagicDoor environment. ` +
        `Use one of: ${Object.keys(ENVIRONMENTS).join(", ")}.`,
    );
  }

  // The explicit overrides exist so a developer can point at a local stack.
  return {
    apiKey,
    authUrl: stripTrailingSlash(env.MAGICDOOR_AUTH_URL?.trim() || hosts.auth),
    apiUrl: stripTrailingSlash(env.MAGICDOOR_API_URL?.trim() || hosts.api),
  };
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
