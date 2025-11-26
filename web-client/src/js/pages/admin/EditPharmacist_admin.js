import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import HomeHeader from "../../components/HomeHeader";
import { toast, ToastContainer } from "react-toastify";
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

  // 🟢 ฟังก์ชันตรวจสอบเวลาทำงานซ้ำ (ชนกัน) ในร้านเดียวกัน
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
    <>
      <HomeHeader 
        pharmacyName={
          userRole === "admin" && currentStoreName 
            ? currentStoreName 
            : userRole === "pharmacy" && !isOwnerEdit && currentStoreName
            ? currentStoreName
            : undefined
        }
      />
      <div className="max-w-3xl mx-auto bg-white shadow-md rounded-lg p-6 mt-6">
        <h2 className="text-2xl font-bold text-green-700 mb-4">
          {isOwnerEdit ? "แก้ไขโปรไฟล์ของฉัน" : "แก้ไขข้อมูลเภสัชกร"}
        </h2>

        {/* กรณี pharmacy มีหลายร้าน ให้เลือก dropdown */}
        {userRole === "pharmacy" && drugStores.length > 1 && ( /* เปลี่ยนเงื่อนไข */
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <label className="block font-semibold mb-1 text-blue-700">
              เลือกร้านยาที่ต้องการแก้ไขเวลาเข้างาน
            </label>
            <select
              className="border rounded p-2 w-full"
              value={selectedDrugStore || ""}
              onChange={(e) => setSelectedDrugStore(e.target.value)}
            >
              <option value="" disabled>
                -- เลือกร้านยา --
              </option>
              {drugStores.map((store, index) => ( /* เปลี่ยนจาก allProfiles เป็น drugStores */
                <option key={store.id || index} value={store.id}>
                  {store.name.startsWith("ร้านยา") ? store.name : `ร้านยา${store.name}`}
                </option>
              ))}
            </select>
            <div className="text-sm text-blue-600 mt-2 p-2 bg-blue-50 rounded">
              ⚠️ <strong>สำคัญ:</strong> การแก้ไขเวลาทำงานจะมีผลเฉพาะร้านที่เลือกเท่านั้น 
              และจะไม่กระทบกับเวลาทำงานในร้านอื่นๆ
            </div>
          </div>
        )}

        {/* แสดงรายการร้านที่ทำงาน (สำหรับกรณีแก้ไขตัวเอง) */}
        {isOwnerEdit && drugStores.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-700 mb-3">
              ร้านยาที่คุณทำงาน ({drugStores.length} ร้าน)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {drugStores.map((store, index) => (
                <div key={store.id || index} className="bg-white p-3 rounded border shadow-sm">
                  <div className="flex items-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 text-xs font-medium rounded-full mr-2">
                      {index + 1}
                    </span>
                    <span className="font-medium text-gray-800">
                      {store.name.startsWith('ร้านยา') ? store.name : `ร้านยา${store.name}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-sm text-blue-600">
              💡 ข้อมูลที่คุณแก้ไขจะมีผลกับทุกร้านที่คุณทำงาน
            </div>
          </div>
        )}

        <form
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          onSubmit={handleSubmit}
        >
          {/* Profile Image */}
          <div className="md:col-span-2">
            <label className="block font-semibold mb-1">รูปโปรไฟล์</label>
            <div className="space-y-4">
              {imagePreview && (
                <div className="flex justify-center">
                  <img
                    src={imagePreview}
                    alt="Profile Preview"
                    className="w-32 h-32 object-cover rounded-full border-4 border-gray-300"
                  />
                </div>
              )}
              <div className="flex justify-center">
                <label className="bg-gray-200 px-4 py-2 rounded cursor-pointer hover:bg-gray-300">
                  เลือกรูปภาพ
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* User Info */}
          <div>
            <label className="block font-semibold mb-1">ชื่อ*</label>
            <input
              type="text"
              name="firstname"
              value={formData.firstname}
              onChange={handleChange}
              className="w-full border rounded p-2"
              required
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">นามสกุล*</label>
            <input
              type="text"
              name="lastname"
              value={formData.lastname}
              onChange={handleChange}
              className="w-full border rounded p-2"
              required
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">เบอร์โทรศัพท์*</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full border rounded p-2"
              required
              pattern="[0-9]+"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">USERNAME*</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full border rounded p-2"
              required
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">PASSWORD*</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full border rounded p-2"
              required
            />
          </div>

          {/* Pharmacy Profile */}
          <div className="md:col-span-2">
            <label className="block font-semibold mb-1">เลขที่ใบอนุญาต*</label>
            <input
              type="text"
              name="license_number"
              value={formData.license_number}
              onChange={handleChange}
              className="w-full border rounded p-2"
              required
            />
          </div>

          {/* Working Times */}
          <div className="md:col-span-2">
            <label className="block font-semibold mb-2">วันและเวลาเข้างาน*</label>
            {formData.working_times && formData.working_times.length > 0 ? (
              formData.working_times.map((item, index) => (
                <div key={index} className="flex gap-2 items-center mb-2">
                  <select
                    value={item.day}
                    onChange={(e) =>
                      handleWorkingTimeChange(index, "day", e.target.value)
                    }
                    className="border p-2 rounded"
                  >
                    {/* 🔧 ใช้วันภาษาไทยโดยตรง ไม่ใช้ dayMap */}
                    <option value="จันทร์">จันทร์</option>
                    <option value="อังคาร">อังคาร</option>
                    <option value="พุธ">พุธ</option>
                    <option value="พฤหัสบดี">พฤหัสบดี</option>
                    <option value="ศุกร์">ศุกร์</option>
                    <option value="เสาร์">เสาร์</option>
                    <option value="อาทิตย์">อาทิตย์</option>
                  </select>

                  <input
                    type="time"
                    value={item.time_in || ""}
                    onChange={(e) =>
                      handleWorkingTimeChange(index, "time_in", e.target.value)
                    }
                    className="border p-2 rounded"
                  />
                  <input
                    type="time"
                    value={item.time_out || ""}
                    onChange={(e) =>
                      handleWorkingTimeChange(index, "time_out", e.target.value)
                    }
                    className="border p-2 rounded"
                  />

                  <button
                    type="button"
                    onClick={() => removeWorkingTime(index)}
                    className="text-red-500 ml-2"
                  >
                    ลบ
                  </button>
                </div>
              ))
            ) : (
              <div className="text-gray-500 mb-2">
                ยังไม่มีเวลาทำงาน กรุณาเพิ่มเวลาทำงาน
              </div>
            )}

            <button
              type="button"
              onClick={addWorkingTime}
              className="mt-2 bg-gray-200 px-3 py-1 rounded"
            >
              + เพิ่มวัน/เวลา
            </button>
          </div>

          {/* Services */}
          <div className="md:col-span-2">
            <label className="block font-semibold mb-1">การให้บริการ*</label>
            <div className="space-y-2 p-4 bg-gray-100 rounded">
              {[
                { key: "sell_products", label: "จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ" },
                { key: "consulting", label: "ให้คำปรึกษาทางเภสัชกรรม" },
                { key: "wholesale", label: "ขายปลีกและขายส่ง" },
                { key: "delivery", label: "บริการจัดส่งกล่องยาสามัญประจำบ้าน" },
              ].map((s) => (
                <label key={s.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name={s.key}
                    checked={formData.services[s.key]}
                    onChange={handleChange}
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              {isOwnerEdit ? "บันทึกการแก้ไขโปรไฟล์" : "บันทึกการแก้ไข"}
            </button>
          </div>
        </form>
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button
            className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
            type="button"
            onClick={() => navigate(-1)}
          >
            กลับ
          </button>
        </div>
      </div>
      <ToastContainer />
    </>
  );
}

export default EditPharmacist_admin;


