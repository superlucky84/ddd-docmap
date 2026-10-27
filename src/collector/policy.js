import path from 'node:path';
import ignore from 'ignore';

export const isProtectedName = name => ['.git', 'node_modules'].includes(name.toLowerCase());

export function extendIgnoreLayers(layers, directory, rules) {
  return [...layers, { directory, matcher: ignore({ ignorecase: false }).add(rules) }];
}

export function isIgnored(filename, directory, layers) {
  let ignored = false;
  for (const layer of layers) {
    const relative = path.relative(layer.directory, filename).split(path.sep).join('/') + (directory ? '/' : '');
    const result = layer.matcher.test(relative);
    if (result.ignored) ignored = true;
    else if (result.unignored) ignored = false;
  }
  return ignored;
}
