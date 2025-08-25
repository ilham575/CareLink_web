import { useNavigate, useParams } from "react-router-dom";
import Footer from "../footer";
import HomeHeader from "../HomeHeader";
import "../../../css/pages/default/staffPage.css";
import React, { useEffect, useState } from "react";


function StaffPage({id}) {
  const navigate = useNavigate();
  const params = useParams();
  const [pharmacy, setPharmacy] = useState(null);

  // ใช้ id จาก props หรือจาก url params
  const pharmacyId = id || params.id;

  console.log('pharmacyId:', pharmacyId);

  useEffect(() => {
    if (pharmacyId) {
      fetch(`http://localhost:1337/api/drug-stores/${pharmacyId}`)
        .then(res => res.json())
        .then(json => {
          const store = json.data;
          setPharmacy(store?.attributes || store || null);
        });
    }
  }, [pharmacyId]);

  return (
    <div className="staffpage-bg">
      <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
      <main className="staffpage-main">
        <div className="staffpage-container">
          <div className="staffpage-header-row">
            <h2 className="staffpage-title">พนักงานประจำร้านยา:</h2>
            <button
              className="staffpage-add-btn"
              onClick={() => navigate('/form_staff')}
            >
              เพิ่มพนักงาน
            </button>
          </div>
          <div className="staff-card">
            <div className="staff-card-image">รูปภาพ<br />พนักงาน</div>
            <div className="staff-card-details">
              <div>
                <b>ชื่อ:</b> …………………………… <b>นามสกุล:</b> ……………………………
              </div>
              <div>
                <b>เบอร์โทรศัพท์:</b> ………………………………………
              </div>
              <div>
                <b>เวลาทำงาน:</b> ………………………………………
              </div>
            </div>
            <button className="staff-card-edit-btn" onClick={() => navigate(`/form_staff/${id}`)}>กด<br />เพื่อแก้ไข</button>
            <button className="staff-card-delete-btn">ลบ</button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default StaffPage;