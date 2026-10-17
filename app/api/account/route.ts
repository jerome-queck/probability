import { handleAccount } from '../../../server/progress';
import { getChatGPTUser } from '../../chatgpt-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return handleAccount({ user: await getChatGPTUser() });
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
