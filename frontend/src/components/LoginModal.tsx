"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, Loader2, User, Calendar, Mail, CreditCard, Check, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ConfirmationResult } from "firebase/auth";
import { useRouter } from "next/navigation";
import LocationSelector, { LocationValue } from "./LocationSelector";
import { describeAuthError, isExpectedAuthError } from "@/lib/authErrors";

type Step = "phone" | "otp" | "new-user-form" | "success";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VALID_MOBILE = /^[6-9]\d{9}$/;
const RESEND_COOLDOWN_SECONDS = 30;

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const {
    sendPhoneOtp,
    verifyPhoneOtp, 
    completeRegistration, 
    logout,
    user: authUser
  } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [resending, setResending] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    dob: "",
    aadhaarLast4: "",
  });
  const [location, setLocation] = useState<LocationValue>({
    state: "",
    district: "",
    village: "",
    pincode: "",
  });

  useEffect(() => {
    if (isOpen && authUser && !authUser.name && step !== "new-user-form") {
      setStep("new-user-form");
    }
  }, [isOpen, authUser, step]);

  const handlePhoneSubmit = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const result = await sendPhoneOtp(phone);
      setConfirmationResult(result);
      setResendIn(RESEND_COOLDOWN_SECONDS);
      setStep("otp");
    } catch (err) {
      if (!isExpectedAuthError(err)) console.error(err);
      setErrorMessage(describeAuthError(err, "Failed to send OTP. Please check the number."));
    } finally {
      setLoading(false);
    }
  };

  // Count down until the user may ask for another code.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const handleResendOtp = async () => {
    if (resendIn > 0 || resending || loading) return;
    setResending(true);
    setErrorMessage("");
    try {
      // A new code replaces the old one, so the old confirmation can no longer be used.
      const result = await sendPhoneOtp(phone);
      setConfirmationResult(result);
      setOtp(["", "", "", "", "", ""]);
      setResendIn(RESEND_COOLDOWN_SECONDS);
      document.getElementById("otp-0")?.focus();
    } catch (err) {
      if (!isExpectedAuthError(err)) console.error(err);
      setErrorMessage(describeAuthError(err, "Could not resend the code. Please try again."));
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = async (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    
    if (value && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`);
      next?.focus();
    }
    
    // Automatically trigger verification when all digits are filled
    if (newOtp.every(d => d !== "") && index === 5) {
      setLoading(true);
      setErrorMessage("");
      try {
        if (!confirmationResult) throw new Error("No verification session found.");
        const code = newOtp.join("");
        const { isNew } = await verifyPhoneOtp(confirmationResult, code);
        
        if (isNew) {
          setStep("new-user-form");
        } else {
          handleSuccess();
        }
      } catch (err) {
        if (!isExpectedAuthError(err)) console.error(err);
        setErrorMessage(describeAuthError(err, "Invalid code. Please try again."));
        setOtp(["", "", "", "", "", ""]);
        document.getElementById("otp-0")?.focus();
      } finally {
        setLoading(false);
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    // 1. Mandatory Fields Validation
    if (!form.name || !form.email || !form.dob || !form.aadhaarLast4) {
      setErrorMessage("All fields are mandatory. Please fill in your complete details.");
      return;
    }
    if (!location.state || !location.district || !location.village || !location.pincode) {
      setErrorMessage("Please select your complete location (State, District, Village, Pincode).");
      return;
    }

    if (new Date(form.dob) > new Date()) {
      setErrorMessage("Date of birth cannot be in the future.");
      return;
    }

    // 2. Aadhaar Validation
    if (form.aadhaarLast4.length !== 4) {
      setErrorMessage("Please enter exactly 4 digits for your Aadhaar card.");
      return;
    }

    setLoading(true);
    try {
      await completeRegistration({
        name: form.name,
        email: form.email,
        dob: form.dob,
        aadhaarLast4: form.aadhaarLast4,
        village: location.village,
        district: location.district,
        state: location.state,
        pincode: location.pincode,
      });
      handleSuccess();
    } catch (err) {
      console.error(err);
      setErrorMessage(describeAuthError(err, "Failed to save details. Please check the form."));
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setStep("success");
    setTimeout(() => {
      onClose();
      router.push("/dashboard");
    }, 1500);
  };

  const handleCancelRegistration = () => {
    logout();
    setStep("phone");
    setPhone("");
    setOtp(["", "", "", "", "", ""]);
    setLoading(false);
    setErrorMessage("");
    onClose();
  };

  const resetModal = () => {
    if (step === "new-user-form") {
      setErrorMessage("Please complete your profile to continue.");
      return;
    }
    setStep("phone");
    setPhone("");
    setOtp(["", "", "", "", "", ""]);
    setLoading(false);
    setErrorMessage("");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetModal}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto"
          >
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden my-8">
              
              {/* Top Cover */}
              <div className="relative bg-gradient-to-br from-[#1B5E20] to-[#2E7D32] px-6 py-8 text-center text-white">
                <button onClick={step === "new-user-form" ? handleCancelRegistration : resetModal} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors">
                  <X size={20} />
                </button>
                <div className="w-12 h-12 bg-[#FFC107] rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl shadow-md">
                  🌾
                </div>
                <h2 className="text-2xl font-bold font-[family-name:var(--font-poppins)]">
                  {step === "phone" && "Welcome to CropLine"}
                  {step === "otp" && "Verify SMS Code"}
                  {step === "new-user-form" && "Complete Profile"}
                  {step === "success" && "Successfully Logged In!"}
                </h2>
                <p className="text-white/75 text-sm mt-1">
                  {step === "phone" && "Enter your mobile number. We will send you a 6-digit OTP code"}
                  {step === "otp" && `Verification code sent to +91 ${phone}`}
                  {step === "new-user-form" && "Fill out your details to explore crops"}
                  {step === "success" && "Redirecting to your dashboard..."}
                </p>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="bg-red-50 text-red-600 text-xs px-6 py-3 border-b border-red-100 font-semibold text-center">
                  ⚠️ {errorMessage}
                </div>
              )}

              {/* Form Body */}
              <div className="p-6">
                
                {/* Step 1: Phone Input */}
                {step === "phone" && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                    <div className="flex items-center gap-2 border-2 border-gray-200 focus-within:border-[#1B5E20] rounded-2xl px-4 py-3 transition-colors">
                      <span className="text-[#424242] font-semibold text-sm">+91</span>
                      <div className="w-px h-5 bg-gray-300" />
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="Enter 10-digit mobile number"
                        value={phone}
                        onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                        className="flex-1 outline-none text-[#212121] font-semibold placeholder:text-gray-400"
                      />
                    </div>
                    
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={handlePhoneSubmit}
                      disabled={!VALID_MOBILE.test(phone) || loading}
                      className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-2xl py-3.5 font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-md"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>Send OTP <ChevronRight size={16} /></>
                      )}
                    </motion.button>
                  </motion.div>
                )}

                {/* Step 2: OTP Code */}
                {step === "otp" && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                    <div className="flex gap-2 justify-center">
                      {otp.map((digit, i) => (
                        <input
                          key={i}
                          id={`otp-${i}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={e => handleOtpChange(i, e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Backspace" && !digit && i > 0) {
                              document.getElementById(`otp-${i - 1}`)?.focus();
                            }
                          }}
                          className="w-11 h-12 text-center text-xl font-bold border-2 border-gray-200 focus:border-[#1B5E20] rounded-xl outline-none transition-colors"
                        />
                      ))}
                    </div>
                    
                    {loading && (
                      <div className="flex justify-center gap-2 items-center text-[#2E7D32] text-sm font-semibold">
                        <Loader2 className="w-4 h-4 animate-spin" /> Verifying OTP...
                      </div>
                    )}

                    <p className="text-center text-sm text-gray-400">
                      Didn&apos;t receive the code?{" "}
                      {resendIn > 0 ? (
                        <span className="font-semibold">Resend in {resendIn}s</span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          disabled={loading || resending}
                          className="text-[#2E7D32] font-semibold hover:underline disabled:opacity-50 disabled:no-underline"
                        >
                          {resending ? "Sending..." : "Resend OTP"}
                        </button>
                      )}
                    </p>
                    
                    <button 
                      onClick={() => setStep("phone")} 
                      className="w-full text-center text-sm font-bold text-[#2E7D32] hover:underline"
                    >
                      ← Change Phone Number
                    </button>
                  </motion.div>
                )}

                {/* Step 3: Register New User Form */}
                {step === "new-user-form" && (
                  <form onSubmit={handleFormSubmit} className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                    <div className="bg-[#E8F5E9] border border-[#A5D6A7] text-[#2E7D32] text-xs p-3.5 rounded-2xl font-semibold leading-relaxed">
                      🌱 Welcome to CropLine! Since this is your first time logging in, please fill in your details to configure your buyer profile.
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#424242] mb-1.5 block">Full Name</label>
                      <div className="flex items-center gap-2 border-2 border-gray-200 focus-within:border-[#1B5E20] rounded-xl px-3 py-2.5 transition-colors bg-white">
                        <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <input
                          required
                          type="text"
                          placeholder="e.g. Ramesh Singh"
                          value={form.name}
                          onChange={e => setForm({ ...form, name: e.target.value })}
                          className="flex-1 outline-none text-sm text-[#212121] font-semibold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#424242] mb-1.5 block">Email Address</label>
                      <div className="flex items-center gap-2 border-2 border-gray-200 focus-within:border-[#1B5E20] rounded-xl px-3 py-2.5 transition-colors bg-white">
                        <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <input
                          required
                          type="email"
                          placeholder="e.g. ramesh@gmail.com"
                          value={form.email}
                          onChange={e => setForm({ ...form, email: e.target.value })}
                          className="flex-1 outline-none text-sm text-[#212121] font-semibold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#424242] mb-1.5 block">Phone Number (verified)</label>
                      <div className="flex items-center gap-2 border-2 border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50">
                        <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <input
                          type="tel"
                          readOnly
                          value={authUser?.phone ?? ""}
                          className="flex-1 outline-none text-sm text-gray-500 font-semibold bg-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#424242] mb-1.5 block">Date of Birth (DOB)</label>
                      <div className="flex items-center gap-2 border-2 border-gray-200 focus-within:border-[#1B5E20] rounded-xl px-3 py-2.5 transition-colors bg-white">
                        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <input
                          required
                          type="date"
                          max={new Date().toISOString().split("T")[0]}
                          value={form.dob}
                          onChange={e => setForm({ ...form, dob: e.target.value })}
                          className="flex-1 outline-none text-sm text-[#212121] font-semibold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#424242] mb-1.5 block">Aadhaar Card (Last 4 Digits)</label>
                      <div className="flex items-center gap-2 border-2 border-gray-200 focus-within:border-[#1B5E20] rounded-xl px-3 py-2.5 transition-colors bg-white">
                        <CreditCard className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <input
                          required
                          type="text"
                          maxLength={4}
                          placeholder="e.g. 5678"
                          value={form.aadhaarLast4}
                          onChange={e => setForm({ ...form, aadhaarLast4: e.target.value.replace(/\D/g, "") })}
                          className="flex-1 outline-none text-sm text-[#212121] font-semibold"
                        />
                      </div>
                    </div>

                    <LocationSelector
                      value={location}
                      onChange={setLocation}
                      showVillage={true}
                      showPincode={true}
                      required={true}
                      label="Address / Location"
                    />

                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-2xl py-3.5 font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>🌿 Complete Onboarding</>
                      )}
                    </motion.button>
                  </form>
                )}

                {/* Step 4: Success State */}
                {step === "success" && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    className="flex flex-col items-center py-6 space-y-4"
                  >
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 shadow-md">
                      <Check className="w-8 h-8" strokeWidth={3} />
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-bold text-[#212121]">Onboarding Successful!</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Welcome {form.name || authUser?.name || "User"} to CropLine
                      </p>
                    </div>
                  </motion.div>
                )}

              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
