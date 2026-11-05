"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const VALID_MOBILE = /^[6-9]\d{9}$/;

type ChangePhoneError = {
  code?: string;
  message?: string;
  response?: { data?: { message?: string } };
};

const describeError = (error: unknown): string => {
  const err = error as ChangePhoneError | undefined;
  switch (err?.code) {
    case "auth/credential-already-in-use":
    case "auth/account-exists-with-different-credential":
      return "This number already belongs to another account.";
    case "auth/invalid-verification-code":
      return "That code is not correct. Please try again.";
    case "auth/code-expired":
      return "That code has expired. Please request a new one.";
    case "auth/requires-recent-login":
      return "For your security, please log out and log in again before changing your number.";
    default:
      return err?.response?.data?.message || err?.message || "Could not change your number. Please try again.";
  }
};

export default function ChangePhoneNumber() {
  const { sendPhoneChangeOtp, confirmPhoneChange } = useAuth();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    setOpen(false);
    setPhone("");
    setCode("");
    setVerificationId(null);
    setError("");
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      console.error("Change phone error", err);
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      setVerificationId(await sendPhoneChangeOtp(phone));
    });

  const confirmCode = () =>
    run(async () => {
      await confirmPhoneChange(verificationId!, code);
      // Profile pages load their own copy of the user, so reload to show the new number.
      window.location.reload();
    });

  const canSubmit = !busy && (verificationId ? code.length === 6 : VALID_MOBILE.test(phone));
  const submit = verificationId ? confirmCode : sendCode;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-bold text-[#2E7D32] hover:underline"
      >
        Change number
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#212121]">Change phone number</h3>
              <button type="button" onClick={close} aria-label="Close" className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <p className="mb-4 text-sm text-gray-500">
              {verificationId
                ? `Enter the 6-digit code sent to +91 ${phone}.`
                : "We will send a code to your new number. After this, you will log in with the new number."}
            </p>

            {error && <p className="mb-3 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-600">{error}</p>}

            {verificationId ? (
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#1B5E20]"
              />
            ) : (
              <div className="flex items-center gap-2 rounded-xl border-2 border-gray-200 px-4 py-3 focus-within:border-[#1B5E20]">
                <span className="text-sm font-semibold text-[#424242]">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="New 10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                  className="flex-1 text-sm font-semibold outline-none"
                />
              </div>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#1B5E20] py-3 text-sm font-bold text-white hover:bg-[#2E7D32] disabled:bg-gray-100 disabled:text-gray-400"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : verificationId ? "Confirm new number" : "Send code"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
