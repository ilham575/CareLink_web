import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../../css/pages/default/pharmacyDetail.css';
import HomeHeader from './HomeHeader';

function PharmacyDetail() {
  const navigate = useNavigate();

  return (
    <div className="detail-container">
      <HomeHeader />

      <div className="image-row">
        <div className="image-box">รูปด้านนอกร้านยา</div>
        <div className="image-box">รูปด้านในร้านยา</div>
        <div className="image-box">รูปเภสัชกรและพนักงาน</div>
      </div>

      <div className="info-service-row">
        <div className="left-info">
          <p>ชื่อร้านยา………………………………………</p>
          <p>ที่อยู่………………………………………</p>
          <p>เวลาทำการ………………………………………</p>
          <p>เบอร์โทรศัพท์ร้านยา………………………………………</p>
          <p>ชื่อ-นามสกุลเภสัชกร………………………………………</p>
          <p>เบอร์โทรศัพท์เภสัชกร………………………………………</p>
        </div>

        <div className="right-service">
          <div className="service-box">
            <p className="section-title">การให้บริการ</p>
            <ul>
              <li>จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ</li>
              <li>ให้คำปรึกษาทางเภสัชกรรม</li>
              <li>ตรวจสุขภาพเบื้องต้น</li>
              <li>รับฝากยาและจัดส่งยา</li>
            </ul>
          </div>

          <div className="map-box">
            <p className="section-title">GOOGLE MAP</p>
            <div className="map-placeholder">&lt;LINK GOOGLE MAP&gt;</div>
          </div>
        </div>
      </div>

      <div className="bottom-button">
        <button className="back-button" onClick={() => navigate(-1)}>กลับ</button>
      </div>
    </div>
  );
}

export default PharmacyDetail;
