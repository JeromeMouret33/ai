// Client API typé centralisé — Showroom IA (GOODCAR).
// Toutes les routes sont préfixées /api sur {API_BASE}.

import { getAccessToken } from "./supabase";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// --------------------------------------------------------------------------- //
// Types — Config
// --------------------------------------------------------------------------- //
export interface AnglePreset {
  angle: string;
  framing: string;
}

export interface ConfigFragments {
  role?: string;
  vehicle_lock?: string;
  ref_showroom?: string;
  ref_logo?: string;
  ref_vehicle?: string;
  ref_plate?: string;
  task_base?: string;
  relight?: string;
  plate?: string;
  composition?: string;
  constraints?: string;
  interior?: string;
  classify_instruction?: string;
  qc_instruction?: string;
  angle_presets?: Record<string, AnglePreset>;
  // fragments supplémentaires éventuels
  [key: string]: unknown;
}

export interface ConfigModels {
  classification: string;
  generation: string;
  qc: string;
}

export interface ConfigParams {
  models: ConfigModels;
  ratio: string;
  resolution: string;
  candidates_per_photo: number;
  max_retries: number;
  logo_position_size: string;
  drive_parent_folder: string;
  [key: string]: unknown;
}

export interface ConfigNomenclature {
  dossier: string;
  fichier: string;
  angles: string[];
  toujours_numerotes: string[];
  [key: string]: unknown;
}

export interface ConfigOptions {
  relight_enabled: boolean;
  plate_enabled: boolean;
  interior_window_whiten: boolean;
  [key: string]: unknown;
}

export interface ConfigReferences {
  showroom_asset_id: string;
  logo_asset_id: string;
  plate_asset_id: string;
  [key: string]: unknown;
}

export interface Config {
  fragments: ConfigFragments;
  params: ConfigParams;
  nomenclature: ConfigNomenclature;
  options: ConfigOptions;
  references: ConfigReferences;
}

// Patch envoyé au PUT /config.
// ATTENTION: le patch `params` doit respecter la structure du fichier params.yaml,
// c.-à-d. avec une racine `parametres` (et options/nomenclature/references_actives).
export interface ConfigPatchParams {
  parametres?: Partial<ConfigParams>;
  options?: Partial<ConfigOptions>;
  nomenclature?: Partial<ConfigNomenclature>;
  references_actives?: Partial<ConfigReferences>;
}

export interface ConfigPatch {
  params?: ConfigPatchParams;
  fragments?: Partial<ConfigFragments>;
}

// --------------------------------------------------------------------------- //
// Types — Reference assets
// --------------------------------------------------------------------------- //
export type AssetType = "showroom" | "logo" | "plate";

export interface ReferenceAsset {
  id: string;
  type: AssetType;
  name: string;
  url: string;
  thumbnail_url?: string | null;
  active?: boolean;
  created_at?: string;
}

// --------------------------------------------------------------------------- //
// Types — Jobs / Photos
// --------------------------------------------------------------------------- //
export type QcVerdict = "ok" | "ko" | null;

export interface Photo {
  id: string;
  source_name: string;
  angle?: string | null;
  confidence?: number | null;
  candidate_url?: string | null;
  target_filename?: string | null;
  qc_verdict?: QcVerdict;
  qc_reasons?: string[];
  kept?: boolean;
  status: string;
}

export interface Job {
  id: string;
  marque: string;
  modele: string;
  infos: string;
  drive_folder: string;
  status: string;
}

export interface JobDetail {
  job: Job;
  photos: Photo[];
}

export interface CreateJobResult {
  job_id: string;
  drive_folder: string;
  photos: number;
}

export interface DeliverResult {
  folder_name: string;
  folder_id: string;
  uploads: unknown[];
}

export interface HistoryEntry {
  id: string;
  name: string;
  createdTime: string;
}

// --------------------------------------------------------------------------- //
// Helper bas niveau
// --------------------------------------------------------------------------- //
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  const token = await getAccessToken();
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      ...init,
      headers: {
        ...(init?.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (e) {
    throw new ApiError(
      `Réseau injoignable (${API_BASE}) : ${(e as Error).message}`,
      0,
    );
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = (body as { detail?: string }).detail ?? JSON.stringify(body);
    } catch {
      // corps non-JSON, on garde statusText
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// --------------------------------------------------------------------------- //
// Endpoints
// --------------------------------------------------------------------------- //
export const api = {
  // Config
  getConfig: () => request<Config>("/config"),
  putConfig: (patch: ConfigPatch) =>
    request<Config>("/config", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  // Reference assets
  listAssets: (type?: AssetType) =>
    request<ReferenceAsset[]>(
      `/reference-assets${type ? `?type=${type}` : ""}`,
    ),
  uploadAsset: (type: AssetType, name: string, file: File) => {
    const fd = new FormData();
    fd.append("type", type);
    fd.append("name", name);
    fd.append("file", file);
    return request<ReferenceAsset>("/reference-assets", {
      method: "POST",
      body: fd,
    });
  },
  activateAsset: (id: string, type: AssetType) => {
    const fd = new FormData();
    fd.append("type", type);
    return request<ReferenceAsset>(`/reference-assets/${id}/active`, {
      method: "PUT",
      body: fd,
    });
  },

  // Jobs
  createJob: (
    marque: string,
    modele: string,
    infos: string,
    files: File[],
  ) => {
    const fd = new FormData();
    fd.append("marque", marque);
    fd.append("modele", modele);
    fd.append("infos", infos);
    files.forEach((f) => fd.append("files", f));
    return request<CreateJobResult>("/jobs", { method: "POST", body: fd });
  },
  getJob: (id: string) => request<JobDetail>(`/jobs/${id}`),
  deliverJob: (id: string, sources: string[]) =>
    request<DeliverResult>(`/jobs/${id}/deliver`, {
      method: "POST",
      body: JSON.stringify({ sources }),
    }),

  // Photos
  retryPhoto: (id: string) =>
    request<Photo>(`/photos/${id}/retry`, { method: "POST" }),

  // History
  getHistory: () => request<HistoryEntry[]>("/history"),
  deleteHistory: (folderId: string) =>
    request<{ deleted: string }>(`/history/${folderId}`, {
      method: "DELETE",
    }),
};
