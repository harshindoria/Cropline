"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  updatePhoneNumber,
  ConfirmationResult
} from "firebase/auth";
import { auth } from "../lib/firebase"; 
import { isAxiosError } from "axios";
import api, { SESSION_EXPIRED_EVENT } from "../lib/axios";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

export type Role = "BUYER" | "FARMER" | "DELIVERY" | "ADMIN"; 

export interface UserProfile {
  id: string;
  firebaseUid: string;
  name: string | null;
  email: string | null;
  phone: string;
  roles: Role[];
  activeRole: Role;
  aadhaarLast4: string | null;
  village: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  dob?: string | null;
  latitude: number | null;
  longitude: number | null;
  farmArea: number | null;
  vehicleType: string | null;
  walletBalance: string;
  isVerified: boolean;
  isActive: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  token: string | null;
  isNewUser: boolean;
  sendPhoneOtp: (phoneNumber: string) => Promise<ConfirmationResult>;
  verifyPhoneOtp: (confirmationResult: ConfirmationResult, otp: string) => Promise<{ isNew: boolean }>;
  sendPhoneChangeOtp: (phoneNumber: string) => Promise<string>;
  confirmPhoneChange: (verificationId: string, otp: string) => Promise<void>;
  completeRegistration: (profileData: Partial<UserProfile>) => Promise<void>;
  switchRole: (role: Role) => Promise<void>;
  onboardNewRole: (role: "FARMER" | "DELIVERY", additionalData?: Record<string, unknown>) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize and check current token
  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedToken = localStorage.getItem("cropline_token");
        const savedUser = localStorage.getItem("cropline_user");
        
        if (savedToken && savedUser) {
          setUser(JSON.parse(savedUser));

          // The token is only published after this check, so the socket never connects with an expired one
          try {
            const res = await api.get("/users/profile");
            if (res.data.success) {
              const updatedUser = res.data.user;
              setUser(updatedUser);
              localStorage.setItem("cropline_user", JSON.stringify(updatedUser));
            }
            setToken(savedToken);
          } catch (err) {
            const status = isAxiosError(err) ? err.response?.status : undefined;
            if (status === 401 || status === 403) {
              // An expired session is normal: return to the logged-out state without raising an error
              localStorage.removeItem("cropline_token");
              localStorage.removeItem("cropline_user");
              setUser(null);
            } else {
              // Server unreachable or failing: that says nothing about the session, so keep it
              console.warn("Could not verify the saved session. Keeping it for now.", err);
              setToken(savedToken);
            }
          }
        }
      } catch (e) {
        console.error("Error checking auth state", e);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const handleBackendLogin = async (idToken: string) => {
    try {
      const response = await api.post("/auth/login/phone", { idToken });
      const { success, safeUser, token: backendToken, isNewUser: newUserFlag } = response.data;
      
      if (success) {
        localStorage.setItem("cropline_token", backendToken);
        localStorage.setItem("cropline_user", JSON.stringify(safeUser));
        setToken(backendToken);
        setUser(safeUser);
        setIsNewUser(newUserFlag);
        return { isNew: newUserFlag };
      }
      throw new Error("Backend authentication failed");
    } catch (error) {
      console.error("Error during backend validation", error);
      throw error;
    }
  };

  const getRecaptchaVerifier = (): RecaptchaVerifier => {
    // One verifier for the whole page; Firebase resets it after every use.
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
    }
    return window.recaptchaVerifier;
  };

  // Add country code if not present
  const toE164 = (phoneNumber: string) => (phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber}`);

  const sendPhoneOtp = async (phoneNumber: string) => {
    return await signInWithPhoneNumber(auth, toE164(phoneNumber), getRecaptchaVerifier());
  };

  const verifyPhoneOtp = async (confirmationResult: ConfirmationResult, otp: string) => {
    try {
      setLoading(true);
      const result = await confirmationResult.confirm(otp);
      const idToken = await result.user.getIdToken();
      return await handleBackendLogin(idToken);
    } finally {
      setLoading(false);
    }
  };

  const sendPhoneChangeOtp = async (phoneNumber: string) => {
    if (!auth.currentUser) {
      throw new Error("For your security, please log out and log in again before changing your number.");
    }
    return await new PhoneAuthProvider(auth).verifyPhoneNumber(toE164(phoneNumber), getRecaptchaVerifier());
  };

  const confirmPhoneChange = async (verificationId: string, otp: string) => {
    if (!auth.currentUser) {
      throw new Error("For your security, please log out and log in again before changing your number.");
    }
    await updatePhoneNumber(auth.currentUser, PhoneAuthProvider.credential(verificationId, otp));
    // Force a fresh token, because the current one still holds the old number.
    const idToken = await auth.currentUser.getIdToken(true);
    const response = await api.post("/auth/change-phone", { idToken });
    if (response.data.success) {
      setUser(response.data.user);
      localStorage.setItem("cropline_user", JSON.stringify(response.data.user));
    }
  };

  const completeRegistration = async (profileData: Partial<UserProfile>) => {
    try {
      setLoading(true);
      const response = await api.patch("/users/profile", profileData);
      if (response.data.success) {
        const updatedUser = response.data.user;
        setUser(updatedUser);
        localStorage.setItem("cropline_user", JSON.stringify(updatedUser));
        setIsNewUser(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const switchRole = async (role: Role) => {
    try {
      setLoading(true);
      const response = await api.post("/users/switch-role", { role });
      if (response.data.success) {
        const { user: updatedUser, token: newToken } = response.data;
        setUser(updatedUser);
        setToken(newToken);
        localStorage.setItem("cropline_token", newToken);
        localStorage.setItem("cropline_user", JSON.stringify(updatedUser));
      }
    } finally {
      setLoading(false);
    }
  };

  const onboardNewRole = async (role: "FARMER" | "DELIVERY", additionalData?: Record<string, unknown>) => {
    try {
      setLoading(true);
      const response = await api.post("/users/onboard-role", { role, ...additionalData });
      return response.data;
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        alert(err.response.data?.message || "Application already pending.");
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (auth.currentUser) {
        await firebaseSignOut(auth);
      }
    } catch (e) {
      console.error("Error signing out of Firebase", e);
    }
    localStorage.removeItem("cropline_token");
    localStorage.removeItem("cropline_user");
    setUser(null);
    setToken(null);
    setIsNewUser(false);
  };

  // The token expired or the account is gone while the app was open: log out and leave the dashboard.
  useEffect(() => {
    const handleSessionExpired = async () => {
      await logout();
      if (window.location.pathname !== "/") window.location.assign("/");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    // logout only uses state setters and storage, so the first one stays correct.
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        token,
        isNewUser,
        sendPhoneOtp,
        verifyPhoneOtp,
        sendPhoneChangeOtp,
        confirmPhoneChange,
        completeRegistration,
        switchRole,
        onboardNewRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
