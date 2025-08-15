import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './js/pages/default/home';
import PharmacyDetail from './js/pages/default/PharmacyDetail';
import LoginPage from './js/pages/default/signin';
import Signup from './js/pages/default/Signup';
import './css/theme.css';
import './App.css';
import 'react-toastify/dist/ReactToastify.css';
import AdminHome from './js/pages/admin/home';
import PharmacyHome from './js/pages/pharmacy/home';
import StaffHome from './js/pages/staff/home';
import CustomerHome from './js/pages/customer/home';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/pharmacy/:id" element={<PharmacyDetail />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/page1" element={<AdminHome />} /> {/* admin */}
          <Route path="/page2" element={<PharmacyHome />} /> {/* pharmacy */}
          <Route path="/page3" element={<StaffHome />} /> {/* nurse */}
          <Route path="/page4" element={<CustomerHome />} /> {/* patient */}
          {/* <Route path="*" element={<Navigate to="/" />} /> */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;