import React, { useRef, useState, useEffect } from "react";
import Footer from "../footer";
import HomeHeader from "../HomeHeader";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../../../css/theme.css";

function FormStaffPage() {
  const [profileImage, setProfileImage] = useState(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    username: "",
    password: "",
    position: "",
    profileImage: null,
  });
  const fileInputRef = useRef();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setForm((f) => ({ ...f, profileImage: e.target.files[0] }));
      setProfileImage(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: submit logic
    toast.success("บันทึกข้อมูลพนักงานสำเร็จ (demo)");
  };

  return (
    <div className="signup-page-container">
      <HomeHeader />
      <ToastContainer />
      <div className="signup-content">
        <div className="signup-note">
          <b>เพิ่มข้อมูลพนักงานร้านยา</b>
        </div>
        <form className="signup-form" onSubmit={handleSubmit}>
          <div className="signup-form-flex">
            <div className="signup-form-left">
              <label>
                ชื่อ<span className="required">*</span>
              </label>
              <input
                type="text"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                required
              />
              <label>
                นามสกุล<span className="required">*</span>
              </label>
              <input
                type="text"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                required
              />
              <label>เบอร์โทรศัพท์</label>
              <input
                type="text"
                name="phone"
                value={form.phone}
                onChange={handleChange}
              />
              <label>
                USERNAME<span className="required">*</span>
              </label>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                required
              />
              <label>
                PASSWORD<span className="required">*</span>
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
              />
              <label>
                ตำแหน่งงาน<span className="required">*</span>
              </label>
              <input
                type="text"
                name="position"
                value={form.position}
                onChange={handleChange}
                required
              />
            </div>
            <div className="signup-form-right">
              <label>
                เพิ่มรูปภาพพนักงาน<span className="required">*</span>
              </label>
              <div
                className="signup-upload-box"
                onClick={handleUploadClick}
              >
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="profile"
                    className="signup-profile-preview"
                  />
                ) : (
                  <span className="signup-upload-icon">&#8682;</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleImageChange}
                  required
                />
              </div>
            </div>
          </div>
          <button type="submit" className="signup-submit-btn">
            บันทึก
          </button>
        </form>
        <div className="signup-footer-note">
          <span>“ * “ หมายถึง จำเป็นต้องใส่</span>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default FormStaffPage;
