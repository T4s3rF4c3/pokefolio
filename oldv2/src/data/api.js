export async function apiFetch(path, { body, method, ...rest } = {}) {
  const hasBody = body !== undefined;
  const res = await fetch(`/api${path}`, {
    method: method ?? (hasBody ? 'POST' : 'GET'),
    headers: hasBody ? { 'Content-Type': 'application/json' } : {},
    body: hasBody ? JSON.stringify(body) : undefined,
    ...rest,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}
