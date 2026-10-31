import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      const parentDir = context.parentURL ? path.dirname(fileURLToPath(context.parentURL)) : process.cwd();
      const targetBase = path.resolve(parentDir, specifier);
      const candidates = [
        targetBase + '.ts',
        targetBase + '.tsx',
        targetBase + '.js',
        targetBase + '.mjs',
        path.join(targetBase, 'index.ts'),
        path.join(targetBase, 'index.tsx'),
        path.join(targetBase, 'index.js'),
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          return {
            url: pathToFileURL(cand).href,
            format: cand.endsWith('.ts') || cand.endsWith('.tsx') ? 'module' : undefined,
            shortCircuit: true,
          };
        }
      }
    }
    throw err;
  }
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.json')) {
    return nextLoad(url, {
      ...context,
      importAttributes: { ...context.importAttributes, type: 'json' },
    });
  }
  return nextLoad(url, context);
}
