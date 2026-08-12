"use client";

import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportPdfButton() {
  return (
    <Button size="sm" variant="outline" onClick={() => window.print()}>
      <FileDown className="size-4" />
      Export PDF
    </Button>
  );
}
