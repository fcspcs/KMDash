// Password protection for the whole site (Vercel Routing Middleware, HTTP Basic Auth).
// Password: the SITE_PASSWORD environment variable in Vercel. The user name does not matter.
// Lives in the repo root because the Vercel project builds from the root (vercel.json: only web/dist is served).
// Without a password set, the whole site stays locked.
import { next } from '@vercel/functions';

const REALM = 'KMDashboard';

function decodeBasic(header) {
  if (!header?.startsWith('Basic ')) return null;
  try {
    const bytes = Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    return decoded.slice(decoded.indexOf(':') + 1);
  } catch {
    return null;
  }
}

// Constant time comparison, so the response time reveals nothing about the password
function safeEqual(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export default function middleware(request) {
  const password = process.env.SITE_PASSWORD;
  const given = decodeBasic(request.headers.get('authorization'));
  if (password && given != null && safeEqual(given, password)) return next();

  return new Response('Password required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Cache-Control': 'no-store',
    },
  });
}
