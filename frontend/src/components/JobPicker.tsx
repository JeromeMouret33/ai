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
      className="mb-6 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const id = value.trim();
        setStoredJobId(id);
        onChange(id);
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">
          Identifiant du job
        </span>
        <input
          className={inputClass}
          value={value}
          placeholder="job_id renvoyé par l'écran Génération"
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <Button type="submit" variant="secondary" className="w-full">
        Charger
      </Button>
    </form>
  );
}
