import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import HomeHeader from "../../components/HomeHeader";
// Footer is rendered globally in App.js
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { API } from "../../../utils/apiConfig";

// 🟢 helper function ดึง URL รูปภาพจาก Strapi
function getImageUrl(photo) {
  if (!photo) return null;
  // ใช้ documentId บังคับสำหรับการดึงรูปผ่าน custom endpoint
  if (photo.documentId) {
    return `${API.BASE_URL}/api/upload/files/${photo.documentId}/serve`;
  }
  // Fallback สำหรับข้อมูลเก่า
  if (typeof photo === "string") return photo;
  if (photo.url && !photo.url.startsWith("http")) {
    return `${API.BASE_URL}${photo.url}`;
  }
  return photo.url || null;
}

// 🟢 mapping วัน อังกฤษ -> ไทย
const dayMap = {
  monday: "จันทร์",
  tuesday: "อังคาร",
  wednesday: "พุธ",
  thursday: "พฤหัสบดี",
  friday: "ศุกร์",
  saturday: "เสาร์",
  sunday: "อาทิตย์",
};

// 🟢 mapping วัน ไทย -> ไทย (เก็บเป็นไทยใน DB)
const dayMapReverse = Object.fromEntries(
  Object.values(dayMap).map((th) => [th, th])
);

function EditPharmacist_admin() {
  const { id } = useParams(); // documentId ของ pharmacy profile
  const navigate = useNavigate();
  const location = useLocation();
  const jwt = localStorage.getItem("jwt");
  const userRole = localStorage.getItem("role");

  const [formData, setFormData] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageId, setImageId] = useState(null); // 🟢 เก็บ id ของรูปเก่า
  const [drugStores, setDrugStores] = useState([]); // เก็บรายการร้านยาทั้งหมด
  const [isOwnerEdit, setIsOwnerEdit] = useState(false); // เช็คว่าเป็นการแก้ไขโดยตัวเอง
  const [actualDocumentId, setActualDocumentId] = useState(null); // เก็บ documentId จริงสำหรับ update
  const [selectedDrugStore, setSelectedDrugStore] = useState(null);
  const [allProfiles, setAllProfiles] = useState([]); // เก็บ profile ทุกร้าน (กรณี pharmacy)
  const [workingTimesByStore, setWorkingTimesByStore] = useState({}); // เก็บ working_time แยกตาม store
  const [storeOpenClose, setStoreOpenClose] = useState([]); // เพิ่ม state สำหรับ store opening/closing time
  const [currentStoreName, setCurrentStoreName] = useState(""); // เพิ่ม state สำหรับชื่อร้านปัจจุบัน
  const [selectedDays, setSelectedDays] = useState([]); // เพิ่ม state สำหรับเลือกหลายวัน
  const [bulkTimeIn, setBulkTimeIn] = useState(""); // เพิ่ม state สำหรับเวลาเริ่ม bulk
  const [bulkTimeOut, setBulkTimeOut] = useState(""); // เพิ่ม state สำหรับเวลาสิ้นสุด bulk
  const [showWorkTimesModal, setShowWorkTimesModal] = useState(false); // เพิ่ม state สำหรับ modal แสดงเวลาทำงานทั้งหมด

  useEffect(() => {
    const load = async () => {
      try {
        let apiUrl = '';
        let isOwner = false;

        // เช็คว่าเป็นการแก้ไขโดยตัวเองหรือไม่ (เภสัชกรเข้าผ่าน ProfileAvatar)
        if (userRole === 'pharmacy' && location.state?.isSelfEdit) {
          // ดึงข้อมูลผู้ใช้ปัจจุบัน
          const userRes = await fetch(API.users.me(), {
            headers: { Authorization: `Bearer ${jwt}` }
          });
          if (!userRes.ok) throw new Error(`ไม่สามารถโหลดข้อมูลผู้ใช้ได้: ${userRes.status}`);
          const currentUser = await userRes.json();
          console.log('🔍 Current user from API.users.me():', currentUser);
          if (!currentUser?.id) throw new Error(`ไม่สามารถหา ID ผู้ใช้ - Response: ${JSON.stringify(currentUser)}`);
          // ดึง profile ของเภสัชกรนี้ "ทุกโปรไฟล์" (ทุก documentId)
          apiUrl = `${API.BASE_URL}/api/pharmacy-profiles?filters[users_permissions_user][id][$eq]=${currentUser.id}&populate=*`;
          isOwner = true;
        } else {
          // แก้ไขโดย admin หรือกรณีปกติ - ดึง profile เดียวก่อน
          apiUrl = `${API.BASE_URL}/api/pharmacy-profiles?filters[documentId][$eq]=${id}&populate=*`;
        }

        const res = await fetch(apiUrl, {
          headers: { Authorization: `Bearer ${jwt}` }
        });

        if (!res.ok) throw new Error("ไม่สามารถโหลดข้อมูลเภสัชกรได้");

        const data = await res.json();
        if (!data.data || data.data.length === 0) {
          toast.error("ไม่พบข้อมูลเภสัชกรที่ต้องการแก้ไข (404 Not Found)");
          setFormData(null);
          return;
        }

        // 🔧 ดึง storeId จาก referrer หรือ state ถ้ามี
        let targetStoreId = null;
        if (location.state?.fromStoreId) {
          targetStoreId = location.state.fromStoreId;
        } else {
          // ลองดึงจาก document.referrer
          const referrer = document.referrer;
          const pharmacistDetailMatch = referrer.match(/pharmacist_detail_admin\/([a-zA-Z0-9]+)/);
          if (pharmacistDetailMatch) {
            targetStoreId = pharmacistDetailMatch[1];
          }
        }
        console.log('🔍 Target store ID from context:', targetStoreId);

        // 🟢 สำหรับ admin: หลังจากได้ profile เดียวแล้ว ให้ดึง profile อื่นๆ ของ user เดียวกัน
        if (!isOwner && data.data.length > 0) {
          const firstProfile = data.data[0];
          const userId = firstProfile.users_permissions_user?.id;
          if (userId) {
            // ดึง profile ทั้งหมดของ user นี้
            const allProfilesRes = await fetch(
              `${API.BASE_URL}/api/pharmacy-profiles?filters[users_permissions_user][id][$eq]=${userId}&populate=*`,
              { headers: { Authorization: `Bearer ${jwt}` } }
            );
            if (allProfilesRes.ok) {
              const allProfilesData = await allProfilesRes.json();
              setAllProfiles(allProfilesData.data || []);
            }
          }
        } else {
          setAllProfiles(data.data);
        }

        // 🟢 กรณี pharmacy (isOwner) มีหลาย profile (หลายร้าน)
        if (isOwner && data.data.length > 0) {
          console.log('🟢 Owner Edit - data.data:', data.data);
          
          // สร้าง drugStores จากทุก profile ที่มี drug_stores
          const storesList = [];
          data.data.forEach(p => {
            if (Array.isArray(p.drug_stores) && p.drug_stores.length > 0) {
              // ดึงทุกร้านจาก drug_stores array
              p.drug_stores.forEach(store => {
                if (store) {
                  storesList.push({
                    id: store.documentId || store.id,
                    name: store.name_th || store.name || 'ไม่ระบุชื่อร้าน'
                  });
                }
              });
            }
          });

          console.log('🟢 Owner Edit - storesList:', storesList);
          setDrugStores(storesList);

          // สร้าง workingTimesByStore จากทุก profile ที่มี drug_stores
          const wtByStore = {};
          data.data.forEach(p => {
            if (Array.isArray(p.drug_stores) && p.drug_stores.length > 0) {
              // วนลูปทุกร้านใน drug_stores array
              p.drug_stores.forEach(store => {
                const storeDocId = store?.documentId || store?.id;
                if (!storeDocId) return;
                
                console.log(`🔍 Processing store: ${storeDocId}`);
                
                let workingTimes = [];
                if (Array.isArray(p.working_time) && p.working_time.length > 0) {
                  // กรองเฉพาะเวลาทำงานที่เป็นของร้านนี้
                  const storeWorkingTimes = p.working_time.filter(wt => {
                    console.log(`🔍 Checking working_time:`, wt, `store_id: ${wt.store_id} vs target: ${storeDocId}`);
                    return wt.store_id === storeDocId || (!wt.store_id && p.drug_stores.length === 1);
                  });
                  
                  console.log(`🔍 Filtered working times for store ${storeDocId}:`, storeWorkingTimes);
                  
                  // 🔧 แก้ไขการแปลงวัน - ไม่ต้องแปลงถ้าเป็นภาษาไทยอยู่แล้ว
                  workingTimes = storeWorkingTimes.map(wt => ({
                    day: wt.day, // ใช้วันตามที่มีใน DB โดยไม่แปลง
                    time_in: wt.time_in,
                    time_out: wt.time_out,
                  }));
                }
                if (workingTimes.length === 0) {
                  workingTimes = [{ day: "จันทร์", time_in: "", time_out: "" }];
                }
                wtByStore[storeDocId] = workingTimes;
              });
            }
          });
          
          console.log('🟢 Working times by store:', wtByStore);
          setWorkingTimesByStore(wtByStore);

          // default เลือกร้านแรก
          const firstProfile = data.data[0];
          const store = firstProfile.drug_stores?.[0];
          const defaultStoreId = store?.documentId || store?.id;
          setSelectedDrugStore(defaultStoreId);

          // ดึงข้อมูลรูปภาพ
          let previewUrl = null;
          let profileImgId = null;
          if (firstProfile.profileimage) {
            if (Array.isArray(firstProfile.profileimage)) {
              if (firstProfile.profileimage.length > 0) {
                const img = firstProfile.profileimage[0];
                previewUrl = getImageUrl(img);
                profileImgId = img.id;
              }
            } else if (firstProfile.profileimage.url) {
              previewUrl = getImageUrl(firstProfile.profileimage);
              profileImgId = firstProfile.profileimage.id;
            } else if (firstProfile.profileimage.data) {
              if (Array.isArray(firstProfile.profileimage.data) && firstProfile.profileimage.data.length > 0) {
                const img = firstProfile.profileimage.data[0];
                previewUrl = getImageUrl(img.attributes);
                profileImgId = img.id;
              } else if (firstProfile.profileimage.data.attributes) {
                previewUrl = getImageUrl(firstProfile.profileimage.data.attributes);
                profileImgId = firstProfile.profileimage.data.id;
              }
            }
          }

          setFormData({
            id: firstProfile.id,
            firstname: firstProfile.users_permissions_user?.full_name?.split(" ")[0] || "",
            lastname: firstProfile.users_permissions_user?.full_name?.split(" ").slice(1).join(" ") || "",
            license_number: firstProfile.license_number || "",
            phone: firstProfile.users_permissions_user?.phone || "",
            services: firstProfile.services || {
              sell_products: false,
              consulting: false,
              wholesale: false,
              delivery: false,
            },
            drug_store: defaultStoreId,
            user: firstProfile.users_permissions_user?.id || null,
            username: firstProfile.users_permissions_user?.username || "",
            password: "********",
            working_times: wtByStore[defaultStoreId] || [{ day: "จันทร์", time_in: "", time_out: "" }],
          });

          setImagePreview(previewUrl);
          setImageId(profileImgId);
          setIsOwnerEdit(isOwner);
          setActualDocumentId(firstProfile.documentId);
          return;
        }

        // ...กรณี admin หรือปกติ (profile เดียว)...
        const p = data.data[0];
        if (p) {
          console.log('🔵 Admin/Normal Edit - profile:', p);
          console.log('🔍 Target store ID:', targetStoreId);
          
          const fullName = p.users_permissions_user?.full_name || "";
          const [firstname, ...lastnameParts] = fullName.split(" ");
          const lastname = lastnameParts.join(" ");

          // 🟢 ดึงข้อมูลรูปภาพ - แก้ไขให้ตรงกับโครงสร้างจริง
          let previewUrl = null;
          let profileImgId = null;

          if (p.profileimage) {
            // กรณี profileimage เป็น array
            if (Array.isArray(p.profileimage)) {
              if (p.profileimage.length > 0) {
                const img = p.profileimage[0];
                previewUrl = getImageUrl(img);
                profileImgId = img.id;
              }
            }
            // กรณี profileimage เป็น object เดี่ยว
            else if (p.profileimage.url) {
              previewUrl = getImageUrl(p.profileimage);
              profileImgId = p.profileimage.id;
            }
            // กรณี profileimage มี data wrapper
            else if (p.profileimage.data) {
              if (Array.isArray(p.profileimage.data) && p.profileimage.data.length > 0) {
                const img = p.profileimage.data[0];
                previewUrl = getImageUrl(img.attributes);
                profileImgId = img.id;
              } else if (p.profileimage.data.attributes) {
                previewUrl = getImageUrl(p.profileimage.data.attributes);
                profileImgId = p.profileimage.data.id;
              }
            }
          }

          // ดึงข้อมูลร้านยาทั้งหมดที่เภสัชกรคนนี้ทำงาน (สำหรับกรณีแก้ไขตัวเอง)
          let storesList = [];
          if (isOwner) {
            console.log('🔵 isOwner true - allProfiles:', allProfiles);
            
            // สำหรับ pharmacy ที่มีเพียง profile เดียว แต่อาจจะมีร้านอื่นๆ ด้วย
            // ให้ดึงร้านจาก allProfiles ที่โหลดมาแล้ว
            if (allProfiles.length > 0) {
              storesList = allProfiles
                .map(profile => {
                  const store = profile.drug_stores?.[0];
                  return store
                    ? {
                        id: store.documentId || store.id,
                        name: store.name_th || store.name || 'ไม่ระบุชื่อร้าน'
                      }
                    : null;
                })
                .filter(Boolean);
            } else if (p.drug_stores && p.drug_stores.length > 0) {
              storesList = p.drug_stores.map(store => ({
                id: store.documentId || store.id,
                name: store.name_th || store.name || 'ไม่ระบุชื่อร้าน'
              }));
            }
          }

          console.log('🔵 Admin/Normal Edit - storesList:', storesList); // ย้าย console.log มาไว้ที่นี่

          // ถ้า pharmacy มีหลาย profile (หลายร้าน) ให้เลือก documentId แรกเป็น default
          let defaultDrugStore = null;
          if (userRole === 'pharmacy' && data.data.length > 1) {
            defaultDrugStore = data.data[0].drug_stores?.[0]?.documentId || data.data[0].drug_stores?.[0]?.id;
            setSelectedDrugStore(defaultDrugStore);
          }

          // ✅ ใช้ working_time ของ profile นี้เท่านั้น - กรองตาม store_id อย่างถูกต้อง
          let workingTimes = [];
          if (Array.isArray(p.working_time) && p.working_time.length > 0) {
            // 🔧 ใช้ targetStoreId ถ้ามี ไม่งั้นใช้ร้านแรก
            const currentStoreId = targetStoreId || p.drug_stores?.[0]?.documentId || p.drug_stores?.[0]?.id;
            console.log(`🔍 Current store ID: ${currentStoreId} (target: ${targetStoreId})`);
            console.log(`🔍 All working times:`, p.working_time);
            
            // กรองเฉพาะเวลาทำงานที่เป็นของร้านนี้
            const storeWorkingTimes = p.working_time.filter(wt => {
              console.log(`🔍 Checking wt.store_id: ${wt.store_id} vs currentStoreId: ${currentStoreId}`);
              return wt.store_id === currentStoreId || (!wt.store_id && p.drug_stores.length === 1);
            });
            
            console.log(`🔍 Filtered working times:`, storeWorkingTimes);
            
            // 🔧 แก้ไขการแปลงวัน - เพิ่มการตรวจสอบว่าข้อมูลเป็นภาษาไทยแล้วหรือยัง
            workingTimes = storeWorkingTimes.map(wt => {
              console.log(`🔍 Processing working time:`, wt);
              return {
                day: dayMap[wt.day] || wt.day, // แปลงจากอังกฤษเป็นไทยถ้าจำเป็น
                time_in: wt.time_in,
                time_out: wt.time_out,
              };
            });
          }
          
          // 🔧 เพิ่มการตรวจสอบว่าถ้าไม่มีเวลาทำงาน ให้ใส่ default ที่เหมาะสม
          if (workingTimes.length === 0) {
            workingTimes = []; // เปลี่ยนจาก default จันทร์ เป็น array ว่าง
          }

          console.log(`🔍 Final working times:`, workingTimes);

          setFormData({
            id: p.id,
            firstname: p.users_permissions_user?.full_name?.split(" ")[0] || "",
            lastname: p.users_permissions_user?.full_name?.split(" ").slice(1).join(" ") || "",
            license_number: p.license_number || "",
            phone: p.users_permissions_user?.phone || "",
            services: p.services || {
              sell_products: false,
              consulting: false,
              wholesale: false,
              delivery: false,
            },
            // 🔧 ใช้ targetStoreId ถ้ามี
            drug_store: targetStoreId || p.drug_stores?.[0]?.documentId || p.drug_stores?.[0]?.id || null,
            user: p.users_permissions_user?.id || null,
            username: p.users_permissions_user?.username || "",
            password: "********",
            working_times: workingTimes,
          });
          setImagePreview(previewUrl);
          setImageId(profileImgId);
          setDrugStores(storesList);
          setIsOwnerEdit(isOwner);
          setActualDocumentId(p.documentId); // เก็บ documentId จริง
        }
      } catch (err) {
        console.error("Load pharmacist error:", err);
        toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล: " + err.message);
      }
    };
    load();
  }, [id, jwt, location.state, userRole]);

  // เมื่อเลือก dropdown ร้านยา (เฉพาะ pharmacy ที่มีหลายร้าน)
  useEffect(() => {
    if (
      userRole === "pharmacy" &&
      drugStores.length > 1 &&
      selectedDrugStore &&
      workingTimesByStore[selectedDrugStore]
    ) {
      // อัพเดท formData ด้วย working_time ของร้านที่เลือก
      // หา profile ที่ตรงกับร้านที่เลือก
      const profile = allProfiles.find(
        (p) => {
          // ค้นหาร้านที่ตรงกันในอาร์เรย์ drug_stores
          return p.drug_stores?.some(store => 
            (store.documentId === selectedDrugStore || store.id === selectedDrugStore)
          );
        }
      );
      
      if (profile) {
        console.log(`🟢 Selected profile for store ${selectedDrugStore}:`, profile);
        
        // ดึงข้อมูลรูปภาพของ profile ที่เลือก
        let previewUrl = null;
        let profileImgId = null;
        if (profile.profileimage) {
          if (Array.isArray(profile.profileimage)) {
            if (profile.profileimage.length > 0) {
              const img = profile.profileimage[0];
              previewUrl = getImageUrl(img);
              profileImgId = img.id;
            }
          } else if (profile.profileimage.url) {
            previewUrl = getImageUrl(profile.profileimage);
            profileImgId = profile.profileimage.id;
          } else if (profile.profileimage.data) {
            if (Array.isArray(profile.profileimage.data) && profile.profileimage.data.length > 0) {
              const img = profile.profileimage.data[0];
              previewUrl = getImageUrl(img.attributes);
              profileImgId = img.id;
            } else if (profile.profileimage.data.attributes) {
              previewUrl = getImageUrl(profile.profileimage.data.attributes);
              profileImgId = profile.profileimage.data.id;
            }
          }
        }
        setImagePreview(previewUrl);
        setImageId(profileImgId);

        // ดึงเวลาทำงานเฉพาะของร้านที่เลือก
        let workingTimesForStore = [];
        if (workingTimesByStore[selectedDrugStore]) {
          workingTimesForStore = workingTimesByStore[selectedDrugStore];
        } else if (Array.isArray(profile.working_time)) {
          // กรองเฉพาะเวลาทำงานที่เป็นของร้านที่เลือก
          const storeWorkingTimes = profile.working_time.filter(wt => {
            console.log(`🔍 Filtering working_time: store_id=${wt.store_id} vs selected=${selectedDrugStore}`);
            return wt.store_id === selectedDrugStore || (!wt.store_id && profile.drug_stores.length === 1);
          });
          
          workingTimesForStore = storeWorkingTimes.map(wt => ({
            day: wt.day, // ใช้วันตามที่มีใน DB โดยไม่แปลง
            time_in: wt.time_in,
            time_out: wt.time_out,
          }));
        }

        console.log(`🟢 Working times for selected store:`, workingTimesForStore);

        setFormData((prev) => ({
          ...prev,
          id: profile.id,
          firstname: profile.users_permissions_user?.full_name?.split(" ")[0] || "",
          lastname: profile.users_permissions_user?.full_name?.split(" ").slice(1).join(" ") || "",
          license_number: profile.license_number || "",
          phone: profile.users_permissions_user?.phone || "",
          services: profile.services || {
            sell_products: false,
            consulting: false,
            wholesale: false,
            delivery: false,
          },
          drug_store: selectedDrugStore,
          user: profile.users_permissions_user?.id || null,
          username: profile.users_permissions_user?.username || "",
          password: "********",
          working_times: workingTimesForStore.length > 0 ? workingTimesForStore : [{ day: "จันทร์", time_in: "", time_out: "" }],
        }));

        setActualDocumentId(profile.documentId);
      }
    }
  }, [selectedDrugStore, allProfiles, userRole, workingTimesByStore, drugStores.length]);

  // ดึงเวลาทำการของร้าน (เฉพาะร้านที่เลือก)
  useEffect(() => {
    let storeId = null;
    if (userRole === "pharmacy" && selectedDrugStore) {
      storeId = selectedDrugStore;
    } else if (formData?.drug_store) {
      storeId = formData.drug_store;
    }
    if (storeId && jwt) {
      fetch(
        API.drugStores.getByDocumentId(storeId),
        { headers: { Authorization: `Bearer ${jwt}` } }
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.data && data.data.length > 0) {
            const store = data.data[0];
            let openCloseArr = [];
            if (Array.isArray(store.time_open) && Array.isArray(store.time_close)) {
              openCloseArr = store.time_open.map((open, idx) => ({
                day: [
                  "จันทร์",
                  "อังคาร",
                  "พุธ",
                  "พฤหัสบดี",
                  "ศุกร์",
                  "เสาร์",
                  "อาทิตย์",
                ][idx],
                open,
                close: store.time_close[idx],
              }));
            } else {
              openCloseArr = [
                "จันทร์",
                "อังคาร",
                "พุธ",
                "พฤหัสบดี",
                "ศุกร์",
                "เสาร์",
                "อาทิตย์",
              ].map((day) => ({
                day,
                open: store.time_open || "08:00",
                close: store.time_close || "20:00",
              }));
            }
            setStoreOpenClose(openCloseArr);
          }
        });
    }
    // eslint-disable-next-line
  }, [selectedDrugStore, formData?.drug_store, jwt]);

  // เพิ่ม useEffect สำหรับดึงชื่อร้านเพื่อแสดงใน Header
  useEffect(() => {
    const fetchStoreName = async () => {
      let storeId = null;
      
      if (userRole === "admin" && formData?.drug_store) {
        // สำหรับ admin ใช้ร้านจาก formData
        storeId = formData.drug_store;
      } else if (userRole === "pharmacy" && selectedDrugStore) {
        // สำหรับ pharmacy ใช้ร้านที่เลือก
        storeId = selectedDrugStore;
      } else if (userRole === "pharmacy" && drugStores.length === 1) {
        // สำหรับ pharmacy ที่มีร้านเดียว
        storeId = drugStores[0]?.id;
      } else if (formData?.drug_store) {
        // fallback ใช้จาก formData
        storeId = formData.drug_store;
      }

      console.log(`🔍 Fetching store name for storeId: ${storeId}`);

      if (storeId && jwt) {
        try {
          const response = await fetch(
            API.drugStores.getByDocumentId(storeId),
            { headers: { Authorization: `Bearer ${jwt}` } }
          );
          
          if (response.ok) {
            const data = await response.json();
            const store = data.data?.[0];
            if (store) {
              const storeName = store.name_th || store.attributes?.name_th || "";
              console.log(`🔍 Found store name: ${storeName}`);
              setCurrentStoreName(storeName);
            }
          }
        } catch (error) {
          console.error("ไม่สามารถดึงชื่อร้านได้:", error);
        }
      }
    };

    fetchStoreName();
  }, [formData?.drug_store, selectedDrugStore, drugStores, jwt, userRole]);

  if (formData === null) return <div className="p-6 text-red-600">ไม่พบข้อมูลเภสัชกรที่ต้องการแก้ไข</div>;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setFormData({
        ...formData,
        services: { ...formData.services, [name]: checked },
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("ไฟล์รูปภาพต้องมีขนาดไม่เกิน 5MB");
        return;
      }
      if (!file.type.startsWith("image/")) {
        toast.error("กรุณาเลือกไฟล์รูปภาพ");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async () => {
    if (!imageFile) return imageId; // ใช้ id เก่าถ้าไม่ได้เลือกใหม่
    
    const formDataUpload = new FormData();
    formDataUpload.append("files", imageFile);

    try {
      const res = await fetch(API.upload(), {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
        body: formDataUpload,
      });

      if (!res.ok) throw new Error("ไม่สามารถอัปโหลดรูปภาพได้");

      const uploadedFiles = await res.json();
      return uploadedFiles[0]?.id || null;
    } catch (err) {
      console.error("Upload error:", err);
      throw err;
    }
  };

  // 👉 จัดการ working_times
  const addWorkingTime = () => {
    const newWorkingTimes = [
      ...formData.working_times,
      { day: "จันทร์", time_in: "", time_out: "" },
    ];
    
    setFormData({
      ...formData,
      working_times: newWorkingTimes,
    });

    // อัพเดท workingTimesByStore ด้วย
    const currentStoreId = userRole === "pharmacy" && selectedDrugStore 
      ? selectedDrugStore 
      : formData.drug_store || (allProfiles[0]?.drug_stores?.[0]?.documentId);
    if (currentStoreId) {
      console.log(`🟢 Updating workingTimesByStore for store: ${currentStoreId}`);
      setWorkingTimesByStore(prev => ({
        ...prev,
        [currentStoreId]: newWorkingTimes
      }));
    }
  };

  // 👉 เพิ่มฟังก์ชันสำหรับเพิ่มเวลา bulk (หลายวันพร้อมกัน)
  const addBulkWorkingTime = () => {
    if (selectedDays.length === 0 || !bulkTimeIn || !bulkTimeOut) {
      toast.error("กรุณาเลือกวันและเวลาที่ต้องการเพิ่ม");
      return;
    }

    const newWorkingTimes = [...formData.working_times];
    selectedDays.forEach(day => {
      newWorkingTimes.push({
        day: day,
        time_in: bulkTimeIn,
        time_out: bulkTimeOut,
      });
    });

    setFormData({
      ...formData,
      working_times: newWorkingTimes,
    });

    // อัพเดท workingTimesByStore ด้วย
    const currentStoreId = userRole === "pharmacy" && selectedDrugStore 
      ? selectedDrugStore 
      : formData.drug_store || (allProfiles[0]?.drug_stores?.[0]?.documentId);
    if (currentStoreId) {
      console.log(`🟢 Updating workingTimesByStore for store: ${currentStoreId}`);
      setWorkingTimesByStore(prev => ({
        ...prev,
        [currentStoreId]: newWorkingTimes
      }));
    }

    // Reset bulk inputs
    setSelectedDays([]);
    setBulkTimeIn("");
    setBulkTimeOut("");
  };

  // 👉 จัดการ checkbox สำหรับเลือกวัน bulk
  const handleDaySelection = (day, checked) => {
    if (checked) {
      setSelectedDays(prev => [...prev, day]);
    } else {
      setSelectedDays(prev => prev.filter(d => d !== day));
    }
  };

  // 💡 รวบรวมเวลาทำงานทั้งหมดจาก allProfiles (ไม่แสดงชื่อร้าน) และจัดเรียง/ลบซ้ำ
  const getAggregatedWorkingTimes = () => {
    const times = [];
    if (!allProfiles || allProfiles.length === 0) return times;
    
    allProfiles.forEach(profile => {
      if (Array.isArray(profile.working_time) && profile.working_time.length > 0) {
        profile.working_time.forEach(wt => {
          times.push({
            day: wt.day,
            time_in: wt.time_in,
            time_out: wt.time_out,
          });
        });
      }
    });

    // dedupe - ลบเวลาที่ซ้ำกัน
    const keySet = new Set();
    const unique = [];
    times.forEach(t => {
      const key = `${t.day}:${t.time_in}:${t.time_out}`;
      if (!keySet.has(key)) {
        keySet.add(key);
        unique.push(t);
      }
    });

    // จัดเรียงตามวัน
    const dayOrder = ["จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์","อาทิตย์"];
    unique.sort((a,b) => {
      const aIdx = dayOrder.indexOf(a.day);
      const bIdx = dayOrder.indexOf(b.day);
      if (aIdx === bIdx) {
        return a.time_in.localeCompare(b.time_in);
      }
      return aIdx - bIdx;
    });

    return unique;
  };

  const handleWorkingTimeChange = (index, field, value) => {
    const updated = [...formData.working_times];
    updated[index][field] = value;
    
    // อัพเดททั้งใน formData และ workingTimesByStore
    setFormData({ ...formData, working_times: updated });
    
    const currentStoreId = userRole === "pharmacy" && selectedDrugStore 
      ? selectedDrugStore 
      : formData.drug_store || (allProfiles[0]?.drug_stores?.[0]?.documentId);
    if (currentStoreId) {
      console.log(`🟢 Updating workingTimesByStore for store: ${currentStoreId}`);
      setWorkingTimesByStore(prev => ({
        ...prev,
        [currentStoreId]: updated
      }));
    }
  };

  const removeWorkingTime = (index) => {
    const updated = [...formData.working_times];
    updated.splice(index, 1);
    
    setFormData({ ...formData, working_times: updated });

    // อัพเดท workingTimesByStore ด้วย
    const currentStoreId = userRole === "pharmacy" && selectedDrugStore 
      ? selectedDrugStore 
      : formData.drug_store || (allProfiles[0]?.drug_stores?.[0]?.documentId);
    if (currentStoreId) {
      console.log(`🟢 Updating workingTimesByStore for store: ${currentStoreId}`);
      setWorkingTimesByStore(prev => ({
        ...prev,
        [currentStoreId]: updated
      }));
    }
  };

  // � ฟังก์ชันตรวจสอบเวลาทำงานซ้ำ (ชนกัน) ในร้านเดียวกัน
  function hasOverlappingWorkingTimes(times) {
    function toMinutes(t) {
      if (!t) return 0;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    }
    const byDay = {};
    for (const t of times) {
      if (!t.time_in || !t.time_out) continue;
      if (!byDay[t.day]) byDay[t.day] = [];
      byDay[t.day].push([t.time_in, t.time_out]);
    }
    for (const day in byDay) {
      const slots = byDay[day]
        .map(([start, end]) => [toMinutes(start), toMinutes(end), start, end])
        .sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < slots.length; ++i) {
        if (slots[i][0] < slots[i - 1][1]) {
          return true;
        }
      }
    }
    return false;
  }

  // 🟢 ตรวจสอบเวลาทำงานซ้ำกับร้านอื่นๆ (ข้ามร้าน) ไม่ว่า admin หรือ owner edit
  function hasOverlapWithOtherStores(currentWorkingTimes) {
    if (!allProfiles || allProfiles.length <= 1) return false;
    const currentProfileId = formData?.id;
    const currentStoreId = formData?.drug_store;
    const otherProfiles = allProfiles.filter(
      p =>
        (p.drug_stores?.[0]?.documentId || p.drug_stores?.[0]?.id) !== currentStoreId &&
        p.id !== currentProfileId
    );
    let otherTimes = [];
    otherProfiles.forEach(p => {
      if (Array.isArray(p.working_time)) {
        // กรองเฉพาะเวลาทำงานของร้านอื่นๆ
        const otherStoreId = p.drug_stores?.[0]?.documentId || p.drug_stores?.[0]?.id;
        const storeWorkingTimes = p.working_time.filter(wt => 
          wt.store_id === otherStoreId || !wt.store_id
        );
        otherTimes = otherTimes.concat(
          storeWorkingTimes.map(wt => ({
            day: wt.day, // 🔧 ไม่ต้องแปลงวัน ใช้ตามที่มีใน DB
            time_in: wt.time_in,
            time_out: wt.time_out,
            store: p.drug_stores?.[0]?.name_th || p.drug_stores?.[0]?.name || "ร้านอื่น"
          }))
        );
      }
    });
    function toMinutes(t) {
      if (!t) return 0;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    }
    for (const cur of currentWorkingTimes) {
      if (!cur.time_in || !cur.time_out) continue;
      const curStart = toMinutes(cur.time_in);
      const curEnd = toMinutes(cur.time_out);
      for (const other of otherTimes) {
        if (cur.day !== other.day) continue;
        if (!other.time_in || !other.time_out) continue;
        const otherStart = toMinutes(other.time_in);
        const otherEnd = toMinutes(other.time_out);
        if (curStart < otherEnd && otherStart < curEnd) {
          return true;
        }
      }
    }
    return false;
  }

  // ฟังก์ชันตรวจสอบเวลาทำงานเภสัชกรเทียบกับเวลาร้าน
  function isWorkingTimeWithinStoreTime(workingTimes) {
    // workingTimes: [{ day, time_in, time_out }]
    // storeOpenClose: [{ day, open, close }]
    function toMinutes(t) {
      if (!t) return null;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    }
    for (const wt of workingTimes) {
      if (!wt.day || !wt.time_in || !wt.time_out) continue;
      const storeDay = storeOpenClose.find((s) => s.day === wt.day);
      if (!storeDay) continue;
      const open = toMinutes(storeDay.open);
      const close = toMinutes(storeDay.close);
      const minIn = open - 60; // เร็วสุดก่อนร้านเปิด 1 ชม.
      const maxOut = close + 60; // ช้าสุดหลังร้านปิด 1 ชม.
      const inTime = toMinutes(wt.time_in);
      const outTime = toMinutes(wt.time_out);
      if (inTime < minIn || outTime > maxOut) {
        return {
          valid: false,
          day: wt.day,
          storeOpen: storeDay.open,
          storeClose: storeDay.close,
          inTime: wt.time_in,
          outTime: wt.time_out,
        };
      }
    }
    return { valid: true };
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 🟢 ตรวจสอบเวลาทำงานซ้ำในร้านเดียวกัน
    if (hasOverlappingWorkingTimes(formData.working_times)) {
      toast.error("เวลาทำงานซ้ำกันในร้านเดียวกัน กรุณาตรวจสอบวันและเวลา");
      return;
    }
    // 🟢 ตรวจสอบเวลาทำงานซ้ำกับร้านอื่น (ข้ามร้าน) สำหรับทุกกรณี (admin/owner)
    if (hasOverlapWithOtherStores(formData.working_times)) {
      toast.error("เวลาทำงานซ้ำกับร้านอื่น กรุณาตรวจสอบวันและเวลา");
      return;
    }
    // 🟢 ตรวจสอบเวลาทำงานเภสัชกรต้องอยู่ในช่วงเวลาร้าน (อนุโลม +/- 1 ชม.)
    const storeTimeCheck = isWorkingTimeWithinStoreTime(formData.working_times);
    if (!storeTimeCheck.valid) {
      toast.error(
        `วัน${storeTimeCheck.day}: เวลาทำงานต้องอยู่ในช่วง ${storeTimeCheck.storeOpen} - ${storeTimeCheck.storeClose} (อนุโลมเข้าเร็วสุด 1 ชม.ก่อนเปิด, ออกช้าสุด 1 ชม.หลังปิด)`
      );
      return;
    }

    try {
      const newImageId = await uploadImage();

      // ✅ Update User
      const userPayload = {
        username: formData.username,
        full_name: `${formData.firstname} ${formData.lastname}`,
        phone: formData.phone,
      };
      if (formData.password && formData.password !== "********") {
        userPayload.password = formData.password;
      }

      await fetch(API.users.update(formData.user), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(userPayload),
      });

      // ✅ Update Pharmacy Profile เฉพาะ profile เดียว (ไม่รวม working_time ข้ามร้าน)
      const currentStoreId = userRole === "pharmacy" && selectedDrugStore 
        ? selectedDrugStore 
        : formData.drug_store;
      
      // รวมเวลาทำงานเดิมที่ไม่ใช่ของร้านปัจจุบัน + เวลาทำงานใหม่ของร้านปัจจุบัน
      let finalWorkingTime = [];
      
      if (isOwnerEdit && allProfiles.length > 1) {
        // กรณีเภสัชกรที่ทำงานหลายร้าน - ต้องรวมเวลาทำงานจากร้านอื่นด้วย
        const currentProfile = allProfiles.find(p => p.documentId === actualDocumentId);
        if (currentProfile && Array.isArray(currentProfile.working_time)) {
          // เก็บเวลาทำงานจากร้านอื่นๆ (ที่ไม่ใช่ร้านปัจจุบัน)
          const otherStoreWorkingTimes = currentProfile.working_time.filter(wt => 
            wt.store_id && wt.store_id !== currentStoreId
          );
          finalWorkingTime = [...otherStoreWorkingTimes];
          console.log(`🟢 Preserved working times from other stores:`, otherStoreWorkingTimes);
        }
      }
      
      // เพิ่มเวลาทำงานใหม่ของร้านปัจจุบัน
      const currentStoreWorkingTimes = formData.working_times.map((wt) => ({
        day: dayMapReverse[wt.day] || wt.day,
        time_in: wt.time_in,
        time_out: wt.time_out,
        store_id: currentStoreId, // เพิ่ม store_id เพื่อระบุว่าเวลาทำงานนี้เป็นของร้านไหน
      }));
      
      finalWorkingTime = [...finalWorkingTime, ...currentStoreWorkingTimes];
      console.log(`🟢 Final working times to save:`, finalWorkingTime);

      const payload = {
        data: {
          license_number: formData.license_number,
          services: formData.services,
          profileimage: newImageId ? newImageId : (imageId || null),
          working_time: finalWorkingTime,
        },
      };

      const res = await fetch(
        API.pharmacyProfiles.update(actualDocumentId),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "อัปเดตข้อมูลไม่สำเร็จ");
      }

      toast.success("✅ อัปเดตข้อมูลเภสัชกรเรียบร้อย!");

      setTimeout(() => {
        if (isOwnerEdit) {
          navigate('/pharmacyHome', { replace: true });
        } else {
          const role = localStorage.getItem('role');
          if (role === 'admin') {
            if (formData.drug_store) {
              navigate(`/pharmacist_detail_admin/${formData.drug_store}`, { replace: true });
            } else {
              navigate('/adminHome', { replace: true });
            }
          } else if (role === 'pharmacy') {
            navigate('/pharmacyHome', { replace: true });
          } else {
            navigate('/adminHome', { replace: true });
          }
        }
      }, 1500);
    } catch (err) {
      console.error("Update pharmacist error:", err);
      toast.error("เกิดข้อผิดพลาด: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <HomeHeader 
        pharmacyName={
          userRole === "admin" && currentStoreName 
            ? currentStoreName 
            : userRole === "pharmacy" && !isOwnerEdit && currentStoreName
            ? currentStoreName
            : undefined
        }
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-slate-100">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {isOwnerEdit ? "แก้ไขโปรไฟล์ของฉัน" : "แก้ไขข้อมูลเภสัชกร"}
            </h2>
            
            {/* 👉 ปุ่มให้แอดมิน ดูเวลาทำงานทั้งหมดเมื่อเภสัชกรทำงานหลายร้าน */}
            {userRole === "admin" && allProfiles.length > 1 && (
              <button
                type="button"
                onClick={() => setShowWorkTimesModal(true)}
                className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors font-medium text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ดูเวลาทำงานทั้งหมด
              </button>
            )}
          </div>

          {/* กรณี pharmacy มีหลายร้าน ให้เลือก dropdown */}
          {userRole === "pharmacy" && drugStores.length > 1 && (
            <div className="mb-8 p-5 bg-amber-50 border border-amber-200 rounded-xl">
              <label className="block font-semibold mb-2 text-amber-800 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                เลือกร้านยาที่ต้องการแก้ไขเวลาเข้างาน
              </label>
              <select
                className="w-full border border-amber-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                value={selectedDrugStore || ""}
                onChange={(e) => setSelectedDrugStore(e.target.value)}
              >
                <option value="" disabled>
                  -- เลือกร้านยา --
                </option>
                {drugStores.map((store, index) => (
                  <option key={store.id || index} value={store.id}>
                    {store.name.startsWith("ร้านยา") ? store.name : `ร้านยา${store.name}`}
                  </option>
                ))}
              </select>
              <div className="text-sm text-amber-700 mt-3 flex items-start gap-2">
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span><strong>สำคัญ:</strong> การแก้ไขเวลาทำงานจะมีผลเฉพาะร้านที่เลือกเท่านั้น และจะไม่กระทบกับเวลาทำงานในร้านอื่นๆ</span>
              </div>
            </div>
          )}

          {/* แสดงรายการร้านที่ทำงาน (สำหรับกรณีแก้ไขตัวเอง) */}
          {isOwnerEdit && drugStores.length > 0 && (
            <div className="mb-8 p-5 bg-indigo-50 rounded-xl border border-indigo-100">
              <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                ร้านยาที่คุณทำงาน ({drugStores.length} ร้าน)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {drugStores.map((store, index) => (
                  <div key={store.id || index} className="bg-white p-3.5 rounded-lg border border-indigo-100 shadow-sm flex items-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 bg-indigo-100 text-indigo-700 text-sm font-bold rounded-full mr-3 shrink-0">
                      {index + 1}
                    </span>
                    <span className="font-medium text-slate-700 truncate">
                      {store.name.startsWith('ร้านยา') ? store.name : `ร้านยา${store.name}`}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-sm text-indigo-600 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ข้อมูลที่คุณแก้ไขจะมีผลกับทุกร้านที่คุณทำงาน
              </div>
            </div>
          )}

          <form className="space-y-8" onSubmit={handleSubmit}>
            {/* Profile Image */}
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">รูปโปรไฟล์</h3>
              <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
                <div className="relative w-32 h-32 shrink-0">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Profile Preview"
                      className="w-full h-full object-cover rounded-2xl border-2 border-slate-200 shadow-sm"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-100 rounded-2xl flex items-center justify-center border-2 border-slate-200 border-dashed">
                      <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-center h-32">
                  <label className="inline-flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors shadow-sm font-medium">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    อัปโหลดรูปภาพใหม่
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-slate-500 mt-2">รองรับไฟล์ JPG, PNG ขนาดไม่เกิน 5MB</p>
                </div>
              </div>
            </div>

            {/* User Info */}
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">ข้อมูลส่วนตัว</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">ชื่อ <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    name="firstname"
                    value={formData.firstname}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">นามสกุล <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    name="lastname"
                    value={formData.lastname}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">เบอร์โทรศัพท์ <span className="text-rose-500">*</span></label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
                    required
                    pattern="[0-9]+"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">เลขที่ใบอนุญาต <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    name="license_number"
                    value={formData.license_number}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Account Info */}
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">ข้อมูลบัญชีผู้ใช้</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">ชื่อผู้ใช้งาน (Username) <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">รหัสผ่าน (Password) <span className="text-rose-500">*</span></label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Working Times */}
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">วันและเวลาเข้างาน</h3>
              
              {/* Bulk Add Section */}
              <div className="mb-6 p-5 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  เพิ่มเวลาเดียวกันสำหรับหลายวัน
                </h4>
                <div className="flex flex-wrap gap-2 mb-4">
                  {["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"].map(day => (
                    <label key={day} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${selectedDays.includes(day) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        checked={selectedDays.includes(day)}
                        onChange={(e) => handleDaySelection(day, e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium">{day}</span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="time"
                      value={bulkTimeIn}
                      onChange={(e) => setBulkTimeIn(e.target.value)}
                      className="border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none flex-1 sm:w-32"
                    />
                    <span className="text-slate-400 font-medium">ถึง</span>
                    <input
                      type="time"
                      value={bulkTimeOut}
                      onChange={(e) => setBulkTimeOut(e.target.value)}
                      className="border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none flex-1 sm:w-32"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addBulkWorkingTime}
                    className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
                  >
                    เพิ่มช่วงเวลา
                  </button>
                </div>
              </div>

              {/* Individual Working Times List */}
              {formData.working_times && formData.working_times.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-700 mb-2">ตารางเวลาทำงานปัจจุบัน</h4>
                  {formData.working_times.map((item, index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                      <select
                        value={item.day}
                        onChange={(e) =>
                          handleWorkingTimeChange(index, "day", e.target.value)
                        }
                        className="w-full sm:w-40 border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                      >
                        <option value="จันทร์">จันทร์</option>
                        <option value="อังคาร">อังคาร</option>
                        <option value="พุธ">พุธ</option>
                        <option value="พฤหัสบดี">พฤหัสบดี</option>
                        <option value="ศุกร์">ศุกร์</option>
                        <option value="เสาร์">เสาร์</option>
                        <option value="อาทิตย์">อาทิตย์</option>
                      </select>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                          type="time"
                          value={item.time_in || ""}
                          onChange={(e) =>
                            handleWorkingTimeChange(index, "time_in", e.target.value)
                          }
                          className="border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none flex-1 sm:w-32 bg-slate-50"
                        />
                        <span className="text-slate-400 font-medium">-</span>
                        <input
                          type="time"
                          value={item.time_out || ""}
                          onChange={(e) =>
                            handleWorkingTimeChange(index, "time_out", e.target.value)
                          }
                          className="border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none flex-1 sm:w-32 bg-slate-50"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeWorkingTime(index)}
                        className="w-full sm:w-auto mt-2 sm:mt-0 sm:ml-auto text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        ลบ
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50 border border-slate-200 border-dashed rounded-xl mb-4">
                  <svg className="w-12 h-12 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-slate-500 font-medium">ยังไม่มีเวลาทำงาน กรุณาเพิ่มเวลาทำงาน</p>
                </div>
              )}

              <button
                type="button"
                onClick={addWorkingTime}
                className="mt-4 inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors shadow-sm font-medium text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                เพิ่มวัน/เวลา แยก
              </button>
            </div>

            {/* Services */}
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">การให้บริการ</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5 bg-slate-50 border border-slate-200 rounded-xl">
                {[
                  { key: "sell_products", label: "จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ" },
                  { key: "consulting", label: "ให้คำปรึกษาทางเภสัชกรรม" },
                  { key: "wholesale", label: "ขายปลีกและขายส่ง" },
                  { key: "delivery", label: "บริการจัดส่งกล่องยาสามัญประจำบ้าน" },
                ].map((s) => (
                  <label key={s.key} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-indigo-300 transition-colors">
                    <input
                      type="checkbox"
                      name={s.key}
                      checked={formData.services[s.key]}
                      onChange={handleChange}
                      className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-slate-700 font-medium text-sm">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Submit & Actions */}
            <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="w-full sm:w-auto bg-white border border-slate-300 text-slate-700 px-6 py-2.5 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-sm order-2 sm:order-1"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors font-medium shadow-sm order-1 sm:order-2 flex justify-center items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                {isOwnerEdit ? "บันทึกการแก้ไขโปรไฟล์" : "บันทึกการแก้ไข"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 👉 Modal แสดงเวลาทำงานทั้งหมด */}
      {showWorkTimesModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowWorkTimesModal(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="เวลาทำงานทั้งหมดของเภสัชกร"
          >
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                เวลาทำงานทั้งหมด
              </h3>
              <button
                type="button"
                onClick={() => setShowWorkTimesModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-1.5 rounded-lg transition-colors"
                aria-label="ปิด"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5">
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {(() => {
                  const allWorkingTimes = getAggregatedWorkingTimes();
                  if (allWorkingTimes.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-slate-500 font-medium">ไม่มีข้อมูลเวลาทำงาน</p>
                      </div>
                    );
                  }
                  return allWorkingTimes.map((wt, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-700">{wt.day}</span>
                      <span className="text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm font-medium">
                        {wt.time_in} - {wt.time_out}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowWorkTimesModal(false)}
                className="bg-white border border-slate-300 text-slate-700 px-5 py-2 rounded-xl hover:bg-slate-100 transition-colors font-medium shadow-sm"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EditPharmacist_admin;


