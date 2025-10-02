import { useLocation, useNavigate, useParams } from "react-router-dom";
import Footer from "../footer";
import HomeHeader from "../HomeHeader";
import "../../../css/pages/default/customerPage.css";
import "../../../css/component/CustomerCard.css";
import "../../../css/component/ModernCustomerCard.css";
import React, { useEffect, useState } from "react";
import { Modal } from "antd";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import dayjs from "dayjs"; // เพิ่มบรรทัดนี้

// เพิ่มฟังก์ชันแปลงวันที่เป็นภาษาไทย
function formatThaiDate(dateStr) {
  if (!dateStr) return '';
  const months = [
    '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const d = dayjs(dateStr);
  if (!d.isValid()) return dateStr;
  const day = d.date();
  const month = months[d.month() + 1];
  const year = d.year() + 543;
  return `${day} ${month} ${year}`;
}

function CustomerPage({ id }) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [pharmacy, setPharmacy] = useState(null);
  const [customerList, setCustomerList] = useState([]);
  
  // ใช้ documentId จาก params หรือ props แทน id
  const documentId = params.documentId || id || params.id;

  useEffect(() => {
    if (documentId) {
      // แก้ไขการดึงข้อมูลร้านยา - ใช้ token และเพิ่ม error handling
      const token = localStorage.getItem('jwt');
      fetch(`http://localhost:1337/api/drug-stores?filters[documentId][$eq]=${documentId}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      })
        .then(res => res.json())
        .then(json => {
          const store = Array.isArray(json.data)
            ? json.data.find(item => item.documentId === documentId)
            : null;

          setPharmacy(store || null);
        })
        .catch(error => {
          console.error('Error fetching drug store:', error);
          setPharmacy(null);
        });
    }
  }, [documentId]);

  useEffect(() => {
    if (documentId) {
      const token = localStorage.getItem('jwt');
      // แก้ไขการใช้ filters ให้ถูกต้อง - ใช้ internal ID แทน documentId
      (async () => {
        try {
          // หา internal ID ของร้าน
          const drugStoreRes = await fetch(
            `http://localhost:1337/api/drug-stores?filters[documentId][$eq]=${documentId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const drugStoreJson = await drugStoreRes.json();
          const targetStore = drugStoreJson.data?.find(store => store.documentId === documentId);
          
          if (!targetStore) {
            setCustomerList([]);
            return;
          }
          
          const drugStoreInternalId = targetStore.id;
          
          // ใช้ field name ที่ถูกต้องจาก schema: drug_stores (many-to-many)
          try {
            const customerRes = await fetch(
              `http://localhost:1337/api/customer-profiles?filters[drug_stores][id][$eq]=${drugStoreInternalId}&populate[0]=users_permissions_user&populate[1]=drug_stores`,
              {
                headers: {
                  Authorization: token ? `Bearer ${token}` : "",
                },
              }
            );
            const customerJson = await customerRes.json();
            
            if (customerJson.error) {
              throw new Error(customerJson.error.message);
            }
            
            setCustomerList(Array.isArray(customerJson.data) ? customerJson.data : []);
          } catch (error) {
            console.error('Error with drug_stores field:', error.message);
            
            // Fallback: ดึงข้อมูลทั้งหมดแล้วกรองฝั่ง client
            try {
              console.log('Fallback: fetching all customers and filtering manually');
              const customerRes = await fetch(
                `http://localhost:1337/api/customer-profiles?populate[0]=users_permissions_user&populate[1]=drug_stores`,
                {
                  headers: {
                    Authorization: token ? `Bearer ${token}` : "",
                  },
                }
              );
              const customerJson = await customerRes.json();
              
              // กรองข้อมูลในฝั่ง client
              let filteredCustomers = [];
              if (Array.isArray(customerJson.data)) {
                filteredCustomers = customerJson.data.filter(customer => {
                  const stores = customer.drug_stores?.data || customer.attributes?.drug_stores?.data || [];
                  return stores.some(store => store.id == drugStoreInternalId);
                });
              }
              
              console.log('Filtered customers:', filteredCustomers);
              setCustomerList(filteredCustomers);
            } catch (fallbackError) {
              console.error('Fallback also failed:', fallbackError);
              setCustomerList([]);
            }
          }
        } catch (error) {
          console.error('Error fetching customers:', error);
          setCustomerList([]);
        }
      })();
    }
  }, [documentId]);

  useEffect(() => {
    if (location.state?.toastMessage) {
      toast.success(location.state.toastMessage);
    }
  }, [location.state]);

  const deleteCustomer = (customerId, customerDocumentId, userId, customerName) => {
    Modal.confirm({
      title: `ลบลูกค้า "${customerName}"?`,
      content: "ลบข้อมูลลูกค้าและบัญชีผู้ใช้ที่เกี่ยวข้อง (ย้อนกลับไม่ได้)",
      okText: "ลบ",
      okType: "danger",
      cancelText: "ยกเลิก",
      onOk: () =>
        new Promise(async (resolve, reject) => {
          const token = localStorage.getItem("jwt");
          const authHeaders = {
            Authorization: token ? `Bearer ${token}` : "",
            "Cache-Control": "no-store",
          };

          const removeRelation = async () => {
            if (!customerId) return;
            const res = await fetch(
              `http://localhost:1337/api/customer-profiles/${customerDocumentId}`,
              {
                method: "PUT",
                headers: {
                  ...authHeaders,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  data: {
                    users_permissions_user: null,
                  },
                }),
              }
            );
            if (!res.ok) {
              throw new Error("ตัดความสัมพันธ์กับ user ไม่สำเร็จ");
            }
          };

          const deleteCustomerProfile = async () => {
            if (!customerId) return;
            const res = await fetch(
              `http://localhost:1337/api/customer-profiles/${customerDocumentId}`,
              { method: "DELETE", headers: authHeaders }
            );
            if (!res.ok && res.status !== 404) {
              throw new Error("ลบข้อมูลลูกค้าไม่สำเร็จ");
            }
          };

          const deleteUser = async () => {
            if (!userId) return;
            const checkRes = await fetch(
              `http://localhost:1337/api/customer-profiles?filters[users_permissions_user][id][$eq]=${userId}`,
              { headers: authHeaders }
            );
            const checkJson = await checkRes.json().catch(() => ({}));
            const relatedProfiles = Array.isArray(checkJson?.data) ? checkJson.data : [];
            
            const otherProfiles = relatedProfiles.filter(
              profile => profile.id !== customerId
            );
            if (otherProfiles.length > 0) return;

            try {
              const res = await fetch(
                `http://localhost:1337/api/users/${userId}`,
                { method: "DELETE", headers: authHeaders }
              );
              await res.text().catch(() => "");
            } catch (e) {}
          };

          const refreshList = async () => {
            if (!documentId) return;
            try {
              // หา internal ID ของร้าน
              const drugStoreRes = await fetch(
                `http://localhost:1337/api/drug-stores?filters[documentId][$eq]=${documentId}`,
                { headers: authHeaders }
              );
              const drugStoreJson = await drugStoreRes.json();
              const targetStore = drugStoreJson.data?.find(store => store.documentId === documentId);
              
              if (!targetStore) {
                setCustomerList([]);
                return;
              }
              
              const drugStoreInternalId = targetStore.id;
              
              // ใช้ field name ที่ถูกต้องจาก schema: drug_stores
              try {
                const res = await fetch(
                  `http://localhost:1337/api/customer-profiles?filters[drug_stores][id][$eq]=${drugStoreInternalId}&populate[0]=users_permissions_user&populate[1]=drug_stores&_=${Date.now()}`,
                  { headers: authHeaders }
                );
                const js = await res.json();
                
                if (js.error) {
                  throw new Error(js.error.message);
                }
                
                setCustomerList(Array.isArray(js.data) ? js.data : []);
              } catch (error) {
                console.error('Error with refresh, trying fallback:', error.message);
                
                // Fallback: ดึงข้อมูลทั้งหมดแล้วกรองฝั่ง client
                const res = await fetch(
                  `http://localhost:1337/api/customer-profiles?populate[0]=users_permissions_user&populate[1]=drug_stores&_=${Date.now()}`,
                  { headers: authHeaders }
                );
                const js = await res.json();
                
                // กรองข้อมูลในฝั่ง client
                let newList = [];
                if (Array.isArray(js?.data)) {
                  newList = js.data.filter(customer => {
                    const stores = customer.drug_stores?.data || customer.attributes?.drug_stores?.data || [];
                    return stores.some(store => store.id == drugStoreInternalId);
                  });
                }
                
                setCustomerList(newList);
              }
            } catch (error) {
              console.error('Error refreshing customer list:', error);
              setCustomerList([]);
            }
          };

          try {
            await removeRelation();
            await deleteCustomerProfile();
            await deleteUser();
            await refreshList();

            Modal.success({ content: "ลบลูกค้าและบัญชีผู้ใช้สำเร็จ" });
            resolve();
          } catch (err) {
            console.error(err);
            Modal.error({ content: err?.message || "เกิดข้อผิดพลาดในการลบลูกค้า" });
            reject(err);
          }
        }),
    });
  };

  // console.log(pharmacy);
  // console.log('Current pharmacy state:', pharmacy);
  // console.log('Current documentId:', documentId);

  return (
    <div className="customerpage-bg">
      <ToastContainer />
      <HomeHeader pharmacyName={pharmacy?.name_th || pharmacy?.name_en || ''} />
      <main className="customerpage-main">
        <div className="customerpage-container">
          <div className="customerpage-header-row">
            <h2 className="customerpage-title">ลูกค้าประจำร้านยา:</h2>
            <button
              className="customerpage-add-btn"
              onClick={() => navigate(`/form_customer?pharmacyId=${documentId}`)}
            >
              เพิ่มลูกค้า
            </button>
          </div>
          {/* แสดงรายการลูกค้า */}
          {customerList.length === 0 ? (
            <div className="no-customers-message">
              ไม่พบข้อมูลลูกค้าในร้านยานี้
            </div>
          ) : (
            customerList.map(customer => {
              const user = customer.users_permissions_user?.data?.attributes || customer.users_permissions_user || customer.attributes?.users_permissions_user;
              const customerDocumentId = customer.documentId || customer.attributes?.documentId;
              const userId = 
                customer.users_permissions_user?.data?.id ||
                customer.attributes?.users_permissions_user?.data?.id ||
                customer.users_permissions_user?.id ||
                customer.attributes?.users_permissions_user?.id ||
                null;
              const customerName = user?.full_name || 'ลูกค้า';
              const followUpDate = customer.Follow_up_appointment_date || customer.attributes?.Follow_up_appointment_date;

              return (
                <div className="modern-customer-card" key={customer.id}>
                  {/* Header Section */}
                  <div className="card-header">
                    <div className="customer-avatar-modern">
                      <div className="avatar-circle">
                        {(user?.full_name?.charAt(0) || 'C').toUpperCase()}
                      </div>
                      <div className="customer-status-badge active">
                        ●
                      </div>
                    </div>
                    <div className="customer-basic-info">
                      <h3 className="customer-name-modern">
                        {user?.full_name || 'ไม่พบชื่อ'}
                      </h3>
                      <p className="customer-username">
                        @{user?.username || 'user'}
                      </p>
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="card-content">
                    <div className="info-grid">
                      <div className="info-item">
                        <div className="info-icon phone">📞</div>
                        <div className="info-text">
                          <span className="info-label">เบอร์โทร</span>
                          <span className="info-value">{user?.phone || 'ไม่ระบุ'}</span>
                        </div>
                      </div>
                      
                      <div className="info-item">
                        <div className="info-icon email">✉️</div>
                        <div className="info-text">
                          <span className="info-label">อีเมล</span>
                          <span className="info-value">{user?.email || 'ไม่ระบุ'}</span>
                        </div>
                      </div>

                      {/* Medical Info */}
                      {(customer.congenital_disease || customer.attributes?.congenital_disease) && (
                        <div className="info-item medical">
                          <div className="info-icon medical">🏥</div>
                          <div className="info-text">
                            <span className="info-label">โรคประจำตัว</span>
                            <span className="info-value">
                              {customer.congenital_disease || customer.attributes?.congenital_disease}
                            </span>
                          </div>
                        </div>
                      )}

                      {(customer.Allergic_drugs || customer.attributes?.Allergic_drugs) && (
                        <div className="info-item allergy">
                          <div className="info-icon allergy">⚠️</div>
                          <div className="info-text">
                            <span className="info-label">ยาที่แพ้</span>
                            <span className="info-value">
                              {customer.Allergic_drugs || customer.attributes?.Allergic_drugs}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Appointment Section */}
                    {followUpDate && (
                      <div className="appointment-section">
                        <div className="appointment-badge">
                          <span className="appointment-icon">📅</span>
                          <span className="appointment-text">
                            นัดครั้งถัดไป: <strong>{formatThaiDate(followUpDate)}</strong>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="card-footer">
                    <button
                      className="btn-modern btn-primary"
                      onClick={() => {
                        if (!customerDocumentId) {
                          toast.error("ไม่พบข้อมูลลูกค้า ไม่สามารถดูรายละเอียดได้");
                          return;
                        }
                        navigate(`/customer_detail/${customerDocumentId}?pharmacyId=${documentId}`);
                      }}
                    >
                      <span className="btn-icon">👁️</span>
                      <span className="btn-text">ดูรายละเอียด</span>
                    </button>
                    
                    <button 
                      className="btn-modern btn-danger"
                      onClick={() => deleteCustomer(customer.id, customerDocumentId, userId, customerName)}
                    >
                      <span className="btn-icon">🗑️</span>
                      <span className="btn-text">ลบ</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
          
          <div className="back-button-container">
            <button
              className="back-button"
              onClick={() => navigate("/pharmacyHome")}
            >
              กลับ
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default CustomerPage;