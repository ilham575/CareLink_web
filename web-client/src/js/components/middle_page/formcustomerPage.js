import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Footer from "../footer";
import HomeHeader from "../HomeHeader";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../../../css/pages/formcustomerPage.css";
import { API, fetchWithAuth } from "../../../utils/apiConfig";

function FormCustomerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [customerId, setCustomerId] = useState(null);
  const [customerDocumentId, setCustomerDocumentId] = useState(null);
  
  // Helper: Convert string to JSON safely
  const parseJsonField = (value) => {
    if (!value) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      // Try to parse as JSON, if fails wrap as string
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        // If not JSON, wrap in object with 'allergy' key
        return { allergy: trimmed };
      }
    }
    return null;
  };
  
  // Form data
  const [formData, setFormData] = useState({
    // User fields
    full_name: "",
    phone: "",
    username: "",
    password: "",
    email: "",
    
    // Customer profile fields
    congenital_disease: "",
    Allergic_drugs: "",
    Customers_symptoms: "",
    Follow_up_appointment_date: ""
  });

  // Get pharmacyId and documentId from URL params
  const searchParams = new URLSearchParams(location.search);
  const pharmacyId = searchParams.get('pharmacyId');
  const documentId = searchParams.get('documentId');

  useEffect(() => {
    // Check if this is edit mode
    if (documentId) {
      setIsEditMode(true);
      loadCustomerData(documentId);
    }
  }, [documentId]);

  const loadCustomerData = async (customerDocumentId) => {
    try {
      const token = localStorage.getItem('jwt');
      const response = await fetch(
        API.customerProfiles.getByDocumentId(customerDocumentId),
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('ไม่สามารถโหลดข้อมูลลูกค้าได้');
      }
      
      const json = await response.json();
      const customerData = Array.isArray(json.data) ? json.data[0] : json.data;
      const customer = customerData;
      
      if (customer) {
        const user = customer.users_permissions_user?.data?.attributes || customer.users_permissions_user;
        const allergic = customer.Allergic_drugs || customer.attributes?.Allergic_drugs;
        // Convert JSON object back to display string
        let allergyDisplay = "";
        if (allergic) {
          if (typeof allergic === 'string') {
            allergyDisplay = allergic;
          } else if (typeof allergic === 'object') {
            allergyDisplay = allergic.allergy || allergic.drug || JSON.stringify(allergic);
          }
        }
        
        setCustomerId(customer.id || customer.attributes?.id);
        setCustomerDocumentId(customer.documentId || customer.attributes?.documentId);
        setFormData({
          full_name: user?.full_name || "",
          phone: user?.phone || "",
          username: user?.username || "",
          password: "", // Don't load password for security
          email: user?.email || "",
          congenital_disease: customer.congenital_disease || customer.attributes?.congenital_disease || "",
          Allergic_drugs: allergyDisplay,
          Customers_symptoms: customer.Customers_symptoms || customer.attributes?.Customers_symptoms || "",
          Follow_up_appointment_date: customer.Follow_up_appointment_date || customer.attributes?.Follow_up_appointment_date || ""
        });
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลลูกค้าได้');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    const required = ['full_name', 'phone', 'username'];
    // Remove password from required fields since we'll use phone as default
    
    for (const field of required) {
      if (!formData[field]?.trim()) {
        toast.error(`กรุณากรอก${getFieldLabel(field)}`);
        return false;
      }
    }
    
    // Auto-generate email if not provided
    const emailToValidate = formData.email?.trim() || `${formData.username}@example.com`;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToValidate)) {
      toast.error('รูปแบบอีเมลไม่ถูกต้อง');
      return false;
    }
    
    return true;
  };

  const getFieldLabel = (field) => {
    const labels = {
      full_name: 'ชื่อ-นามสกุล',
      phone: 'เบอร์โทรศัพท์',
      username: 'USERNAME',
      password: 'PASSWORD',
      email: 'อีเมล'
    };
    return labels[field] || field;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    if (!pharmacyId) {
      toast.error('ไม่พบข้อมูลร้านยา');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const token = localStorage.getItem('jwt');
      
      if (isEditMode) {
        // Update existing customer
        await updateCustomer(token);
      } else {
        // Create new customer
        await createCustomer(token);
      }
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsLoading(false);
    }
  };

  const createCustomer = async (token) => {
    // First, get the current user ID
    const userRes = await fetch(API.users.me(), {
      headers: { Authorization: `Bearer ${token}` }
    });
    const userData = await userRes.json();
    const currentUserId = userData.id;

    // Get the current pharmacist's profile
    let pharmacyProfileDocumentId = null;
    try {
      const pharmacyRes = await fetch(API.pharmacyProfiles.getByUserId(currentUserId), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const pharmacyData = await pharmacyRes.json();
      if (pharmacyData.data && pharmacyData.data.length > 0) {
        // Use the pharmacy profile that matches the current store
        const matchingProfile = pharmacyData.data.find(profile => {
          const storeIds = profile.drug_stores?.map(s => s.documentId || s.id || s) || [];
          return storeIds.length > 0;
        }) || pharmacyData.data[0];
        pharmacyProfileDocumentId = matchingProfile.documentId;
      }
    } catch (error) {
      console.warn('Could not fetch pharmacy profile:', error);
    }

    // Get the drug store internal ID
    const drugStoreRes = await fetch(
      API.drugStores.getByDocumentId(pharmacyId),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const drugStoreJson = await drugStoreRes.json();
    const targetStore = drugStoreJson.data?.find(store => store.documentId === pharmacyId);
    
    if (!targetStore) {
      throw new Error('ไม่พบข้อมูลร้านยา');
    }

    // *** เพิ่ม: ค้นหา customer role ID แทนการใช้ hardcode ***
    const roleRes = await fetch(API.roles.list(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const roleData = await roleRes.json();

    const customerRole = roleData.roles.find(r => r.name === 'customer');
    const targetRoleId = customerRole?.id;

    if (!targetRoleId) {
      throw new Error('ไม่พบ role สำหรับลูกค้า');
    }

    // Auto-generate email if not provided
    const emailToUse = formData.email?.trim() || `${formData.username}@example.com`;
    
    // Use phone number as default password if no password provided
    const passwordToUse = formData.password?.trim() || formData.phone;

    // Create user with basic fields only
    const createUserResponse = await fetch(API.auth.register, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: formData.username,
        email: emailToUse,
        password: passwordToUse
      })
    });

    if (!createUserResponse.ok) {
      const errorData = await createUserResponse.json();
      throw new Error(errorData.error?.message || 'ไม่สามารถสร้างบัญชีผู้ใช้ได้');
    }

    const newUserData = await createUserResponse.json();

    try {
      // Update user with additional fields
      const updateUserResponse = await fetch(API.users.getById(newUserData.user.id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: formData.full_name,
          phone: formData.phone,
          role: targetRoleId // *** เปลี่ยนจาก hardcode 4 เป็น dynamic role ID ***
        })
      });

      if (!updateUserResponse.ok) {
        // If user update fails, try to clean up the created user
        try {
          await fetch(API.users.getById(newUserData.user.id), {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (cleanupError) {
          console.error('Failed to cleanup user after update failure:', cleanupError);
        }
        
        const errorData = await updateUserResponse.json();
        throw new Error(errorData.error?.message || 'ไม่สามารถอัปเดตข้อมูลผู้ใช้ได้');
      }

      // Create customer profile with pharmacy_profile
      const profileData = {
        users_permissions_user: newUserData.user.documentId,
        drug_stores: [targetStore.documentId],
        congenital_disease: formData.congenital_disease,
        Allergic_drugs: parseJsonField(formData.Allergic_drugs),
        Customers_symptoms: formData.Customers_symptoms,
        Follow_up_appointment_date: formData.Follow_up_appointment_date || null
      };

      // Add pharmacy_profile if found
      if (pharmacyProfileDocumentId) {
        profileData.pharmacy_profile = pharmacyProfileDocumentId;
      }

      const profileResponse = await fetch(API.customerProfiles.create(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          data: profileData
        })
      });

      if (!profileResponse.ok) {
        // If profile creation fails, try to clean up the user
        try {
          await fetch(API.users.getById(newUserData.user.id), {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (cleanupError) {
          console.error('Failed to cleanup user after profile creation failure:', cleanupError);
        }
        
        const errorData = await profileResponse.json();
        throw new Error(errorData.error?.message || 'ไม่สามารถสร้างโปรไฟล์ลูกค้าได้');
      }

      toast.success('เพิ่มลูกค้าสำเร็จ');
      navigate(`/drug_store_pharmacy/${targetStore.documentId}/followup-customers`, {
        state: { toastMessage: 'เพิ่มลูกค้าสำเร็จ' }
      });
    } catch (error) {
      // If anything fails after user creation, try to clean up the user
      try {
        await fetch(API.users.getById(newUserData.user.id), {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (cleanupError) {
        console.error('Failed to cleanup user:', cleanupError);
      }
      throw error;
    }
  };

  const updateCustomer = async (token) => {
    // Get the current user ID and pharmacy profile
    const userRes = await fetch(API.users.me(), {
      headers: { Authorization: `Bearer ${token}` }
    });
    const meData = await userRes.json();
    const currentUserId = meData.id;

    // Get the current pharmacist's profile
    let pharmacyProfileDocumentId = null;
    try {
      const pharmacyRes = await fetch(API.pharmacyProfiles.getByUserId(currentUserId), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const pharmacyData = await pharmacyRes.json();
      if (pharmacyData.data && pharmacyData.data.length > 0) {
        // Use the pharmacy profile that matches the current store
        const matchingProfile = pharmacyData.data.find(profile => {
          const storeIds = profile.drug_stores?.map(s => s.documentId || s.id || s) || [];
          return storeIds.length > 0;
        }) || pharmacyData.data[0];
        pharmacyProfileDocumentId = matchingProfile.documentId;
      }
    } catch (error) {
      console.warn('Could not fetch pharmacy profile:', error);
    }

    // ดึง userId จากข้อมูลที่โหลดมาจาก API
    let userId = null;
    
    // ดึงข้อมูล customer profile ใหม่เพื่อให้แน่ใจว่าได้ userId ที่ถูกต้อง
    try {
      const customerRes = await fetch(
        API.customerProfiles.list(`populate=users_permissions_user&filters[documentId][\$eq]=\${customerDocumentId}`),
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const customerData = await customerRes.json();
      
      if (customerData.data) {
        userId = customerData.data.users_permissions_user?.id || 
                 customerData.data.users_permissions_user?.data?.id;
      }
    } catch (error) {
      console.error('Error fetching customer data for update:', error);
      throw new Error('ไม่สามารถดึงข้อมูลลูกค้าสำหรับการอัปเดตได้');
    }

    // Auto-generate email if not provided
    const emailToUse = formData.email?.trim() || `${formData.username}@example.com`;
    
    if (userId && formData.password) {
      // Update user data including password
      const userResponse = await fetch(API.users.getById(userId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: formData.full_name,
          phone: formData.phone,
          username: formData.username,
          email: emailToUse,
          password: formData.password
        })
      });

      if (!userResponse.ok) {
        const errorData = await userResponse.json();
        throw new Error(errorData.error?.message || 'ไม่สามารถอัปเดตข้อมูลผู้ใช้ได้');
      }
    } else if (userId) {
      // Update user data without password change
      const userResponse = await fetch(API.users.getById(userId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: formData.full_name,
          phone: formData.phone,
          username: formData.username,
          email: emailToUse
        })
      });

      if (!userResponse.ok) {
        const errorData = await userResponse.json();
        throw new Error(errorData.error?.message || 'ไม่สามารถอัปเดตข้อมูลผู้ใช้ได้');
      }
    }

    // Update customer profile using documentId with pharmacy_profile
    const updateData = {
      data: {
        congenital_disease: formData.congenital_disease,
        Allergic_drugs: parseJsonField(formData.Allergic_drugs),
        Customers_symptoms: formData.Customers_symptoms,
        Follow_up_appointment_date: formData.Follow_up_appointment_date || null
      }
    };

    // Add pharmacy_profile if found
    if (pharmacyProfileDocumentId) {
      updateData.data.pharmacy_profile = pharmacyProfileDocumentId;
    }

    const profileResponse = await fetch(API.customerProfiles.update(customerDocumentId), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(updateData)
    });

    if (!profileResponse.ok) {
      const errorData = await profileResponse.json();
      throw new Error(errorData.error?.message || 'ไม่สามารถอัปเดตโปรไฟล์ลูกค้าได้');
    }

    // Get pharmacy documentId for redirect
    const drugStoreRes = await fetch(
      API.drugStores.getByDocumentId(pharmacyId),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const drugStoreJson = await drugStoreRes.json();
    const targetStore = drugStoreJson.data?.find(store => store.documentId === pharmacyId);
    
    toast.success('อัปเดตข้อมูลลูกค้าสำเร็จ');
    navigate(`/drug_store_pharmacy/${targetStore?.documentId || pharmacyId}/followup-customers`, {
      state: { toastMessage: 'อัปเดตข้อมูลลูกค้าสำเร็จ' }
    });
  };

  const handleCancel = () => {
    if (isEditMode) {
      navigate(`/customer_detail/${customerDocumentId}?pharmacyId=${pharmacyId}`);
    } else {
      navigate(`/drug_store_pharmacy/${pharmacyId}/followup-customers`);
    }
  };

  return (
    <div className="customer-form-page">
      <ToastContainer />
      <HomeHeader />
      <div className="customer-form-main">
        <div className="customer-form-container">
          <div className="customer-form-header">
            <h1>
              {isEditMode ? '✏️ แก้ไขข้อมูลลูกค้า' : '👤 เพิ่มลูกค้าใหม่'}
            </h1>
            <p>
              {isEditMode ? 'อัปเดตข้อมูลลูกค้าของคุณ' : 'กรอกข้อมูลเพื่อเพิ่มลูกค้าใหม่'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="customer-form-element">
            {/* เปลี่ยนจาก div แยกๆ เป็น wrapper div เดียว */}
            <div className="customer-form-sections">
              {/* กล่องที่ 1: ข้อมูลส่วนตัว */}
              <div className="customer-form-section customer-form-section-personal">
                <h3 style={{marginBottom: '24px', fontSize: '20px', fontWeight: 700, color: '#2563eb'}}>📋 ข้อมูลส่วนตัว</h3>
                <div className="customer-form-row customer-form-row-one-col">
                  <div className="customer-form-group">
                    <label htmlFor="full_name">👤 ชื่อ-นามสกุล *</label>
                    <input
                      type="text"
                      id="full_name"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      required
                      className="customer-form-input customer-form-input-personal"
                    />
                  </div>
                </div>
                <div className="customer-form-row customer-form-row-one-col">
                  <div className="customer-form-group">
                    <label htmlFor="phone">📞 เบอร์โทรศัพท์ *</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                      className="customer-form-input customer-form-input-personal"
                    />
                  </div>
                </div>
                <div className="customer-form-row customer-form-row-one-col">
                  <div className="customer-form-group">
                    <label htmlFor="congenital_disease">🏥 โรคประจำตัว</label>
                    <input
                      type="text"
                      id="congenital_disease"
                      name="congenital_disease"
                      value={formData.congenital_disease}
                      onChange={handleInputChange}
                      className="customer-form-input customer-form-input-personal"
                    />
                  </div>
                </div>
              </div>

              {/* กล่องที่ 2: ข้อมูลบัญชี */}
              <div className="customer-form-section customer-form-section-account">
                <h3 style={{marginBottom: '24px', fontSize: '20px', fontWeight: 700, color: '#0ea5e9'}}>🔐 ข้อมูลบัญชี</h3>
                <div className="customer-form-row customer-form-row-one-col">
                  <div className="customer-form-group">
                    <label htmlFor="username">👨‍💻 USERNAME *</label>
                    <input
                      type="text"
                      id="username"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      required
                      className="customer-form-input customer-form-input-account"
                    />
                  </div>
                </div>
                <div className="customer-form-row customer-form-row-one-col">
                  <div className="customer-form-group">
                    <label htmlFor="password">🔒 PASSWORD {!isEditMode && '(ถ้าไม่ใส่จะใช้เบอร์โทรศัพท์)'}</label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder={isEditMode ? "เว้นว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน" : "เว้นว่างเพื่อใช้เบอร์โทรศัพท์เป็นรหัสผ่าน"}
                      className="customer-form-input customer-form-input-account"
                    />
                  </div>
                </div>
                <div className="customer-form-row customer-form-row-one-col">
                  <div className="customer-form-group">
                    <label htmlFor="email">✉️ อีเมล</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="ถ้าไม่กรอก จะใช้ username@example.com"
                      className="customer-form-input customer-form-input-account"
                    />
                  </div>
                </div>
              </div>

              {/* กล่องที่ 3: ข้อมูลทางการแพทย์ */}
              <div className="customer-form-section customer-form-section-medical">
                <h3 style={{marginBottom: '24px', fontSize: '20px', fontWeight: 700, color: '#10b981'}}>💊 ข้อมูลทางการแพทย์</h3>
                <div className="customer-form-row customer-form-row-one-col">
                  <div className="customer-form-group">
                    <label htmlFor="Allergic_drugs">⚠️ ยาที่แพ้</label>
                    <input
                      type="text"
                      id="Allergic_drugs"
                      name="Allergic_drugs"
                      value={formData.Allergic_drugs}
                      onChange={handleInputChange}
                      className="customer-form-input customer-form-input-medical"
                    />
                  </div>
                </div>
                <div className="customer-form-row customer-form-row-one-col">
                  <div className="customer-form-group">
                    <label htmlFor="Customers_symptoms">🩺 อาการของลูกค้า</label>
                    <input
                      type="text"
                      id="Customers_symptoms"
                      name="Customers_symptoms"
                      value={formData.Customers_symptoms}
                      onChange={handleInputChange}
                      className="customer-form-input customer-form-input-medical"
                    />
                  </div>
                </div>
                <div className="customer-form-row customer-form-row-one-col">
                  <div className="customer-form-group">
                    <label htmlFor="Follow_up_appointment_date">📅 วันที่นัดติดตาม</label>
                    <input
                      type="date"
                      id="Follow_up_appointment_date"
                      name="Follow_up_appointment_date"
                      value={formData.Follow_up_appointment_date}
                      onChange={handleInputChange}
                      className="customer-form-input customer-form-input-medical"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ปุ่มอยู่ข้างนอก wrapper */}
            <div className="customer-form-buttons">
              <button
                type="submit"
                className="customer-form-btn customer-form-btn-submit"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="customer-form-loading-spinner"></div>
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    💾 บันทึก
                  </>
                )}
              </button>
              <button
                type="button"
                className="customer-form-btn customer-form-btn-cancel"
                onClick={handleCancel}
                disabled={isLoading}
              >
                ← กลับ
              </button>
            </div>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default FormCustomerPage;

