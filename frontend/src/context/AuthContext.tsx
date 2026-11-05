"use client";

import { createContext, useContext, useState, useEffect, FC, ReactNode } from "react";
import {
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  updatePhoneNumber,
  ConfirmationResult
} from "firebase/auth";
import { auth } from "../lib/firebase"; 
import api from "../lib/axios"; 

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
  onboardNewRole: (role: "FARMER" | "DELIVERY", additionalData?: Record<string, any>) => Promise<void>;
  logout: () => Promise<void>;
  mockLogin: (mockRole: Role) => void; // Added for easy demoing/testing
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
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
          
          // Verify/refresh user status with backend
          try {
            const res = await api.get("/users/profile");
            if (res.data.success) {
              const updatedUser = res.data.user;
              setUser(updatedUser);
              localStorage.setItem("cropline_user", JSON.stringify(updatedUser));
            }
          } catch (err) {
            console.error("Failed to verify saved session, logging out.", err);
            // Session expired or backend down, but keep local for demo fallback unless token is invalid
            if (savedToken.startsWith("mock_")) {
              // It's a demo session, don't clear it
            } else {
              // Real token invalid
              localStorage.removeItem("cropline_token");
              localStorage.removeItem("cropline_user");
              setToken(null);
              setUser(null);
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
    } catch (error: any) {
      console.error("Error during backend validation", error);
      throw error;
    }
  };

  const getRecaptchaVerifier = (): RecaptchaVerifier => {
    let verifier = (window as any).recaptchaVerifier;
    if (!verifier) {
      verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
      (window as any).recaptchaVerifier = verifier;
    }
    return verifier;
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
      // Local fallback for mock roles
      if (token && token.startsWith("mock_")) {
        const updatedUser = { ...user!, activeRole: role };
        setUser(updatedUser);
        localStorage.setItem("cropline_user", JSON.stringify(updatedUser));
        return;
      }

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

  const onboardNewRole = async (role: "FARMER" | "DELIVERY", additionalData?: Record<string, any>) => {
    try {
      setLoading(true);
      // Local fallback for mock roles
      if (token && token.startsWith("mock_")) {
        alert(`Application for ${role} submitted! (Mock Mode Auto-Approval in 5 seconds)`);
        setTimeout(() => {
          const roles = [...(user?.roles || [])];
          if (!roles.includes(role)) roles.push(role);
          const updatedUser = { ...user!, roles, activeRole: role, vehicleType: additionalData?.vehicleType || user?.vehicleType || null, ...additionalData };
          setUser(updatedUser);
          localStorage.setItem("cropline_user", JSON.stringify(updatedUser));
        }, 3000);
        return;
      }

      const response = await api.post("/users/onboard-role", { role, ...additionalData });
      return response.data;
    } catch (err: any) {
      if (err.response?.status === 409) {
        alert(err.response.data.message || "Application already pending.");
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const mockLogin = (mockRole: Role) => {
    // Generate a structured mock user matching schema
    const mockUid = `mock_${Date.now()}`;
    const dummyUser: UserProfile = {
      id: `usr_${Date.now()}`,
      firebaseUid: mockUid,
      name: `Demo ${mockRole}`,
      email: `${mockRole.toLowerCase()}@cropline.com`,
      phone: "+919999999999",
      roles: [mockRole === "ADMIN" ? "ADMIN" : "BUYER", mockRole].filter(Boolean) as Role[],
      activeRole: mockRole,
      aadhaarLast4: "1234",
      village: "Kalyanpura",
      district: "Jaipur",
      state: "Rajasthan",
      pincode: "302020",
      latitude: 26.9124,
      longitude: 75.7873,
      farmArea: mockRole === "FARMER" ? 2.5 : null,
      vehicleType: mockRole === "DELIVERY" ? "BIKE" : null,
      walletBalance: "2500.00",
      isVerified: true,
      isActive: true
    };
    
    const dummyToken = `mock_jwt_token_${mockUid}`;
    
    localStorage.setItem("cropline_token", dummyToken);
    localStorage.setItem("cropline_user", JSON.stringify(dummyUser));
    setToken(dummyToken);
    setUser(dummyUser);
    setIsNewUser(false);
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
        mockLogin,
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
