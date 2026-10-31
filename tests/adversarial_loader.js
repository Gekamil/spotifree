export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      const extensions = ['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.js'];
      for (const ext of extensions) {
        try {
          return await nextResolve(specifier + ext, context);
        } catch {}
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

  const loaded = await nextLoad(url, context);
  if (loaded.source) {
    const srcStr = typeof loaded.source === 'string' ? loaded.source : Buffer.from(loaded.source).toString('utf8');
    if (srcStr.includes('import.meta.env')) {
      const patched = srcStr.replaceAll('import.meta.env', '(globalThis.process?.env || {})');
      return {
        ...loaded,
        source: patched,
      };
    }
  }

  return loaded;
}
