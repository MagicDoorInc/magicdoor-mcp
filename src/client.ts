/**
 * Calls MagicDoor's property-manager APIs with an access token obtained from the API key.
 * One token works across every service — they all trust the same issuer.
 */
import type { Config, ServiceName } from "./config.js";
import type { TokenProvider } from "./auth.js";

export type QueryValue = string | number | boolean | string[] | undefined | null;

export class MagicDoorClient {
  constructor(
    private readonly config: Config,
    private readonly tokens: TokenProvider,
  ) {}

  /**
   * A GET against one of MagicDoor's services. Retries once on a 401: the access token may simply
   * have aged out between the expiry check and the request landing.
   */
  async get(service: ServiceName, path: string, query: Record<string, QueryValue> = {}): Promise<unknown> {
    const endpoint = this.config.services[service];
    const url = `${endpoint.url}/${endpoint.area}/${path}${buildQuery(query)}`;

    let response = await this.send(url, await this.tokens.getToken());
    if (response.status === 401) {
      this.tokens.invalidate();
      response = await this.send(url, await this.tokens.getToken());
    }

    if (response.status === 403) {
      throw new Error(
        `This API key is not allowed to read ${path}. Its permissions are set when the key is ` +
          `created, and are also limited by what its owner can do.`,
      );
    }

    if (!response.ok) {
      throw new Error(`MagicDoor returned HTTP ${response.status} for ${path}.`);
    }

    return response.json();
  }

  private send(url: string, token: string): Promise<Response> {
    return fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  }
}

/** Skips absent values, and repeats a parameter per entry for list filters. */
function buildQuery(query: Record<string, QueryValue>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, entry);
      }
    } else {
      params.append(key, String(value));
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}
