import { z } from 'zod';

/** Exact, case-sensitive basenames chosen by the user; never infer provenance or use size. */
export const LibraryFileNamesSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(512)
      .regex(/^[^/\\\r\n*?]+\.js$/),
  )
  .max(50);

export function parseLibraryFileNames(text: string) {
  return LibraryFileNamesSchema.safeParse(
    text
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean),
  );
}
