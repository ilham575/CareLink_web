import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API } from '../utils/apiConfig';
import { toast } from 'react-toastify';

const useNotificationListener = (userId) => {
  useEffect(() => {
    if (!userId) return;

    // Use API.BASE_URL which defaults to http://localhost:1337 or REACT_APP_API_URL
    const socket = io(API.BASE_URL);

    // Join user-specific room
    // Assumes server listens to 'join' event to subscribe socket to a room
    socket.emit('join', `user_${userId}`);

    socket.on('notification', (data) => {
      console.log('Received notification:', data);
      
      // Display Toast
      toast.info(`${data.title}: ${data.message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      // Optional: Browser Notification
      if (Notification.permission === 'granted') {
         new Notification(data.title, { body: data.message });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(data.title, { body: data.message });
          }
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [userId]);
};

export default useNotificationListener;
