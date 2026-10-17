import { env } from 'cloudflare:workers';
import { handleProgress } from '../../../server/progress';
import { getChatGPTUser } from '../../chatgpt-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    return handleProgress(request, {
      user: await getChatGPTUser(),
      db: env.DB,
    });
  } catch {
    return Response.json(
      { error: 'account-unavailable' },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}

export const PATCH = GET;
