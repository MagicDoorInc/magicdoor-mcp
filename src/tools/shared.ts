import { z } from "zod";

/**
 * Several MagicDoor resources read the same way: pass an id for one record, or filters for a
 * page of them. Rather than two tools per resource, one tool covers both and the path follows
 * the id.
 */
export function oneOrMany(idName: string, collectionPath: string) {
  return {
    path: (args: Record<string, unknown>) =>
      args[idName] ? `${collectionPath}/{${idName}}` : collectionPath,
    paginated: (args: Record<string, unknown>) => !args[idName],
  };
}

/** Chooses a sub-path from a lookup, failing with the valid values rather than a broken URL. */
export function selectPath<T extends Record<string, string>>(
  table: T,
  selector: unknown,
  build: (segment: string) => string,
): string {
  const segment = table[selector as keyof T];
  if (!segment) {
    throw new Error(`Must be one of: ${Object.keys(table).join(", ")}.`);
  }

  return build(segment);
}

export const scope = {
  propertyIds: z.array(z.string()).optional().describe("Limit to these properties."),
  portfolioIds: z.array(z.string()).optional().describe("Limit to these portfolios."),
};
