import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import logo from './logo.svg';
import Home from './js/pages/default/home';
import LoginPage from './js/pages/default/signin';
import './App.css';

// Mock pages
function Page1() {
  return <h2>Page 1 (Role: admin)</h2>;
}
function Page2() {
  return <h2>Page 2 (Role: doctor)</h2>;
}
function Page3() {
  return <h2>Page 3 (Role: nurse)</h2>;
}
function Page4() {
  return <h2>Page 4 (Role: patient)</h2>;
}

// Protected route component
function ProtectedRoute({ children, allowedRoles, userRole }) {
  if (!userRole) return <Navigate to="/login" />;
  if (!allowedRoles.includes(userRole)) return <Navigate to="/login" />;
  return children;
}

function App() {
  const [userRole, setUserRole] = useState(null);

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage onLogin={setUserRole} />} />
          <Route
            path="/page1"
            element={
              <ProtectedRoute allowedRoles={['admin']} userRole={userRole}>
                <Page1 />
              </ProtectedRoute>
            }
          />
          <Route
            path="/page2"
            element={
              <ProtectedRoute allowedRoles={['doctor']} userRole={userRole}>
                <Page2 />
              </ProtectedRoute>
            }
          />
          <Route
            path="/page3"
            element={
              <ProtectedRoute allowedRoles={['nurse']} userRole={userRole}>
                <Page3 />
              </ProtectedRoute>
            }
          />
          <Route
            path="/page4"
            element={
              <ProtectedRoute allowedRoles={['patient']} userRole={userRole}>
                <Page4 />
              </ProtectedRoute>
            }
          />
          {/* Optional: redirect unknown routes to home */}
          {/* <Route path="*" element={<Navigate to="/" />} /> */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
