import React from "react";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from "react-router-dom";
import { API } from '../../utils/apiConfig';

function ProfileAvatar({ profileUrl, profileFullName, userData }) {
  const navigate = useNavigate();

  const handleProfileClick = async () => {
    const role = localStorage.getItem('role');
    const userId = userData?.id;

    if (role === 'admin') {
      if (userId) {
        navigate('/signup', {
          state: { userId }
        });
      }
    } else if (role === 'pharmacy') {
      if (userId) {
        try {
          const jwt = localStorage.getItem('jwt');
          const res = await fetch(
            API.pharmacyProfiles.listFiltered({ users_permissions_user: { id: { $eq: userId } } }),
            { headers: { Authorization: `Bearer ${jwt}` } }
          );
          const data = await res.json();
          const profile = data.data?.[0];
          if (profile?.documentId) {
            navigate(`/edit_pharmacist_admin/${profile.documentId}`, {
              state: { isSelfEdit: true }
            });
            } else {
              toast.error("ไม่พบข้อมูลโปรไฟล์เภสัชกร");
            }
        } catch (err) {
          toast.error("เกิดข้อผิดพลาดในการดึงข้อมูลเภสัชกร");
        }
      }
    } else if (role === 'staff') {
      navigate('/edit_staff_profile');
    }
  };

  return (
    <div
      className="w-10 h-10 sm:w-[50px] sm:h-[50px] rounded-full bg-[#e0e0e0] flex items-center justify-center font-bold text-sm sm:text-[18px] text-[#555] overflow-hidden sm:mr-4 shadow-sm hover:ring-2 hover:ring-white/50 transition-all"
      title={profileFullName || "โปรไฟล์"}
      onClick={handleProfileClick}
      style={{ cursor: 'pointer' }}
    >
      {profileUrl ? (
        <img
          src={profileUrl}
          alt="profile"
          className="w-full h-full object-cover rounded-full"
        />
      ) : (
        <span>
          {localStorage.getItem('profileInitial') ||
            (localStorage.getItem('username') &&
              localStorage.getItem('username')[0].toUpperCase()) ||
            'U'}
        </span>
      )}
    </div>
  );
}

export default ProfileAvatar;