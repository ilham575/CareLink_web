import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
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
import DrugList from './js/pages/pharmacy/DrugList';
import DrugStoresDetailAdmin from './js/pages/admin/DrugStoresDetail_admin';
import StaffPage from './js/components/middle_page/staffPage';
import FormStaffPage from './js/components/middle_page/formStaffPage';
import PharmacistDetailAdmin from './js/pages/admin/PharmacistDetail_admin';
import EditPharmacistAdmin from "./js/pages/admin/EditPharmacist_admin";
import EditStoreAdmin from "./js/pages/admin/EditStore_admin"
import Footer from './js/components/footer';
import AddStoreAdmin from './js/pages/admin/AddStore_admin';
import AddPharmacyAdmin from './js/pages/admin/AddPharmacy_admin';
import AddStaffAdmin from './js/pages/admin/AddStaff_admin';
import EditStaffAdmin from './js/pages/admin/EditStaff_admin';
import StaffDetailAdmin from './js/pages/admin/StaffDetail_admin';
import CustomerPage from './js/components/middle_page/customerPage';
import CustomerPageStaff from './js/pages/staff/CustomerPage_staff';
import CustomerDetailStaff from './js/pages/staff/CustomerDetail_staff';
import DrugStoresDetailStaff from './js/pages/staff/DrugStoresDetail_staff';
import EditStaffProfile from './js/pages/staff/editStaffProfile';
import FormCustomerPage from './js/components/middle_page/formcustomerPage';
import CustomerDetail from './js/pages/pharmacy/detail_customer';
import RoleBasedRedirect from './js/utils/rolebasedredirect';
import 'antd/dist/reset.css';

// Override console.log to disable all console.log calls
// console.log = () => {};

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Root path - จะ redirect ตาม role หรือแสดง Home */}
          <Route path="/" element={<RoleBasedRedirect />} />
          
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/drug_store/:id" element={<DrugStoreDetail />} />
          
          {/* -------------------- ADMIN -------------------- */}
          <Route element={<RequireRole role="admin" />}>
            <Route path="/admin" element={<AdminHome />} />
            <Route path="/adminHome" element={<AdminHome />} />
            <Route path="/drug_store_admin/:id" element={<DrugStoresDetailAdmin />} />
            <Route path="/add_store_admin" element={<AddStoreAdmin />} />
            <Route path="/add_pharmacy_admin/:storeId" element={<AddPharmacyAdmin />} />
            <Route path="/pharmacist_detail_admin/:storeId" element={<PharmacistDetailAdmin />} />
            <Route path="/staff_detail_admin/:pharmacyId" element={<StaffDetailAdmin />} />
            <Route path="/add_staff_admin/:pharmacyId" element={<AddStaffAdmin />} />
            <Route path="/edit_staff_admin/:documentId" element={<EditStaffAdmin />} />
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
            <Route path="/drug_store_staff/:id/customers" element={<CustomerPageStaff />} />
            <Route path="/staff/customer_detail/:customerDocumentId" element={<CustomerDetailStaff />} />
            <Route path="/edit_staff_profile" element={<EditStaffProfile />} />
          </Route>

          {/* -------------------- CUSTOMER -------------------- */}
          <Route element={<RequireRole role="customer" />}>
            <Route path="/customerHome" element={<CustomerHome />} />
          </Route>

          {/* -------------------- STAFF MANAGEMENT -------------------- */}
          <Route element={<RequireRole role={['admin', 'pharmacy']} />}>
            <Route path="/edit_pharmacist_admin/:id" element={<EditPharmacistAdmin />}/>
            <Route path="/edit_store_admin/:id" element={<EditStoreAdmin />}/>
            <Route path="/drug_store_staff/:id" element={<StaffPage />} />
            <Route path="/form_staff" element={<FormStaffPage />} />
          </Route>
          <Route element={<RequireRole role={['admin', 'pharmacy', 'staff']} />}>
            <Route path="/form_staff/:id" element={<FormStaffPage />} />
          </Route>

          {/* -------------------- CUSTOMER MANAGEMENT -------------------- */}
          <Route element={<RequireRole role={['pharmacy', 'staff']} />}>
            <Route path="/drug_store_pharmacy/:id/followup-customers" element={<CustomerPage />} />
            <Route path="/drug_store_pharmacy/:id/drugs" element={<DrugList />} />
            <Route path="/drugs/:id" element={<DrugList />} />
            <Route path="/form_customer" element={<FormCustomerPage />} />
            <Route path="/form_customer/:id" element={<FormCustomerPage />} />
            <Route path="/customer_detail/:customerDocumentId" element={<CustomerDetail />} />
          </Route>
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}

export default App;