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
    <footer className="w-full bg-white/80 backdrop-blur-md border-t border-slate-100 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] z-[10] py-3 px-4 select-none font-prompt shrink-0">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-[10px] sm:text-xs">
        {/* Progress Section */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Session expires in:</span>
            <span className={`font-black tabular-nums transition-colors duration-300 ${remaining < 300 ? 'text-rose-500 animate-pulse' : 'text-indigo-600'}`}>
              {formatTime(remaining)}
            </span>
          </div>
          
          {/* Visual Progress Bar */}
          <div className="hidden md:block w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                remaining < 300 ? 'bg-rose-400' : 'bg-gradient-to-r from-indigo-500 to-violet-500'
              }`}
              style={{ width: `${(remaining / totalSeconds) * 100}%` }}
            />
          </div>
        </div>

        {/* Info Section */}
        <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-slate-200 pt-1 sm:pt-0 sm:pl-4">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Duration:</span>
            <span className="text-slate-600 font-bold">{formatTime(totalSeconds)}</span>
          </div>
          
          <div className="flex items-center gap-1.5 text-[9px] text-slate-300 font-black uppercase tracking-widest whitespace-nowrap">
            <div className={`w-1.5 h-1.5 rounded-full ${remaining > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            Secure Connection
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
