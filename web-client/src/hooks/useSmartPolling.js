import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Smart Polling Hook - Intelligent polling with exponential backoff, ETag caching, and change detection
 * 
 * Features:
 * - Exponential backoff: ช้าลงเมื่อไม่มีข้อมูลใหม่
 * - ETag caching: ไม่โหลด data เต็มถ้าไม่เปลี่ยน
 * - Change detection: เรียก onDataChange เมื่อมีการเปลี่ยน
 * - Auto stop: หยุดเองเมื่อ tab ไม่ active
 * - Cleanup: ลบ interval เมื่อ unmount
 * 
 * @param {string} url - API endpoint
 * @param {object} options - Configuration
 * @param {number} options.initialInterval - เริ่มต้น poll ทุกกี่ ms (default 2000)
 * @param {number} options.maxInterval - สูงสุด poll ทุกกี่ ms (default 30000)
 * @param {number} options.backoffMultiplier - คูณด้วยเท่าไร (default 1.5)
 * @param {function} options.onDataChange - เรียกเมื่อข้อมูลเปลี่ยน(newData, oldData)
 * @param {function} options.onError - เรียกเมื่อเกิดข้อผิดพลาด(error)
 * @param {boolean} options.enabled - เปิด/ปิด polling (default true)
 * @returns {object} - { isPolling, currentData, lastChecked, resetInterval }
 */
export const useSmartPolling = (url, options = {}) => {
  const {
    initialInterval = 2000,
    maxInterval = 30000,
    backoffMultiplier = 1.5,
    onDataChange = null,
    onError = null,
    enabled = true
  } = options;

  const [isPolling, setIsPolling] = useState(false);
  const [currentData, setCurrentData] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  
  const intervalRef = useRef(null);
  const currentIntervalRef = useRef(initialInterval);
  const etagRef = useRef(null);
  const previousDataRef = useRef(null);
  const isTabActiveRef = useRef(!document.hidden);

  // ตรวจจับเมื่อ tab ไม่ active
  const handleVisibilityChange = useCallback(() => {
    isTabActiveRef.current = !document.hidden;
    if (!document.hidden && enabled) {
      // Tab กลับมา active ให้ reset interval เพื่อ poll ทันที
      currentIntervalRef.current = initialInterval;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        // Poll ทันทีและตั้ง interval ใหม่
        performPoll();
      }
    }
  }, [enabled, initialInterval]);

  // ฟังก์ชันหลัก: poll ข้อมูล
  const performPoll = useCallback(async () => {
    if (!enabled || !isTabActiveRef.current) return;

    try {
      const token = localStorage.getItem('jwt');
      const headers = {
        Authorization: token ? `Bearer ${token}` : ''
      };

      // ถ้ามี ETag ให้ส่ง If-None-Match เพื่อลด bandwidth
      if (etagRef.current) {
        headers['If-None-Match'] = etagRef.current;
      }

      const response = await fetch(url, { headers });

      // 304 Not Modified - ข้อมูลไม่เปลี่ยน ให้ reset interval เพื่อ poll ช้าลง
      if (response.status === 304) {
        setLastChecked(new Date());
        // Increase interval (exponential backoff)
        currentIntervalRef.current = Math.min(
          currentIntervalRef.current * backoffMultiplier,
          maxInterval
        );
        return;
      }

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      // ได้ข้อมูลใหม่
      const newData = await response.json();
      
      // บันทึก ETag สำหรับครั้งต่อไป
      const etag = response.headers.get('ETag');
      if (etag) {
        etagRef.current = etag;
      }

      setLastChecked(new Date());

      // ตรวจจับการเปลี่ยนแปลง
      const dataChanged = JSON.stringify(previousDataRef.current) !== JSON.stringify(newData);

      if (dataChanged) {
        previousDataRef.current = newData;
        setCurrentData(newData);
        
        if (onDataChange) {
          onDataChange(newData, previousDataRef.current);
        }

        // Reset interval เมื่อมีข้อมูลใหม่
        currentIntervalRef.current = initialInterval;
      } else {
        // ไม่มีการเปลี่ยน ให้ poll ช้าลง (exponential backoff)
        currentIntervalRef.current = Math.min(
          currentIntervalRef.current * backoffMultiplier,
          maxInterval
        );
      }
    } catch (error) {
      console.error('Smart polling error:', error);
      if (onError) {
        onError(error);
      }
      // เกิดข้อผิดพลาด ให้ poll ช้าลงเพื่อไม่ให้เพียง API
      currentIntervalRef.current = Math.min(
        currentIntervalRef.current * backoffMultiplier,
        maxInterval
      );
    }
  }, [url, enabled, initialInterval, maxInterval, backoffMultiplier, onDataChange, onError]);

  // Cleanup: ลบ interval เมื่อ unmount
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPolling(false);
      return;
    }

    // ตั้ง interval
    setIsPolling(true);
    performPoll(); // Poll ทันทีเมื่อ mount

    intervalRef.current = setInterval(performPoll, currentIntervalRef.current);

    // ปรับ interval เมื่อ currentIntervalRef เปลี่ยน
    const intervalCheckTimer = setInterval(() => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(performPoll, currentIntervalRef.current);
      }
    }, 500); // ตรวจจักทุก 500ms

    // Listener สำหรับ visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      clearInterval(intervalCheckTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      setIsPolling(false);
    };
  }, [enabled, performPoll, handleVisibilityChange]);

  // ฟังก์ชันสำหรับ reset interval (ใช้เมื่อต้องการบังคับ poll ทันที)
  const resetInterval = useCallback(() => {
    currentIntervalRef.current = initialInterval;
    performPoll();
  }, [initialInterval, performPoll]);

  return {
    isPolling,
    currentData,
    lastChecked,
    resetInterval,
    currentInterval: currentIntervalRef.current
  };
};

export default useSmartPolling;
