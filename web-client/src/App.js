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

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/drug_store/:id" element={<DrugStoreDetail />} />
          <Route path="/drug_store_pharmacy/:id" element={<DrugStoresDetailPharmacist />} />
          <Route path="/drug_store_admin/:id" element={<DrugStoresDetailAdmin />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/adminHome"
            element={
              <RequireRole role="admin">
                <AdminHome />
              </RequireRole>
            }
          />
          <Route
            path="/pharmacyHome"
            element={
              <RequireRole role="pharmacy">
                <PharmacyHome />
              </RequireRole>
            }
          />
          <Route
            path="/staffHome"
            element={
              <RequireRole role="staff">
                <StaffHome />
              </RequireRole>
            }
          />
          <Route
            path="/customerHome"
            element={
              <RequireRole role="customer">
                <CustomerHome />
              </RequireRole>
            }
          />
          {/* <Route path="*" element={<Navigate to="/" />} /> */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;