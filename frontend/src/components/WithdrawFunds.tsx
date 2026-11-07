"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { isAxiosError } from "axios";
import api from "@/lib/axios";

type Withdrawal = {
  id: string;
  amount: string;
  status: "AWAITING_TRANSFER" | "SETTLED" | "FAILED";
};

const VALID_AMOUNT = /^\d+(\.\d{1,2})?$/;

export default function WithdrawFunds({ balance, className = "" }: { balance: number; className?: string }) {
  const [pending, setPending] = useState<Withdrawal | null>(null);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/wallet/withdrawals")
      .then((res) => {
        const withdrawals: Withdrawal[] = res.data.data ?? [];
        setPending(withdrawals.find((withdrawal) => withdrawal.status === "AWAITING_TRANSFER") ?? null);
      })
      .catch((err) => console.warn("Could not load withdrawals", err));
  }, []);

  const close = () => {
    setOpen(false);
    setAmount("");
    setError("");
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await api.post("/wallet/withdrawals", { amount });
      // Dashboards read the balance from the saved user, so reload to show the new one.
      window.location.reload();
    } catch (err) {
      setError((isAxiosError(err) && err.response?.data?.message) || "Could not request the withdrawal. Please try again.");
      setBusy(false);
    }
  };

  if (pending) {
    return (
      <p className={`text-xs font-bold ${className}`}>
        ₹{Number(pending.amount).toLocaleString("en-IN")} withdrawal being processed
      </p>
    );
  }

  const canSubmit = !busy && VALID_AMOUNT.test(amount) && Number(amount) > 0 && Number(amount) <= balance;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={balance <= 0}
        className={`relative z-10 text-xs font-bold underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60 ${className}`}
      >
        {balance > 0 ? "Withdraw to bank" : "No balance to withdraw"}
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-80 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold text-[#212121]">Withdraw to bank</h3>
                <button type="button" onClick={close} aria-label="Close" className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>

              <p className="mb-4 text-sm text-gray-500">
                Available: ₹{balance.toLocaleString("en-IN")}. The money is sent to the bank account in your profile after
                an admin approves it.
              </p>

              {error && <p className="mb-3 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-600">{error}</p>}

              <div className="flex items-center gap-2 rounded-xl border-2 border-gray-200 px-4 py-3 focus-within:border-[#1B5E20]">
                <span className="text-sm font-semibold text-[#424242]">₹</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  className="flex-1 text-sm font-semibold text-[#212121] outline-none"
                />
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#1B5E20] py-3 text-sm font-bold text-white hover:bg-[#2E7D32] disabled:bg-gray-100 disabled:text-gray-400"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Request withdrawal"}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
