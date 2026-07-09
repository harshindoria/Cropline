"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, Loader2, User, Calendar, MapPin, Mail, CreditCard, ChevronRight, Check } from "lucide-react";
import { useAuth, Role } from "../context/AuthContext";
import { ConfirmationResult } from "firebase/auth";
import { useRouter } from "next/navigation";

type Step = "choose" | "phone" | "otp" | "new-user-form" | "success";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { 
    loginWithGoogle, 
    sendPhoneOtp, 
    verifyPhoneOtp, 
    completeRegistration, 
    mockLogin,
    user: authUser
  } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("choose");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "",
    aadhaarLast4: "",
    village: "",
    district: "",
    state: "",
    pincode: "",
  });

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const { isNew } = await loginWithGoogle();
      if (isNew) {
        setStep("new-user-form");
      } else {
        handleSuccess();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to log in with Google.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const result = await sendPhoneOtp(phone);
      setConfirmationResult(result);
      setStep("otp");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to send OTP. Please check the number.");
    } finally {
      setLoading(false);
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
          setForm(prev => ({ ...prev, phone }));
          setStep("new-user-form");
        } else {
          handleSuccess();
        }
      } catch (err: any) {
        console.error(err);
        setErrorMessage(err.message || "Invalid code. Please try again.");
        setOtp(["", "", "", "", "", ""]);
        document.getElementById("otp-0")?.focus();
      } finally {
        setLoading(false);
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    try {
      await completeRegistration({
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        aadhaarLast4: form.aadhaarLast4,
        village: form.village,
        district: form.district,
        state: form.state,
        pincode: form.pincode,
      });
      handleSuccess();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to save details. Please check the form.");
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

  const handleDemoAccess = (role: Role) => {
    setLoading(true);
    setErrorMessage("");
    try {
      mockLogin(role);
      handleSuccess();
    } catch (err: any) {
      setErrorMessage("Mock login failed");
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setStep("choose");
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
                <button onClick={resetModal} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors">
                  <X size={20} />
                </button>
                <div className="w-12 h-12 bg-[#FFC107] rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl shadow-md">
                  🌾
                </div>
                <h2 className="text-2xl font-bold font-[family-name:var(--font-poppins)]">
                  {step === "choose" && "Welcome to CropLine"}
                  {step === "phone" && "Enter Phone Number"}
                  {step === "otp" && "Verify SMS Code"}
                  {step === "new-user-form" && "Complete Profile"}
                  {step === "success" && "Successfully Logged In!"}
                </h2>
                <p className="text-white/75 text-sm mt-1">
                  {step === "choose" && "Connecting farmers directly with buyers"}
                  {step === "phone" && "We will send you a 6-digit OTP code"}
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
                
                {/* Step 1: Sign-in Options */}
                {step === "choose" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-3 border-2 border-gray-200 hover:border-[#1B5E20] rounded-2xl py-3.5 px-4 font-semibold text-[#424242] transition-all duration-200"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin text-[#1B5E20]" /> : <GoogleIcon />}
                      Continue with Google
                    </motion.button>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">or</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => setStep("phone")}
                      className="w-full flex items-center justify-center gap-3 bg-[#1B5E20] hover:bg-[#2E7D32] rounded-2xl py-3.5 px-4 font-semibold text-white transition-all duration-200 shadow-md"
                    >
                      <Phone size={18} />
                      Continue with Phone
                    </motion.button>


                  </motion.div>
                )}

                {/* Step 2: Phone Input */}
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
                      disabled={phone.length !== 10 || loading}
                      className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-2xl py-3.5 font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-md"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>Send OTP <ChevronRight size={16} /></>
                      )}
                    </motion.button>
                    
                    <button 
                      onClick={() => setStep("choose")} 
                      className="w-full text-center text-sm font-bold text-[#2E7D32] hover:underline"
                    >
                      ← Back Options
                    </button>
                  </motion.div>
                )}

                {/* Step 3: OTP Code */}
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
                      <button className="text-[#2E7D32] font-semibold hover:underline">Resend OTP</button>
                    </p>
                    
                    <button 
                      onClick={() => setStep("phone")} 
                      className="w-full text-center text-sm font-bold text-[#2E7D32] hover:underline"
                    >
                      ← Change Phone Number
                    </button>
                  </motion.div>
                )}

                {/* Step 4: Register New User Form */}
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
                      <label className="text-xs font-bold text-[#424242] mb-1.5 block">Phone Number</label>
                      <div className="flex items-center gap-2 border-2 border-gray-200 focus-within:border-[#1B5E20] rounded-xl px-3 py-2.5 transition-colors bg-white">
                        <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <input
                          required
                          type="tel"
                          maxLength={10}
                          placeholder="10-digit mobile number"
                          value={form.phone}
                          onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
                          className="flex-1 outline-none text-sm text-[#212121] font-semibold"
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

                    <div>
                      <label className="text-xs font-bold text-[#424242] mb-1.5 block">Onboarding Address / Location</label>
                      <div className="border-2 border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#2E7D32] flex-shrink-0" />
                          <span className="text-xs font-bold text-gray-500 uppercase">Address details</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            required
                            type="text"
                            placeholder="Village / Area"
                            value={form.village}
                            onChange={e => setForm({ ...form, village: e.target.value })}
                            className="bg-white border border-gray-200 rounded-lg p-2 text-xs font-semibold outline-none focus:border-[#1B5E20]"
                          />
                          <input
                            required
                            type="text"
                            placeholder="District"
                            value={form.district}
                            onChange={e => setForm({ ...form, district: e.target.value })}
                            className="bg-white border border-gray-200 rounded-lg p-2 text-xs font-semibold outline-none focus:border-[#1B5E20]"
                          />
                          <input
                            required
                            type="text"
                            placeholder="State"
                            value={form.state}
                            onChange={e => setForm({ ...form, state: e.target.value })}
                            className="bg-white border border-gray-200 rounded-lg p-2 text-xs font-semibold outline-none focus:border-[#1B5E20]"
                          />
                          <input
                            required
                            type="text"
                            maxLength={6}
                            placeholder="Pincode"
                            value={form.pincode}
                            onChange={e => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "") })}
                            className="bg-white border border-gray-200 rounded-lg p-2 text-xs font-semibold outline-none focus:border-[#1B5E20]"
                          />
                        </div>
                      </div>
                    </div>

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

                {/* Step 5: Success State */}
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
