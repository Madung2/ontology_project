const API_BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}

// ── Projects ────────────────────────────────────────────────────────
export function listProjects() {
  return request("/projects");
}

export function createProject(name, description = "") {
  return request("/projects", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

// ── Data Source ──────────────────────────────────────────────────────
export function uploadDDL(projectId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return fetch(`${API_BASE}/projects/${projectId}/upload-ddl`, {
    method: "POST",
    body: formData,
  }).then((res) => {
    if (!res.ok) return res.json().then((e) => { throw new Error(e.detail); });
    return res.json();
  });
}

export function loadSample(projectId, sampleName = "banking") {
  return request(`/projects/${projectId}/load-sample?sample_name=${sampleName}`, {
    method: "POST",
  });
}

export function connectDB(projectId, connectionUrl, schemaName = null, includeViews = false) {
  return request(`/projects/${projectId}/connect-db`, {
    method: "POST",
    body: JSON.stringify({
      connection_url: connectionUrl,
      schema_name: schemaName,
      include_views: includeViews,
    }),
  });
}

// ── Pipeline Results ────────────────────────────────────────────────
export function getSchema(projectId) {
  return request(`/projects/${projectId}/schema`);
}

export function getDomain(projectId) {
  return request(`/projects/${projectId}/domain`);
}

export function getClassification(projectId) {
  return request(`/projects/${projectId}/classification`);
}

export function overrideClassification(projectId, tableName, classification, graphRole) {
  return request(`/projects/${projectId}/classification/override`, {
    method: "POST",
    body: JSON.stringify({
      table_name: tableName,
      classification,
      graph_role: graphRole,
    }),
  });
}

export function getSemanticIR(projectId) {
  return request(`/projects/${projectId}/semantic-ir`);
}

export function getTrace(projectId) {
  return request(`/projects/${projectId}/trace`);
}

export function exportCode(projectId, format) {
  return request(`/projects/${projectId}/export/${format}`);
}

export function reconvert(projectId) {
  return request(`/projects/${projectId}/reconvert`, { method: "POST" });
}

// ── SLM ─────────────────────────────────────────────────────────────
export function getSLMStatus() {
  return request("/slm/status");
}

export function updateSLMSettings(settings) {
  return request("/slm/settings", {
    method: "POST",
    body: JSON.stringify(settings),
  });
}
