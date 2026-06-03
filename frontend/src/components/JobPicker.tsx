"use client";

import { useState } from "react";
import { Button, inputClass } from "@/components/ui";
import { setStoredJobId } from "@/lib/useJob";

export function JobPicker({
  jobId,
  onChange,
}: {
  jobId: string;
  onChange: (id: string) => void;
}) {
  const [value, setValue] = useState(jobId);

  return (
    <form
      className="mb-6 flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const id = value.trim();
        setStoredJobId(id);
        onChange(id);
      }}
    >
      <label className="flex-1 min-w-[260px]">
        <span className="mb-1 block text-sm font-medium text-zinc-700">
          Identifiant du job
        </span>
        <input
          className={inputClass}
          value={value}
          placeholder="job_id renvoyé par l'écran Génération"
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <Button type="submit" variant="secondary">
        Charger
      </Button>
    </form>
  );
}
