import React, { useEffect, useState } from "react";
import { MAX_TOKEN_AGE } from "./RequireRole";

const Footer = () => {
  // ตรวจสอบสถานะ login
  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem('isLoggedIn') === 'true'
  );

  const [remaining, setRemaining] = useState(() => {
    const issuedAt = localStorage.getItem('jwt_issued_at');
    
    
    if (!issuedAt) return 0;
    const elapsed = Date.now() - parseInt(issuedAt, 10);
    return Math.max(0, Math.floor((MAX_TOKEN_AGE - elapsed) / 1000));
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const jwt = localStorage.getItem('jwt');
      const issuedAt = localStorage.getItem('jwt_issued_at');
      const currentLoginStatus = localStorage.getItem('isLoggedIn') === 'true';
      
      // อัพเดท login status
      setIsLoggedIn(currentLoginStatus);
      
      if (!jwt || !currentLoginStatus) {
        setRemaining(0);
        return;
      }
      
      // ถ้าไม่มี issuedAt ให้ตั้งใหม่
      if (!issuedAt) {
        localStorage.setItem('jwt_issued_at', Date.now().toString());
        setRemaining(Math.floor(MAX_TOKEN_AGE / 1000));
        return;
      }
      
      const elapsed = Date.now() - parseInt(issuedAt, 10);
      setRemaining(Math.max(0, Math.floor((MAX_TOKEN_AGE - elapsed) / 1000)));
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const totalSeconds = Math.floor(MAX_TOKEN_AGE / 1000);

  // ❌ ถ้าไม่ได้ login อย่าแสดง Footer เลย
  if (!isLoggedIn) {
    return null;
  }

  return (
    <footer
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        background: "rgba(255,255,255,0.85)",
        boxShadow: "0 -1px 8px rgba(0,0,0,0.04)",
        fontSize: "0.92rem",
        color: "#444",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "2rem",
        padding: "0.3rem 0",
        zIndex: 100
      }}
    >
      <span>
        <span style={{ color: "#888" }}>Session expires in:</span>{" "}
        <b style={{ color: "#e57373" }}>{formatTime(remaining)}</b>
      </span>
      <span style={{ fontSize: "0.85em", color: "#aaa" }}>
        <span style={{ color: "#bbb" }}>Duration:</span>{" "}
        <b>{formatTime(totalSeconds)}</b>
      </span>
    </footer>
  );
};

export default Footer;
