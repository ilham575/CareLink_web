import React, { useRef, useState, useEffect } from "react";
// Footer is rendered globally in App.js
import HomeHeader from "../../components/HomeHeader";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
import { API, fetchWithAuth } from '../../../utils/apiConfig';

function EditProfileCustomer() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    username: "",
    email: "",
    congenital_disease: "",
  });
  const [mealTimes, setMealTimes] = useState({
    morning: '08:00',
    lunch:   '12:00',
    evening: '18:00',
    bedtime: '21:00',
  });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState(null);
  const [customerDocId, setCustomerDocId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = localStorage.getItem('jwt');
        if (!token) {
          navigate('/login');
          return;
        }

        // 1. Get current user (me)
        const userRes = await fetch(API.users.me(), {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!userRes.ok) throw new Error('ไม่สามารถโหลดข้อมูลผู้ใช้ได้');
        const user = await userRes.json();
        setUserId(user.id);

        // Parse full_name
        const nameParts = (user.full_name || "").trim().split(" ");
        const fName = nameParts[0] || "";
        const lName = nameParts.slice(1).join(" ") || "";

        // 2. Get customer profile tied to this user
        const profileRes = await fetch(
          API.customerProfiles.list(`filters[users_permissions_user][id][$eq]=${user.id}`),
          { headers: { Authorization: `Bearer ${token}` } }
        );

        let cDocId = null;
        let congenital = "";
        let mealTimesData = { morning: '08:00', lunch: '12:00', evening: '18:00', bedtime: '21:00' };

        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData.data && profileData.data.length > 0) {
            const profile = profileData.data[0];
            cDocId = profile.documentId || profile.id;
            congenital = profile.attributes?.congenital_disease || profile.congenital_disease || "";
            // Load meal times
            mealTimesData = {
              morning: profile.attributes?.morning_meal_time || profile.morning_meal_time || '08:00',
              lunch:   profile.attributes?.lunch_meal_time   || profile.lunch_meal_time   || '12:00',
              evening: profile.attributes?.evening_meal_time || profile.evening_meal_time || '18:00',
              bedtime: profile.attributes?.bedtime_time      || profile.bedtime_time      || '21:00',
            };
            setCustomerDocId(cDocId);
          }
        }

        setMealTimes(mealTimesData);

        setForm({
          firstName: fName,
          lastName: lName,
          phone: user.phone || "",
          username: user.username || "",
          email: user.email || "",
          congenital_disease: congenital,
        });

      } catch (err) {
        console.error('Error loading profile:', err);
        toast.error('โหลดข้อมูลล้มเหลว');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const token = localStorage.getItem('jwt');
      const fullName = `${form.firstName} ${form.lastName}`.trim();

      // 1. Update User Record
      const userUpdateRes = await fetch(`${API.BASE_URL}/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: fullName,
          phone: form.phone,
          email: form.email,
        }),
      });

      // 2. Update Customer Profile Record
      if (customerDocId) {
        await fetchWithAuth(API.customerProfiles.update(customerDocId), {
          method: 'PUT',
          body: JSON.stringify({
            data: {
              congenital_disease: form.congenital_disease,
              morning_meal_time: mealTimes.morning,
              lunch_meal_time:   mealTimes.lunch,
              evening_meal_time: mealTimes.evening,
              bedtime_time:      mealTimes.bedtime,
            }
          }),
        });
      }

      toast.success('บันทึกข้อมูลสำเร็จ');
      setTimeout(() => navigate(-1), 1000);
      
    } catch (err) {
      console.error('Save error:', err);
      toast.error('บันทึกไม่สำเร็จ: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 font-prompt">
        <HomeHeader />
        <div className="flex items-center justify-center py-20">
           <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-prompt text-slate-900 pb-20">
      <HomeHeader />
      
      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all shadow-sm"
          >
            ←
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">แก้ไขข้อมูลส่วนตัว</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-0.5">Profile Settings</p>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div className="bg-slate-900 p-8 text-white">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500 flex items-center justify-center text-3xl font-black shadow-lg">
                {form.firstName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl font-bold">{form.firstName} {form.lastName}</h3>
                <p className="text-slate-400 text-sm">@{form.username}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อ</label>
                <input
                  type="text"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleInputChange}
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-bold"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">นามสกุล</label>
                <input
                  type="text"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleInputChange}
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-bold"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">เบอร์โทรศัพท์</label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleInputChange}
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-bold"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">อีเมล</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleInputChange}
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-bold"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <span>🧬</span> โรคประจำตัว
              </label>
              <textarea
                name="congenital_disease"
                value={form.congenital_disease}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-bold resize-none"
                placeholder="ระบุโรคประจำตัว (ถ้ามี)"
              />
            </div>

            {/* Meal Times Section */}
            <div className="bg-amber-50 border-2 border-amber-100 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🍽️</span>
                  <div>
                    <h4 className="text-sm font-black text-amber-900">เวลาอาหารเฉลี่ย</h4>
                    <p className="text-[11px] text-amber-600 font-bold">ใช้สำหรับคำนวณเวลาแจ้งเตือนทานยา</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: 'morning', label: 'เช้า',     icon: '🌅' },
                  { key: 'lunch',   label: 'เที่ยง',   icon: '☀️' },
                  { key: 'evening', label: 'เย็น',     icon: '🌆' },
                  { key: 'bedtime', label: 'ก่อนนอน', icon: '🌙' },
                ].map(slot => (
                  <div key={slot.key} className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1">
                      <span>{slot.icon}</span>{slot.label}
                    </label>
                    <input
                      type="time"
                      value={mealTimes[slot.key]}
                      onChange={e => setMealTimes(prev => ({ ...prev, [slot.key]: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none transition-all font-bold text-sm"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-[10px]">
                <div className="flex items-start gap-1.5 bg-white px-2 py-1.5 rounded-lg border border-rose-100">
                  <span>💊➡️🍽️</span> <span className="text-rose-700 font-bold">ก่อน: 30 นาทีก่อนถึงเวลา</span>
                </div>
                <div className="flex items-start gap-1.5 bg-white px-2 py-1.5 rounded-lg border border-emerald-100">
                  <span>🍽️➡️💊</span> <span className="text-emerald-700 font-bold">หลัง: 30 นาทีหลังเวลา</span>
                </div>
                <div className="flex items-start gap-1.5 bg-white px-2 py-1.5 rounded-lg border border-sky-100">
                  <span>🍽️💊</span> <span className="text-sky-700 font-bold">พร้อม: แจ้งเตือนตรงเวลา</span>
                </div>
              </div>
            </div>

            {customerDocId && (
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">
                    ✈️
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-indigo-900">การแจ้งเตือน Telegram</h4>
                    <p className="text-[11px] text-indigo-600 font-bold">รับแจ้งเตือนทานยาผ่านแอป Telegram</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const botUsername = process.env.REACT_APP_TELEGRAM_BOT_NAME || 'carelink2_bot';
                    window.open(`https://t.me/${botUsername}?start=${customerDocId}`, '_blank');
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                >
                  เชื่อมต่อ
                </button>
              </div>
            )}

            <div className="pt-6 border-t border-slate-50 flex flex-col md:flex-row gap-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 py-4 bg-slate-50 text-slate-500 font-bold rounded-2xl hover:bg-slate-100 transition-all border border-slate-100"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className={`flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center gap-2 ${isSaving ? 'opacity-50' : ''}`}
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <span>บันทึกการเปลี่ยนแปลง</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default EditProfileCustomer;
