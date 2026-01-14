import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Footer from "../footer";
import HomeHeader from "../HomeHeader";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-prompt">
      <HomeHeader />
      
      <main className="flex-grow container mx-auto px-4 py-8 max-w-4xl">
        {/* Header Section */}
        <div className="relative overflow-hidden bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/60 p-8 mb-10 border border-slate-100">
          <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 font-prompt">
            <div className="space-y-2">
              <div className="inline-flex items-center px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold tracking-wider uppercase">
                Customer Management
              </div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                  {isEditMode ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
                  )}
                </div>
                {isEditMode ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มข้อมูลลูกค้าใหม่'}
              </h1>
              <p className="text-slate-400 font-medium font-prompt">
                {isEditMode ? 'อัปเดตรายละเอียดและข้อมูลประวัติของลูกค้าในระบบของคุณ' : 'กรอกรายละเอียดเพื่อสร้างประวัติลูกค้าใหม่และข้อมูลการติดต่อ'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 font-prompt pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Column 1: Personal & Account */}
            <div className="space-y-8">
              {/* Section 1: ข้อมูลส่วนตัว */}
              <div className="bg-white rounded-[2.5rem] p-8 shadow-md border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">ข้อมูลส่วนตัว</h3>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อ-นามสกุล <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-inner"
                      placeholder="กรอกชื่อ-นามสกุล..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">เบอร์โทรศัพท์ <span className="text-rose-500">*</span></label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-inner"
                      placeholder="08x-xxx-xxxx"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">โรคประจำตัว</label>
                    <input
                      type="text"
                      name="congenital_disease"
                      value={formData.congenital_disease}
                      onChange={handleInputChange}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-inner"
                      placeholder="ระบุโรคประจำตัว (ถ้ามี)..."
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: ข้อมูลบัญชี */}
              <div className="bg-white rounded-[2.5rem] p-8 shadow-md border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-2 h-full bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">ข้อมูลเข้าใช้งาน</h3>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Username <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      required
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-800 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-inner"
                      placeholder="กำหนดชื่อผู้ใช้งาน..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Password {!isEditMode && '(เว้นเพื่อใช้เบอร์โทร)'}</label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-800 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-inner"
                      placeholder={isEditMode ? "เว้นว่างไว้หากไม่เปลี่ยน" : "กำหนดรหัสผ่าน..."}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">อีเมล</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-800 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-inner"
                      placeholder="ระบุอีเมล (ไม่บังคับ)..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Medical Information */}
            <div className="space-y-8">
              <div className="bg-white rounded-[2.5rem] p-8 shadow-md border border-slate-100 relative h-full overflow-hidden group">
                <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M2 12h20"/></svg>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">ข้อมูลทางการแพทย์</h3>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-emerald-600/60 uppercase tracking-widest ml-1">⚠️ ยาที่แพ้</label>
                    <textarea
                      name="Allergic_drugs"
                      value={formData.Allergic_drugs}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-inner resize-none"
                      placeholder="ระบุยาที่แพ้ (ถ้ามี)..."
                    ></textarea>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-emerald-600/60 uppercase tracking-widest ml-1">🩺 อาการเบื้องต้น</label>
                    <textarea
                      name="Customers_symptoms"
                      value={formData.Customers_symptoms}
                      onChange={handleInputChange}
                      rows="4"
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-inner resize-none"
                      placeholder="บันทึกอาการเบื้องต้นหรือข้อมูลเพิ่มเติม..."
                    ></textarea>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-emerald-600/60 uppercase tracking-widest ml-1">📅 วันนัดติดตามผล</label>
                    <div className="relative">
                      <input
                        type="date"
                        name="Follow_up_appointment_date"
                        value={formData.Follow_up_appointment_date}
                        onChange={handleInputChange}
                        className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-inner appearance-none"
                      />
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse md:flex-row items-center justify-end gap-4 mt-12 bg-white rounded-[2rem] p-4 shadow-xl shadow-slate-200/50 border border-slate-100">
            <button
              type="button"
              className="w-full md:w-auto px-10 py-4 bg-slate-50 text-slate-500 font-black rounded-2xl hover:bg-slate-100 hover:text-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
              onClick={handleCancel}
              disabled={isLoading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              ยกเลิกและย้อนกลับ
            </button>
            <button
                type="submit"
                className="w-full md:w-auto px-12 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                )}
                <span>{isLoading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลลูกค้า'}</span>
              </button>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
}

export default FormCustomerPage;

