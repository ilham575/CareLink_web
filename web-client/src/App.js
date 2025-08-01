import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import logo from './logo.svg';
import Home from './js/pages/default/home';
import PharmacyDetail from './js/pages/default/PharmacyDetail';

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

// Mock user database
const mockUsers = [
  { username: 'admin1', password: 'adminpass', role: 'admin' },
  { username: 'doctor1', password: 'doctorpass', role: 'doctor' },
  { username: 'nurse1', password: 'nursepass', role: 'nurse' },
  { username: 'patient1', password: 'patientpass', role: 'patient' },
];

// Mock login page
function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = () => {
    const user = mockUsers.find(
      u => u.username === username && u.password === password
    );
    if (user) {
      onLogin(user.role);
      setError('');
      // Redirect based on role
      if (user.role === 'admin') navigate('/page1');
      else if (user.role === 'doctor') navigate('/page2');
      else if (user.role === 'nurse') navigate('/page3');
      else if (user.role === 'patient') navigate('/page4');
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div style={{ margin: 40 }}>
      <h2>Login</h2>
      <div>
        <label>
          Username:&nbsp;
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>
      </div>
      <div style={{ marginTop: 10 }}>
        <label>
          Password:&nbsp;
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
      </div>
      <button onClick={handleLogin} style={{ marginTop: 15 }}>Login</button>
      {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}
      <div style={{ marginTop: 20, color: '#888', fontSize: 14 }}>
        <div>ตัวอย่างบัญชีผู้ใช้:</div>
        <div>admin1 / adminpass</div>
        <div>doctor1 / doctorpass</div>
        <div>nurse1 / nursepass</div>
        <div>patient1 / patientpass</div>
      </div>
    </div>
  );
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
          <Route path="/login" element={<Login onLogin={setUserRole} />} />
          <Route path="/pharmacy/:id" element={<PharmacyDetail />} />
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
          <Route path='/login' element={<Navigate to="/login" />} />
          <Route path='/' element={<Home />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
