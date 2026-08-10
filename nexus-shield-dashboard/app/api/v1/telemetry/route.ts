import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { startOfCurrentMonthIso } from '@/lib/date';

export const runtime = 'nodejs';

const findingSchema = z.object({
  type: z.string(),
  line: z.number().int().optional(),
  preview: z.string().optional(),
});

const scanResultSchema = z.object({
  repo_name: z.string().min(1, 'repo_name is required'),
  commit_sha: z.string().min(1, 'commit_sha is required'),
  pr_number: z.number().int().nullable().optional(),
  findings: z.array(findingSchema).default([]),
  status: z.enum(['passed', 'failed']),
});

type Organization = {
  id: string;
  stripe_subscription_status: 'free' | 'active' | 'canceled';
  monthly_scan_limit: number;
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-nexus-api-key');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing x-nexus-api-key header' },
        { status: 401 },
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, stripe_subscription_status, monthly_scan_limit')
      .eq('api_key', apiKey)
      .maybeSingle<Organization>();

    if (orgError) {
      return NextResponse.json(
        { error: `Failed to verify API key: ${orgError.message}` },
        { status: 500 },
      );
    }

    if (!org) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid API key' },
        { status: 401 },
      );
    }

    const { count: monthlyScanCount, error: countError } = await supabase
      .from('scan_results')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id)
      .gte('created_at', startOfCurrentMonthIso());

    if (countError) {
      return NextResponse.json(
        { error: `Failed to check usage: ${countError.message}` },
        { status: 500 },
      );
    }

    const scansThisMonth = monthlyScanCount ?? 0;

    if (
      org.stripe_subscription_status === 'free' &&
      scansThisMonth >= org.monthly_scan_limit
    ) {
      return NextResponse.json(
        {
          error: `Free tier limit reached (${org.monthly_scan_limit}/${org.monthly_scan_limit} scans). Upgrade to Pro for unlimited scans.`,
          upgrade_url: '/pricing',
        },
        { status: 402 },
      );
    }

    const body = await req.json();
    const parsed = scanResultSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { repo_name, commit_sha, pr_number, findings, status } = parsed.data;

    const { data: inserted, error: insertError } = await supabase
      .from('scan_results')
      .insert({
        org_id: org.id,
        repo_name,
        commit_sha,
        pr_number: pr_number ?? null,
        findings,
        status,
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to record scan result: ${insertError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        scan_id: inserted.id,
        scans_used_this_month: scansThisMonth + 1,
        monthly_scan_limit: org.monthly_scan_limit,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
