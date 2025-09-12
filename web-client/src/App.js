import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './js/pages/default/home';
import DrugStoreDetail from './js/pages/default/DrugStoreDetail';
import LoginPage from './js/pages/default/signin';
import Signup from './js/pages/default/Signup';
import './css/theme.css';
import './App.css';
import 'react-toastify/dist/ReactToastify.css';
import AdminHome from './js/pages/admin/home';
import PharmacyHome from './js/pages/pharmacy/home';
import StaffHome from './js/pages/staff/home';
import CustomerHome from './js/pages/customer/home';
import RequireRole from './js/components/RequireRole';
import DrugStoresDetailPharmacist from './js/pages/pharmacy/DrugStoresDetail_pharmacist';
import DrugStoresDetailAdmin from './js/pages/admin/DrugStoresDetail_admin';
import StaffPage from './js/components/middle_page/staffPage';
import FormStaffPage from './js/components/middle_page/formStaffPage';

import PharmacistDetail_admin from './js/pages/admin/PharmacistDetail_admin';
import EditPharmacist_admin from "./js/pages/admin/EditPharmacist_admin";
import EditStore_admin from "./js/pages/admin/EditStore_admin"


// ✅ เปลี่ยนชื่อ import ให้เป็นมาตรฐาน
import AddStore_admin from './js/pages/admin/AddStore_admin';
import AddPharmacy_admin from './js/pages/admin/AddPharmacy_admin';

import CustomerPage from './js/components/middle_page/customerPage';
import DrugStoresDetailStaff from './js/pages/staff/DrugStoresDetail_staff';
import FormCustomerPage from './js/components/middle_page/formcustomerPage';
import 'antd/dist/reset.css';  // สำหรับ Ant Design v5 ขึ้นไป (2024)

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/drug_store/:id" element={<DrugStoreDetail />} />
          {/* -------------------- ADMIN -------------------- */}
          <Route element={<RequireRole role="admin" />}>
            <Route path="/adminHome" element={<AdminHome />} />
            <Route path="/drug_store_admin/:id" element={<DrugStoresDetailAdmin />} />
            <Route path="/add_store_admin" element={<AddStore_admin />} />
            <Route path="/add_pharmacy_admin" element={<AddPharmacy_admin />} />
            <Route path="/add_pharmacy_admin/:storeId" element={<AddPharmacy_admin />} />
            <Route path="/pharmacist_detail_admin/:storeId" element={<PharmacistDetail_admin />} />
            <Route path="/edit_pharmacist_admin/:id" element={<EditPharmacist_admin />}/>
            <Route path="/edit_store_admin/:id" element={<EditStore_admin />}/>
          </Route>

          {/* -------------------- PHARMACY -------------------- */}
          <Route element={<RequireRole role="pharmacy" />}>
            <Route path="/pharmacyHome" element={<PharmacyHome />} />
            <Route path="/drug_store_pharmacy/:id" element={<DrugStoresDetailPharmacist />} />
          </Route>

          {/* -------------------- STAFF -------------------- */}
          <Route element={<RequireRole role="staff" />}>
            <Route path="/staffHome" element={<StaffHome />} />
            <Route path="/drug_store_staff_detail/:id" element={<DrugStoresDetailStaff />} />
          </Route>

          {/* -------------------- CUSTOMER -------------------- */}
          <Route element={<RequireRole role="customer" />}>
            <Route path="/customerHome" element={<CustomerHome />} />
          </Route>

          {/* -------------------- STAFF MANAGEMENT -------------------- */}
          <Route element={<RequireRole role={['admin', 'pharmacy']} />}>
          <Route path="/add_drug_store_admin" element={<AddPharmacyAdmin />} /> 
            <Route path="/drug_store_staff/:id" element={<StaffPage />} />
            <Route path="/form_staff" element={<FormStaffPage />} />
          </Route>
          <Route element={<RequireRole role={['admin', 'pharmacy', 'staff']} />}>
            <Route path="/form_staff/:id" element={<FormStaffPage />} />
          </Route>

          {/* -------------------- CUSTOMER MANAGEMENT -------------------- */}
          <Route element={<RequireRole role={['pharmacy', 'staff']} />}>
            <Route path="/drug_store_pharmacy/:id/followup-customers" element={<CustomerPage />} />
            <Route path="/form_customer" element={<FormCustomerPage />} />
            <Route path="/form_customer/:id" element={<FormCustomerPage />} />
          </Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App;
