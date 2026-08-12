"use client";

import { useState, useTransition } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ConfirmCancelButton({
  itemName,
  onConfirm,
  label = "Batalkan",
  size = "sm",
}: {
  itemName: string;
  onConfirm: () => Promise<{ error?: string; success?: boolean }>;
  label?: string;
  size?: "sm" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant="outline">
          <Ban className="size-4 text-danger" />
          {size === "sm" && label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batalkan {itemName}?</DialogTitle>
          <DialogDescription>
            Tindakan ini tercatat di audit log dan tidak bisa diurungkan dari sini.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Tutup
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const result = await onConfirm();
                if (result?.error) {
                  toast.error(result.error);
                } else {
                  toast.success("Berhasil dibatalkan");
                  setOpen(false);
                }
              });
            }}
          >
            {isPending ? "Membatalkan..." : "Ya, Batalkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
