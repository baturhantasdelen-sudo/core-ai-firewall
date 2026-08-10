import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { DEMO_ORG_ID } from '@/lib/demo-org';

export const runtime = 'nodejs';

function redirectTo(req: NextRequest, path: string): NextResponse {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  return NextResponse.redirect(`${appUrl}${path}`);
}

/**
 * GitHub redirects here after a user installs (or manages) the GitHub App —
 * see the App's "Setup URL" configuration. GitHub appends `installation_id`
 * and, when the install was started from our own "Connect GitHub App" link
 * (see GithubIntegrationCard), the `state` value we embedded there
 * (the target organization's id).
 *
 * NOTE: This app doesn't have Supabase Auth/session handling wired up yet
 * (see the `DEMO_ORG_ID` TODOs elsewhere), so there is no logged-in user to
 * resolve an org from. Until then, `state` is the only reliable signal for
 * "which organization requested this install" — it falls back to
 * `DEMO_ORG_ID` only if a install happens without going through our link
 * (e.g. installed directly from the GitHub Marketplace listing).
 */
export async function GET(req: NextRequest) {
  const installationIdParam = req.nextUrl.searchParams.get('installation_id');
  const state = req.nextUrl.searchParams.get('state');

  const installationId = installationIdParam ? Number(installationIdParam) : NaN;

  if (!installationIdParam || !Number.isInteger(installationId)) {
    return redirectTo(req, '/dashboard/settings?error=github_callback_failed');
  }

  const orgId = state && state.length > 0 ? state : DEMO_ORG_ID;

  try {
    const supabase = getSupabaseAdmin();

    // An installation can only belong to one organization. If it was
    // previously linked elsewhere (e.g. re-installed after being moved),
    // clear that stale link first to avoid violating the unique constraint.
    const { error: clearError } = await supabase
      .from('organizations')
      .update({ github_installation_id: null })
      .eq('github_installation_id', installationId)
      .neq('id', orgId);

    if (clearError) {
      throw new Error(clearError.message);
    }

    const { error: updateError, data } = await supabase
      .from('organizations')
      .update({ github_installation_id: installationId })
      .eq('id', orgId)
      .select('id')
      .maybeSingle();

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (!data) {
      throw new Error(`Organization ${orgId} not found`);
    }

    return redirectTo(req, '/dashboard/settings?github=connected');
  } catch (error) {
    console.error('[github-callback] failed to link installation:', error);
    return redirectTo(req, '/dashboard/settings?error=github_callback_failed');
  }
}
