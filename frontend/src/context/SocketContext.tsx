"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, token } = useAuth(); // useAuth provides user profile and auth token

  useEffect(() => {
    if (!user?.id || !token) return;

    // Determine backend URL from NEXT_PUBLIC_API_URL or fallback
    // Note: If NEXT_PUBLIC_API_URL has /api/v1 at the end, we extract the base origin
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/v1";
    let backendUrl = "http://localhost:5001";
    try {
      const urlObj = new URL(apiUrl);
      backendUrl = urlObj.origin; // e.g. http://localhost:5001
    } catch (e) {
      console.warn("Invalid API URL, falling back to localhost:5001");
    }

    // The server verifies this token and puts the socket in the user's personal room.
    const socketInstance = io(backendUrl, {
      auth: { token },
      transports: ["websocket", "polling"], // prioritize websocket
    });

    socketInstance.on("connect", () => {
      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
    });

    socketInstance.on("connect_error", (error) => {
      console.warn(`[Socket] Connection failed: ${error.message}`);
      setIsConnected(false);
    });

    setSocket(socketInstance);

    // Cleanup on unmount, logout, or when the user or token changes
    return () => {
      socketInstance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [user?.id, token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
