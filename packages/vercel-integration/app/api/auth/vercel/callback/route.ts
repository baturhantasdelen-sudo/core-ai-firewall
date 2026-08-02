import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/vercel';

const TOKEN_COOKIE = 'vercel_access_token';
const TEAM_COOKIE = 'vercel_team_id';
const CONFIG_COOKIE = 'vercel_configuration_id';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const teamId = searchParams.get('teamId') ?? undefined;
  const configurationId = searchParams.get('configurationId') ?? undefined;

  if (!code) {
    return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 });
  }

  try {
    const authData = await getAccessToken(code);
    const accessToken = authData.access_token;

    if (!accessToken) {
      return NextResponse.json(
        {
          error: authData.error ?? 'access_token_missing',
          description: authData.error_description,
        },
        { status: 400 },
      );
    }

    const resolvedTeamId = teamId ?? authData.team_id;
    const resolvedConfigurationId = configurationId ?? authData.installation_id;

    const response = NextResponse.redirect(
      new URL(
        `/?configurationId=${encodeURIComponent(resolvedConfigurationId ?? '')}&teamId=${encodeURIComponent(resolvedTeamId ?? '')}`,
        req.url,
      ),
    );

    response.cookies.set(TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    if (resolvedTeamId) {
      response.cookies.set(TEAM_COOKIE, resolvedTeamId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    if (resolvedConfigurationId) {
      response.cookies.set(CONFIG_COOKIE, resolvedConfigurationId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    if (next) {
      response.cookies.set('vercel_next_url', next, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60,
      });
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth callback failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
