import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { injectEnvironmentVariables, listProjects } from '@/lib/vercel';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('vercel_access_token')?.value;
  const teamId = req.nextUrl.searchParams.get('teamId') ?? cookieStore.get('vercel_team_id')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated with Vercel' }, { status: 401 });
  }

  try {
    const projects = await listProjects(token, teamId ?? undefined);
    return NextResponse.json({ projects, teamId: teamId ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load projects';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('vercel_access_token')?.value;
  const teamId = cookieStore.get('vercel_team_id')?.value;
  const nextUrl = cookieStore.get('vercel_next_url')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated with Vercel' }, { status: 401 });
  }

  const body = (await req.json()) as { projectId?: string };
  const projectId = body.projectId;

  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  try {
    const injected = await injectEnvironmentVariables(projectId, token, teamId);
    return NextResponse.json({
      ok: true,
      projectId,
      injected,
      redirectUrl: nextUrl ?? 'https://vercel.com/dashboard',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Setup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
