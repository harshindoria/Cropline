"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, Trash } from "lucide-react";
import api from "@/lib/axios";
import { motion, AnimatePresence } from "framer-motion";

export default function NotificationDropdown() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get("/notifications");
      if (res.data.success) {
        setNotifications(res.data.data);
        setUnreadCount(res.data.data.filter((n: any) => !n.isRead).length);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  const toggleDropdown = async () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      // Optimistically clear unread badge (we could also make an API call to mark as read)
      setUnreadCount(0);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div 
        onClick={toggleDropdown}
        className="relative p-2 bg-gray-50 rounded-full cursor-pointer hover:bg-gray-100 transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden"
          >
            <div className="p-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
              <h4 className="text-sm font-bold text-gray-800">Notifications</h4>
              <button 
                onClick={fetchNotifications}
                className="text-[10px] font-semibold text-[#1B5E20] hover:underline"
              >
                Refresh
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400 font-semibold">
                  No notifications yet.
                </div>
              ) : (
                notifications.map((notif) => (
                  <div key={notif.id} className={`p-3 border-b border-gray-50 last:border-0 hover:bg-green-50 transition-colors ${!notif.isRead ? 'bg-green-50/50' : ''}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h5 className="text-[13px] font-bold text-gray-800">{notif.title}</h5>
                        <p className="text-xs text-gray-600 mt-1 leading-snug">{notif.body}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 font-medium">
                      {new Date(notif.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
