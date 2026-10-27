import path from 'node:path';
import { HttpError } from './errors.js';

export const IMAGE_TYPES = new Map([
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'], ['.webp', 'image/webp'], ['.avif', 'image/avif']
]);

export function documentUrl(id, fragment = '') {
  return '/?doc=' + encodeURIComponent(id) + (fragment ? '#' + encodeURIComponent(fragment) : '');
}

export function createReferenceResolver({ document, documents, redirects = new Map(), access, registerAsset }) {
  return async function resolve(href, image = false) {
    const unavailable = (type, message, relativePath) => ({
      type, message, ...(relativePath ? { relativePath } : {})
    });
    if (!href || /[\u0000-\u001f\\]/.test(href)) {
      return unavailable('blocked', 'This reference is not supported.');
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) {
      try {
        const url = new URL(href.startsWith('//') ? 'https:' + href : href);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
        return image
          ? unavailable('blocked', 'External images are not loaded.')
          : { type: 'external', href: url.href };
      } catch {
        return unavailable('blocked', 'Only http and https external links are supported.');
      }
    }
    let fragment;
    let relative;
    try {
      const hash = href.indexOf('#');
      fragment = hash < 0 ? '' : decodeURIComponent(href.slice(hash + 1));
      const query = (hash < 0 ? href : href.slice(0, hash)).split('?')[0];
      const pathname = decodeURIComponent(query);
      if (/[\u0000-\u001f\\]/.test(pathname)) throw new Error();
      relative = pathname
        ? path.posix.normalize(pathname.startsWith('/')
          ? pathname.slice(1) : path.posix.join(path.posix.dirname(document.id), pathname))
        : document.id;
      relative = relative.replace(/\/+$/, '') || '.';
      if (relative === '..' || relative.startsWith('../') || /^[a-z]:/i.test(relative)) {
        return unavailable('blocked', 'This path is outside the project.', relative);
      }
    } catch {
      return unavailable('blocked', 'This reference has an invalid URL encoding.');
    }
    if (!image && relative === document.id) {
      return { type: 'document', targetId: document.id, fragment, href: documentUrl(document.id, fragment) };
    }
    try {
      if (!image && redirects.has(relative)) {
        const targetId = redirects.get(relative);
        await access.inspect(targetId);
        return { type: 'document', targetId, fragment, href: documentUrl(targetId, fragment) };
      }
      let file = await access.inspect(relative);
      if (file.stat.isDirectory()) {
        const readme = [...documents.values()].find(candidate =>
          path.posix.dirname(candidate.id) === relative && candidate.kind === 'readme');
        if (readme && !image) {
          relative = readme.id;
          file = await access.inspect(relative);
        } else {
          return unavailable('file', 'This folder can be opened using its relative path.', relative);
        }
      }
      if (!file.stat.isFile()) return unavailable('blocked', 'This is not a regular file.', relative);
      if (image) {
        const contentType = IMAGE_TYPES.get(path.posix.extname(relative).toLowerCase());
        if (!contentType) return unavailable('blocked', 'Supported local images: PNG, JPEG, GIF, WebP, and AVIF.', relative);
        return { type: 'image', src: registerAsset(relative, contentType), relativePath: relative };
      }
      if (/\.md$/i.test(relative)) {
        return documents.has(relative)
          ? { type: 'document', targetId: relative, fragment, href: documentUrl(relative, fragment) }
          : unavailable('unindexed', 'This Markdown is outside the current collection. Add its path to include.', relative);
      }
      return unavailable('file', 'Code and attachments are available as a relative path.', relative + (fragment ? '#' + fragment : ''));
    } catch (error) {
      if (error instanceof HttpError) {
        return unavailable(error.status === 404 ? 'missing' : 'blocked', error.message, relative);
      }
      throw error;
    }
  };
}
