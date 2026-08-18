/**
 * Where the server points and which key it presents. Everything comes from the environment,
 * because an MCP client launches this process with no command line of its own.
 */

/** MagicDoor is several services; a tool names the one it reads from. */
export type ServiceName = "portal" | "accounting";

export interface Config {
  apiKey: string;
  authUrl: string;
  services: Record<ServiceName, ServiceEndpoint>;
}

export interface ServiceEndpoint {
  url: string;
  /** The routing area a property manager's endpoints sit under on that service. */
  area: string;
}

const ENVIRONMENTS = {
  production: {
    auth: "https://auth.magicdoor.com",
    portal: "https://api.portal.magicdoor.com",
    accounting: "https://accounting.magicdoor.com",
  },
  staging: {
    auth: "https://auth.magicdoor-test.com",
    portal: "https://api.portal.magicdoor-test.com",
    accounting: "https://accounting.magicdoor-test.com",
  },
  demo: {
    auth: "https://auth.magicdoor-demo.com",
    portal: "https://api.portal.magicdoor-demo.com",
    accounting: "https://accounting.magicdoor-demo.com",
  },
  development: {
    auth: "https://auth.magicdoor.dev",
    portal: "https://api.portal.magicdoor.dev",
    accounting: "https://accounting.magicdoor.dev",
  },
} as const;

export type EnvironmentName = keyof typeof ENVIRONMENTS;

// Portal serves property managers under `company-app`; every other service uses the shared
// `company-portal` area. Getting these crossed produces a 404 rather than an obvious error.
const PORTAL_AREA = "company-app";
const COMPANY_PORTAL_AREA = "company-portal";

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
    authUrl: trimSlash(env.MAGICDOOR_AUTH_URL?.trim() || hosts.auth),
    services: {
      portal: { url: trimSlash(env.MAGICDOOR_API_URL?.trim() || hosts.portal), area: PORTAL_AREA },
      accounting: {
        url: trimSlash(env.MAGICDOOR_ACCOUNTING_URL?.trim() || hosts.accounting),
        area: COMPANY_PORTAL_AREA,
      },
    },
  };
}

function trimSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
