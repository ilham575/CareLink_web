import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './js/pages/default/home';
import PharmacyDetail from './js/pages/default/PharmacyDetail';
import LoginPage from './js/pages/default/signin';
import Signup from './js/pages/default/Signup';
import './App.css';
import HomeHeader from './js/components/HomeHeader';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Mock pages
function Page1() {
  return (
    <>
      <ToastContainer />
      <HomeHeader isLoggedIn={true}/>
      <h2>Page 1 (Role: admin)</h2>
    </>
  );
}
function Page2() {
  return (
    <>
      <ToastContainer />
      <HomeHeader isLoggedIn={true}/>
      <h2>Page 2 (Role: pharmacy)</h2>
    </>
  );
}
function Page3() {
  return (
    <>
      <ToastContainer />
      <HomeHeader isLoggedIn={true}/>
      <h2>Page 3 (Role: nurse)</h2>
    </>
  );
}
function Page4() {
  return (
    <>
      <ToastContainer />
      <HomeHeader isLoggedIn={true}/>
      <h2>Page 4 (Role: patient)</h2>
    </>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/pharmacy/:id" element={<PharmacyDetail />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/page1" element={<Page1 />} /> {/* admin */}
          <Route path="/page2" element={<Page2 />} /> {/* pharmacy */}
          <Route path="/page3" element={<Page3 />} /> {/* nurse */}
          <Route path="/page4" element={<Page4 />} /> {/* patient */}
          {/* <Route path="*" element={<Navigate to="/" />} /> */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
