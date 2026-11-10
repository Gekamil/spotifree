import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';

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
            format: 'module',
            shortCircuit: true,
          };
        }
      }
    }
    throw err;
  }
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.ts') || url.endsWith('.tsx')) {
    const filePath = fileURLToPath(url);
    const code = fs.readFileSync(filePath, 'utf-8');
    const res = await transformWithOxc(code, path.basename(filePath));
    return {
      format: 'module',
      source: res.code,
      shortCircuit: true,
    };
  }
  if (url.endsWith('.json')) {
    return nextLoad(url, {
      ...context,
      importAttributes: { ...context.importAttributes, type: 'json' },
    });
  }
  return nextLoad(url, context);
}
