"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmCashTransaction } from "./receipt/actions";

export function ConfirmDraftButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="icon"
      variant="ghost"
      title="Tandai sudah dicek"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await confirmCashTransaction(id);
          if (result?.error) toast.error(result.error);
          else toast.success("Transaksi dikonfirmasi");
        })
      }
    >
      <Check className="size-4 text-success" />
    </Button>
  );
}
