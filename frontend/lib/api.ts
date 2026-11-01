export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error("Backend offline");
  return res.json();
}

export async function fetchProjects() {
  try {
    const res = await fetch(`${API_BASE}/projects`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchDatasets(projectId: number = 1) {
  try {
    const res = await fetch(`${API_BASE}/datasets?project_id=${projectId}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function loadSampleDatasets(projectId: number = 1) {
  const res = await fetch(`${API_BASE}/datasets/load-sample?project_id=${projectId}`, {
    method: "POST",
  });
  return res.json();
}

export async function importSourceFolder(folderPath?: string, projectId: number = 1) {
  const res = await fetch(`${API_BASE}/datasets/import-source-folder?project_id=${projectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(folderPath ? { folder_path: folderPath } : {}),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Import failed");
  }
  return res.json();
}

export async function clearAllData() {
  const res = await fetch(`${API_BASE}/datasets/clear-all`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to clear data");
  return res.json();
}

export async function fetchReadiness(projectId: number = 1) {
  const res = await fetch(`${API_BASE}/datasets/readiness?project_id=${projectId}`, { cache: "no-store" });
  return res.json();
}

export async function runAnalysis(params: any) {
  const res = await fetch(`${API_BASE}/analyses/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Analysis run failed");
  }
  return res.json();
}

export async function fetchAnalyses(projectId: number = 1) {
  try {
    const res = await fetch(`${API_BASE}/analyses?project_id=${projectId}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchAnalysisReport(analysisId: number) {
  const res = await fetch(`${API_BASE}/analyses/${analysisId}/report`, { cache: "no-store" });
  return res.text();
}

export async function searchDie(query?: string, lotId?: string, waferId?: number, limit: number = 25) {
  try {
    const params = new URLSearchParams();
    if (query) params.append("query", query);
    if (lotId) params.append("lot_id", lotId);
    if (waferId !== undefined) params.append("wafer_id", waferId.toString());
    params.append("limit", limit.toString());

    const res = await fetch(`${API_BASE}/die/search?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchDieDiagnosis(dieUid: string) {
  const res = await fetch(`${API_BASE}/die/${dieUid}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Die not found");
  return res.json();
}

export async function fetchWaferLots(): Promise<{ lots: string[]; lot_wafer_map: Record<string, number[]>; total_lots: number }> {
  try {
    const res = await fetch(`${API_BASE}/wafer/lots`, { cache: "no-store" });
    if (!res.ok) return { lots: [], lot_wafer_map: {}, total_lots: 0 };
    return res.json();
  } catch {
    return { lots: [], lot_wafer_map: {}, total_lots: 0 };
  }
}

export async function fetchWaferDetails(lotId: string, waferId: number) {
  const res = await fetch(`${API_BASE}/wafer/${lotId}/${waferId}`, { cache: "no-store" });
  return res.json();
}

export async function fetchDriftTimeline(refLot: string = "LOT01"): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/wafer/drift/timeline?reference_lot=${refLot}`, { cache: "no-store" });
    if (!res.ok) return { lot_drift_timeline: [] };
    return res.json();
  } catch {
    return { lot_drift_timeline: [] };
  }
}

export async function uploadDatasetFile(file: File, projectId: number = 1) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("project_id", projectId.toString());

  const res = await fetch(`${API_BASE}/datasets/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function fetchDatasetPreview(datasetId: number) {
  const res = await fetch(`${API_BASE}/datasets/${datasetId}/preview`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load preview");
  return res.json();
}

export async function fetchUploadHistory(projectId: number = 1) {
  const res = await fetch(`${API_BASE}/datasets/history?project_id=${projectId}`, { cache: "no-store" });
  return res.json();
}

export async function deleteDataset(datasetId: number) {
  const res = await fetch(`${API_BASE}/datasets/${datasetId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Delete failed");
  return res.json();
}

export async function fetchDefects(params: {
  analysis_run_id?: number;
  lot_id?: string;
  wafer_id?: number;
  detection_method?: string;
  predicted_defect_class?: string;
  status_category?: string;
  page?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.analysis_run_id) searchParams.append("analysis_run_id", params.analysis_run_id.toString());
  if (params.lot_id) searchParams.append("lot_id", params.lot_id);
  if (params.wafer_id !== undefined) searchParams.append("wafer_id", params.wafer_id.toString());
  if (params.detection_method) searchParams.append("detection_method", params.detection_method);
  if (params.predicted_defect_class) searchParams.append("predicted_defect_class", params.predicted_defect_class);
  if (params.status_category) searchParams.append("status_category", params.status_category);
  if (params.page) searchParams.append("page", params.page.toString());
  if (params.limit) searchParams.append("limit", params.limit.toString());

  const res = await fetch(`${API_BASE}/defects?${searchParams.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load defects");
  return res.json();
}

export async function fetchDefectsSummary(analysisRunId?: number) {
  const url = analysisRunId ? `${API_BASE}/defects/summary?analysis_run_id=${analysisRunId}` : `${API_BASE}/defects/summary`;
  const res = await fetch(url, { cache: "no-store" });
  return res.json();
}

export async function compareDies(die1Uid: string, die2Uid: string) {
  const res = await fetch(`${API_BASE}/die/compare?die1_uid=${die1Uid}&die2_uid=${die2Uid}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Die comparison failed");
  return res.json();
}

export function getStreamWebSocketUrl(): string {
  const wsBase = API_BASE.replace(/^http/, "ws");
  return `${wsBase}/stream/ws/prober`;
}

export async function fetchStreamStatus() {
  const res = await fetch(`${API_BASE}/stream/status`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch stream status");
  return res.json();
}

export async function fetchStreamSnapshot() {
  const res = await fetch(`${API_BASE}/stream/live-snapshot`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch stream snapshot");
  return res.json();
}

export async function controlStream(action: string, options: { lot_id?: string; wafer_id?: number; speed_ms?: number } = {}) {
  const res = await fetch(`${API_BASE}/stream/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...options }),
  });
  if (!res.ok) throw new Error(`Stream control '${action}' failed`);
  return res.json();
}


