"use client";

import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import api from "@/lib/axios";

type PendingWithdrawal = {
  id: string;
  amount: string;
  createdAt: string;
  user: {
    name: string | null;
    phone: string;
    bankAccount: string | null;
    bankIfsc: string | null;
    bankName: string | null;
    accountHolderName: string | null;
  } | null;
};

// Payouts are sent by hand: admin makes the bank transfer, then marks the request as paid here.
export default function PendingWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<PendingWithdrawal[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchPending = useCallback(
    (): Promise<PendingWithdrawal[]> =>
      api
        .get("/admin/withdrawals")
        .then((res) => res.data.data ?? [])
        .catch((err) => {
          console.warn("Could not load withdrawals", err);
          return [];
        }),
    [],
  );

  useEffect(() => {
    fetchPending().then(setWithdrawals);
  }, [fetchPending]);

  const complete = async (withdrawal: PendingWithdrawal, action: "PAID" | "REJECTED") => {
    const amount = `₹${Number(withdrawal.amount).toLocaleString("en-IN")}`;
    const question =
      action === "PAID"
        ? `Have you already sent ${amount} to this bank account? This cannot be undone.`
        : `Reject this request and return ${amount} to the user's wallet? This cannot be undone.`;
    if (!window.confirm(question)) return;

    setBusyId(withdrawal.id);
    setError("");
    try {
      await api.post(`/admin/withdrawals/${withdrawal.id}/process`, { action });
    } catch (err) {
      setError((isAxiosError(err) && err.response?.data?.message) || "Could not update this withdrawal.");
    }
    setWithdrawals(await fetchPending());
    setBusyId(null);
  };

  if (withdrawals.length === 0 && !error) return null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-black text-gray-900">Withdrawal requests ({withdrawals.length})</h2>
      <p className="mt-1 text-xs font-semibold text-gray-500">
        Send the bank transfer first, then mark the request as paid.
      </p>

      {error && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-600">{error}</p>}

      <div className="mt-4 space-y-3">
        {withdrawals.map((withdrawal) => (
          <div
            key={withdrawal.id}
            className="flex flex-col gap-3 rounded-xl border border-gray-100 p-4 md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0 text-xs font-semibold text-gray-500">
              <p className="text-base font-black text-gray-900">₹{Number(withdrawal.amount).toLocaleString("en-IN")}</p>
              <p>
                {withdrawal.user?.name ?? "Unknown user"} · {withdrawal.user?.phone}
              </p>
              <p className="break-all">
                {withdrawal.user?.accountHolderName ?? "No account holder name"} · {withdrawal.user?.bankName ?? "No bank name"} ·{" "}
                {withdrawal.user?.bankAccount} · {withdrawal.user?.bankIfsc}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={busyId === withdrawal.id}
                onClick={() => complete(withdrawal, "REJECTED")}
                className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={busyId === withdrawal.id}
                onClick={() => complete(withdrawal, "PAID")}
                className="rounded-lg bg-[#1B5E20] px-4 py-2 text-xs font-bold text-white hover:bg-[#144716] disabled:opacity-50"
              >
                Mark as paid
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
