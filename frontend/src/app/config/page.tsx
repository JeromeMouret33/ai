"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type AssetType,
  type Config,
  type ConfigFragments,
  type ConfigModels,
  type ConfigNomenclature,
  type ConfigOptions,
  type ConfigParams,
  type ConfigPatch,
  type ReferenceAsset,
} from "@/lib/api";
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  inputClass,
  PageTitle,
  Spinner,
} from "@/components/ui";

// Fragments textuels éditables (on exclut angle_presets, objet structuré).
const FRAGMENT_KEYS = [
  "role",
  "vehicle_lock",
  "ref_showroom",
  "ref_logo",
  "ref_vehicle",
  "ref_plate",
  "task_base",
  "relight",
  "plate",
  "composition",
  "constraints",
  "interior",
  "classify_instruction",
  "qc_instruction",
] as const;

const ASSET_TYPES: AssetType[] = ["showroom", "logo", "plate"];

export default function ConfigPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Champs éditables (copies locales).
  const [fragments, setFragments] = useState<Record<string, string>>({});
  const [models, setModels] = useState<ConfigModels>({
    classification: "",
    generation: "",
    qc: "",
  });
  const [options, setOptions] = useState<ConfigOptions>({
    relight_enabled: false,
    plate_enabled: false,
    interior_window_whiten: false,
  });
  const [params, setParams] = useState<{
    ratio: string;
    resolution: string;
    candidates_per_photo: number;
    max_retries: number;
    logo_position_size: string;
    drive_parent_folder: string;
  }>({
    ratio: "",
    resolution: "",
    candidates_per_photo: 1,
    max_retries: 0,
    logo_position_size: "",
    drive_parent_folder: "",
  });
  const [nomenclature, setNomenclature] = useState({ dossier: "", fichier: "" });

  const hydrate = useCallback((cfg: Config) => {
    setConfig(cfg);
    setFragments(
      Object.fromEntries(
        FRAGMENT_KEYS.map((k) => [k, (cfg.fragments[k] as string) ?? ""]),
      ),
    );
    setModels({ ...cfg.params.models });
    setOptions({ ...cfg.options });
    setParams({
      ratio: cfg.params.ratio ?? "",
      resolution: cfg.params.resolution ?? "",
      candidates_per_photo: cfg.params.candidates_per_photo ?? 1,
      max_retries: cfg.params.max_retries ?? 0,
      logo_position_size: cfg.params.logo_position_size ?? "",
      drive_parent_folder: cfg.params.drive_parent_folder ?? "",
    });
    setNomenclature({
      dossier: cfg.nomenclature.dossier ?? "",
      fichier: cfg.nomenclature.fichier ?? "",
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      hydrate(await api.getConfig());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [hydrate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      // Le PATCH params respecte la structure du fichier : racine `parametres`.
      const paramsPatch: ConfigParams = {
        models,
        ratio: params.ratio,
        resolution: params.resolution,
        candidates_per_photo: Number(params.candidates_per_photo),
        max_retries: Number(params.max_retries),
        logo_position_size: params.logo_position_size,
        drive_parent_folder: params.drive_parent_folder,
      };
      const nomenclaturePatch: Partial<ConfigNomenclature> = {
        dossier: nomenclature.dossier,
        fichier: nomenclature.fichier,
      };
      const patch: ConfigPatch = {
        fragments: fragments as Partial<ConfigFragments>,
        params: {
          parametres: paramsPatch,
          options,
          nomenclature: nomenclaturePatch,
        },
      };
      hydrate(await api.putConfig(patch));
      setSaved(true);
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !config) {
    return (
      <div>
        <PageTitle title="Configuration" />
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Configuration"
        subtitle="Fragments de prompt, modèles, options, paramètres, nomenclature et bibliothèque de références."
      />

      {error ? <ErrorBanner error={error} /> : null}

      {config ? (
        <>
          {/* Modèles */}
          <Card>
            <h2 className="mb-4 text-sm font-semibold">Modèles</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Classification">
                <input
                  className={inputClass}
                  value={models.classification}
                  onChange={(e) =>
                    setModels({ ...models, classification: e.target.value })
                  }
                />
              </Field>
              <Field label="Génération">
                <input
                  className={inputClass}
                  value={models.generation}
                  onChange={(e) =>
                    setModels({ ...models, generation: e.target.value })
                  }
                />
              </Field>
              <Field label="QC">
                <input
                  className={inputClass}
                  value={models.qc}
                  onChange={(e) => setModels({ ...models, qc: e.target.value })}
                />
              </Field>
            </div>
          </Card>

          {/* Options */}
          <Card>
            <h2 className="mb-4 text-sm font-semibold">Options</h2>
            <div className="space-y-3">
              {(
                [
                  ["relight_enabled", "Relighting activé"],
                  ["plate_enabled", "Plaque d'immatriculation"],
                  ["interior_window_whiten", "Blanchir les vitres (intérieur)"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex min-h-11 items-center gap-3 text-sm"
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-border bg-surface-2 accent-accent"
                    checked={options[key]}
                    onChange={(e) =>
                      setOptions({ ...options, [key]: e.target.checked })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </Card>

          {/* Paramètres */}
          <Card>
            <h2 className="mb-4 text-sm font-semibold">Paramètres</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Ratio">
                <input
                  className={inputClass}
                  value={params.ratio}
                  onChange={(e) => setParams({ ...params, ratio: e.target.value })}
                />
              </Field>
              <Field label="Résolution">
                <input
                  className={inputClass}
                  value={params.resolution}
                  onChange={(e) =>
                    setParams({ ...params, resolution: e.target.value })
                  }
                />
              </Field>
              <Field label="Candidats / photo">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={params.candidates_per_photo}
                  onChange={(e) =>
                    setParams({
                      ...params,
                      candidates_per_photo: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Tentatives max">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={params.max_retries}
                  onChange={(e) =>
                    setParams({ ...params, max_retries: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Logo (position / taille)">
                <input
                  className={inputClass}
                  value={params.logo_position_size}
                  onChange={(e) =>
                    setParams({ ...params, logo_position_size: e.target.value })
                  }
                />
              </Field>
              <Field label="Dossier Drive parent">
                <input
                  className={inputClass}
                  value={params.drive_parent_folder}
                  onChange={(e) =>
                    setParams({ ...params, drive_parent_folder: e.target.value })
                  }
                />
              </Field>
            </div>
          </Card>

          {/* Nomenclature */}
          <Card>
            <h2 className="mb-4 text-sm font-semibold">Nomenclature</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Template dossier"
                hint="ex. {marque} {modele} {infos}"
              >
                <input
                  className={inputClass}
                  value={nomenclature.dossier}
                  onChange={(e) =>
                    setNomenclature({ ...nomenclature, dossier: e.target.value })
                  }
                />
              </Field>
              <Field
                label="Template fichier"
                hint="ex. {marque}-{modele}_{angle}.jpg"
              >
                <input
                  className={inputClass}
                  value={nomenclature.fichier}
                  onChange={(e) =>
                    setNomenclature({ ...nomenclature, fichier: e.target.value })
                  }
                />
              </Field>
            </div>
          </Card>

          {/* Fragments */}
          <Card>
            <h2 className="mb-4 text-sm font-semibold">Fragments de prompt</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {FRAGMENT_KEYS.map((k) => (
                <Field key={k} label={k}>
                  <textarea
                    className={`${inputClass} min-h-24 font-mono text-xs`}
                    value={fragments[k] ?? ""}
                    onChange={(e) =>
                      setFragments({ ...fragments, [k]: e.target.value })
                    }
                  />
                </Field>
              ))}
            </div>
          </Card>

          <div className="space-y-2">
            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
            {saved ? (
              <p className="text-center text-sm text-emerald-400">
                Configuration enregistrée.
              </p>
            ) : null}
          </div>

          {/* Bibliothèque de références */}
          <ReferenceLibrary />
        </>
      ) : null}
    </div>
  );
}

function ReferenceLibrary() {
  const [assets, setAssets] = useState<ReferenceAsset[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAssets(await api.listAssets());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const activate = async (a: ReferenceAsset) => {
    setError(null);
    try {
      await api.activateAsset(a.id, a.type);
      await load();
    } catch (e) {
      setError(e);
    }
  };

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">
          Bibliothèque de références
        </h2>
        <Button variant="secondary" onClick={load} disabled={loading}>
          Rafraîchir
        </Button>
      </div>

      {error ? (
        <div className="mb-4">
          <ErrorBanner error={error} />
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {ASSET_TYPES.map((t) => (
          <UploadForm key={t} type={t} onUploaded={load} />
        ))}
      </div>

      {loading ? <Spinner /> : null}

      <div className="space-y-6">
        {ASSET_TYPES.map((t) => {
          const ofType = assets.filter((a) => a.type === t);
          return (
            <div key={t}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {t}
              </h3>
              {ofType.length === 0 ? (
                <p className="text-sm text-zinc-500">Aucun asset.</p>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {ofType.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => activate(a)}
                      className={`overflow-hidden rounded-xl border text-left transition-all ${
                        a.active
                          ? "border-accent ring-2 ring-accent"
                          : "border-border hover:border-zinc-600"
                      }`}
                    >
                      <div className="bg-surface-2">
                        {a.thumbnail_url || a.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.thumbnail_url ?? a.url}
                            alt={a.name}
                            className="aspect-square w-full object-cover"
                          />
                        ) : (
                          <div className="flex aspect-square w-full items-center justify-center text-xs text-muted">
                            —
                          </div>
                        )}
                      </div>
                      <p
                        className="truncate p-1.5 text-xs text-foreground"
                        title={a.name}
                      >
                        {a.active ? "★ " : ""}
                        {a.name}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function UploadForm({
  type,
  onUploaded,
}: {
  type: AssetType;
  onUploaded: () => void;
}) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.uploadAsset(type, name.trim(), file);
      setName("");
      setFile(null);
      onUploaded();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-2 rounded-xl border border-border bg-surface-2/40 p-3"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Ajouter — {type}
      </p>
      <input
        className={inputClass}
        placeholder="Nom"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="file"
        accept="image/*"
        className="block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-xs file:font-medium file:text-foreground"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {error ? <ErrorBanner error={error} /> : null}
      <Button
        type="submit"
        variant="secondary"
        className="w-full"
        disabled={busy || !file || !name.trim()}
      >
        {busy ? "Upload…" : "Uploader"}
      </Button>
    </form>
  );
}
