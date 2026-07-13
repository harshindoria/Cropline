"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  signOut as firebaseSignOut,
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
  phone: string | null;
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
  loginWithGoogle: () => Promise<{ isNew: boolean }>;
  sendPhoneOtp: (phoneNumber: string) => Promise<ConfirmationResult>;
  verifyPhoneOtp: (confirmationResult: ConfirmationResult, otp: string) => Promise<{ isNew: boolean }>;
  completeRegistration: (profileData: Partial<UserProfile>) => Promise<void>;
  switchRole: (role: Role) => Promise<void>;
  onboardNewRole: (role: "FARMER" | "DELIVERY", additionalData?: Record<string, any>) => Promise<void>;
  logout: () => Promise<void>;
  mockLogin: (mockRole: Role) => void; // Added for easy demoing/testing
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  const handleBackendLogin = async (idToken: string, isPhone: boolean) => {
    const endpoint = isPhone ? "/auth/login/phone" : "/auth/login/email";
    try {
      const response = await api.post(endpoint, { idToken });
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

  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      return await handleBackendLogin(idToken, false);
    } finally {
      setLoading(false);
    }
  };

  const sendPhoneOtp = async (phoneNumber: string) => {
    // Check or create Recaptcha verifier
    let verifier = (window as any).recaptchaVerifier;
    if (!verifier) {
      verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
      (window as any).recaptchaVerifier = verifier;
    }
    
    // Add country code if not present
    const formattedPhone = phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber}`;
    return await signInWithPhoneNumber(auth, formattedPhone, verifier);
  };

  const verifyPhoneOtp = async (confirmationResult: ConfirmationResult, otp: string) => {
    try {
      setLoading(true);
      const result = await confirmationResult.confirm(otp);
      const idToken = await result.user.getIdToken();
      return await handleBackendLogin(idToken, true);
    } finally {
      setLoading(false);
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

      await api.post("/users/onboard-role", { role, ...additionalData });
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
      phone: "9999999999",
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
        loginWithGoogle,
        sendPhoneOtp,
        verifyPhoneOtp,
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
