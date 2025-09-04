import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

function PharmacistDetail_admin() {
  const { storeId } = useParams(); // ✅ รับ storeId จาก URL
  const navigate = useNavigate();
  const [pharmacists, setPharmacists] = useState([]);

  useEffect(() => {
    // โหลดข้อมูล mock_pharmacists จาก localStorage
    const stored = JSON.parse(db.pharmacists.where("storeId").equals(storeId).toArray()|| "[]");
    const found = stored.filter((p) => String(p.storeId) === String(storeId));
    setPharmacists(found);
  }, [storeId]);

  if (pharmacists.length === 0) {
    return (
      <div className="p-6 text-center">
        <p>ไม่พบข้อมูลเภสัชกรในร้านนี้</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          กลับ
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg p-6 mt-6">
      <h2 className="text-2xl font-bold text-green-700 mb-4">
        รายละเอียดเภสัชกรประจำร้าน {storeId}
      </h2>

      <div className="space-y-6">
        {pharmacists.map((pharmacist) => (
          <div
            key={pharmacist.id}
            className="border rounded-lg p-4 bg-gray-50 shadow-sm"
          >
            <p>
              <span className="font-semibold">ชื่อ-นามสกุล:</span>{" "}
              {pharmacist.firstname} {pharmacist.lastname}
            </p>
            <p>
              <span className="font-semibold">เลขที่ใบอนุญาต:</span>{" "}
              {pharmacist.license_number}
            </p>
            <p>
              <span className="font-semibold">เวลาปฏิบัติงาน:</span>{" "}
              {pharmacist.working_time}
            </p>
            <p>
              <span className="font-semibold">เบอร์โทรศัพท์:</span>{" "}
              {pharmacist.phone}
            </p>
            <p>
              <span className="font-semibold">Username:</span>{" "}
              {pharmacist.username}
            </p>
            <p>
              <span className="font-semibold">Password:</span>{" "}
              {pharmacist.password}
            </p>
            <p>
              <span className="font-semibold">เภสัชกรประจำร้าน:</span>{" "}
              {pharmacist.is_primary ? "ใช่" : "ไม่ใช่"}
            </p>

            <p className="font-semibold">บริการที่ให้:</p>
            <ul className="list-disc ml-6">
              {pharmacist.services.sell_products && (
                <li>จำหน่ายยาและผลิตภัณฑ์เพื่อสุขภาพ</li>
              )}
              {pharmacist.services.consulting && (
                <li>ให้คำปรึกษาทางเภสัชกรรม</li>
              )}
              {pharmacist.services.wholesale && <li>ขายปลีกและขายส่ง</li>}
              {pharmacist.services.delivery && (
                <li>บริการจัดส่งกล่องยาสามัญประจำบ้าน</li>
              )}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center">
        <button
          onClick={() => navigate(-1)}
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
        >
          กลับ
        </button>
      </div>
    </div>
  );
}

export default PharmacistDetail_admin;
