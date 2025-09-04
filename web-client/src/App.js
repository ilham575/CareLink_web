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
import AddPharmacyAdmin from './js/pages/admin/AddPharmacy_admin';
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

          {/* <Route element={<RequireRole role="admin" />}>
            <Route path="/adminHome" element={<AdminHome />} />
            <Route path="/drug_store_admin/:id" element={<DrugStoresDetailAdmin />} />
          </Route> */}
          <Route path="/adminHome" element={<AdminHome />} />
          <Route path="/drug_store_admin/:id" element={<DrugStoresDetailAdmin />} />
          <Route path="/add_drug_store_admin" element={<AddPharmacyAdmin />} />



          <Route element={<RequireRole role="pharmacy" />}>
            <Route path="/pharmacyHome" element={<PharmacyHome />} />
            <Route path="/drug_store_pharmacy/:id" element={<DrugStoresDetailPharmacist />} />
          </Route>

          <Route element={<RequireRole role="staff" />}>
            <Route path="/staffHome" element={<StaffHome />} />
          </Route>

          <Route element={<RequireRole role="customer" />}>
            <Route path="/customerHome" element={<CustomerHome />} />
          </Route>
          <Route element={<RequireRole role={['admin', 'pharmacy']} />}>
            <Route path="/drug_store_staff/:id" element={<StaffPage />} />
            <Route path="/form_staff" element={<FormStaffPage />} />
          </Route>
          <Route element={<RequireRole role={['admin', 'pharmacy', 'staff']} />}>
            <Route path="/form_staff/:id" element={<FormStaffPage />} />
          </Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App;