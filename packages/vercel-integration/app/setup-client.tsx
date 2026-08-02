'use client';

import { useEffect, useState, type CSSProperties } from 'react';

type Project = {
  id: string;
  name: string;
};

export default function SetupClient({ teamId }: { teamId?: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';

    fetch(`/api/setup${query}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? 'Failed to load projects');
        }
        setProjects(data.projects ?? []);
      })
      .catch((error: Error) => {
        setStatus('error');
        setMessage(error.message);
      });
  }, [teamId]);

  async function handleSetup() {
    if (!selectedProjectId) {
      setStatus('error');
      setMessage('Select a project first.');
      return;
    }

    setStatus('loading');
    setMessage('Injecting Nexus Shield environment variables…');

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Setup failed');
      }

      setStatus('success');
      setMessage(`Installed on project ${selectedProjectId}. Redirecting…`);

      window.setTimeout(() => {
        window.location.href = data.redirectUrl ?? 'https://vercel.com/dashboard';
      }, 1200);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Setup failed');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <label style={{ display: 'grid', gap: 8 }}>
        <span style={{ fontSize: 14, color: '#94a3b8' }}>Vercel project</span>
        <select
          value={selectedProjectId}
          onChange={(event) => setSelectedProjectId(event.target.value)}
          style={inputStyle}
        >
          <option value="">Select a project…</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>

      <button type="button" onClick={handleSetup} style={buttonStyle} disabled={status === 'loading'}>
        {status === 'loading' ? 'Installing…' : 'Install Nexus Shield ENV'}
      </button>

      {message ? (
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: status === 'error' ? '#f87171' : status === 'success' ? '#34d399' : '#94a3b8',
          }}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid #1f2937',
  background: '#0f172a',
  color: '#e2e8f0',
};

const buttonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 12,
  padding: '12px 16px',
  background: '#6366f1',
  color: 'white',
  fontWeight: 600,
  cursor: 'pointer',
};
