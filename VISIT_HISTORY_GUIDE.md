# คู่มือ: การจัดการลูกค้าที่มาหลายครั้งด้วยอาการต่างกัน

## 📚 ภาพรวม

### ปัญหา
เมื่อลูกค้าคนเดียวกันมาใช้บริการร้านยาหลายครั้ง แต่ละครั้งมีอาการต่างกัน:
- **ครั้งที่ 1**: มาเมื่อวันที่ 23 ธ.ค. ด้วยอาการ "ปวดหัว" → ให้ยาพาราเซตามอล
- **ครั้งที่ 2**: มาเมื่อวันที่ 24 ธ.ค. ด้วยอาการ "ท้องเสีย" → ให้ยาแก้ท้องเสีย

### วิธีแก้ปัญหา
ระบบใช้ **Visit-based Recording** โดย:
1. ✅ **แยกบันทึกแต่ละครั้ง** - ใช้ Notification เป็น Visit Record
2. ✅ **เก็บประวัติทั้งหมด** - ไม่ลบ/ทับข้อมูลเก่า
3. ✅ **Customer Profile เก็บข้อมูลถาวร** - ยาแพ้, โรคประจำตัว

---

## 🗄️ โครงสร้างข้อมูล

### 1. Customer Profile (ข้อมูลพื้นฐาน - ไม่เปลี่ยน)
```javascript
{
  "documentId": "customer_abc123",
  "users_permissions_user": {
    "full_name": "นาย ทดสอบ ระบบ",
    "phone": "0812345678",
    "email": "test@example.com"
  },
  "Allergic_drugs": [
    {
      "drug": "Aspirin",
      "symptoms": "คลื่นไส้ มีผื่น",
      "date": "2024-01-15"
    }
  ],
  "congenital_disease": "เบาหวาน",
  // ไม่เก็บอาการและยาตรงนี้ - เพราะแต่ละครั้งแตกต่างกัน
}
```

### 2. Notification/Visit Record (แต่ละครั้งที่มา)

**Visit #1 - 23 ธันวาคม 2567**
```javascript
{
  "id": 101,
  "documentId": "notif_visit1",
  "type": "customer_assignment",
  "createdAt": "2024-12-23T10:30:00Z",
  "customer_profile": { "documentId": "customer_abc123" },
  "drug_store": { "documentId": "pharmacy_001" },
  "staff_profile": { "documentId": "staff_a" },
  
  "data": {
    // ข้อมูลเฉพาะการมาครั้งนี้
    "symptoms": "ปวดหัว มึนงง",
    "symptom_history": "เมื่อเช้านี้ตื่นมาปวดหัว",
    "symptom_note": "ไม่มีไข้",
    "prescribed_drugs": [
      {
        "drugId": "drug_paracetamol",
        "quantity": 2
      }
    ],
    "customer_name": "นาย ทดสอบ ระบบ",
    "customer_phone": "0812345678",
    "assigned_at": "2024-12-23T10:30:00Z"
  },
  
  "staff_work_status": {
    "received": true,
    "received_at": "2024-12-23T10:35:00Z",
    "prepared": true,
    "prepared_at": "2024-12-23T10:45:00Z",
    "batches_selected": {
      "drug_paracetamol": "batch_001"
    }
  }
}
```

**Visit #2 - 24 ธันวาคม 2567** (ลูกค้าคนเดียวกัน อาการต่างกัน)
```javascript
{
  "id": 102,
  "documentId": "notif_visit2",
  "type": "customer_assignment",
  "createdAt": "2024-12-24T14:15:00Z",
  "customer_profile": { "documentId": "customer_abc123" }, // คนเดียวกัน
  "drug_store": { "documentId": "pharmacy_001" },
  "staff_profile": { "documentId": "staff_b" },
  
  "data": {
    // ข้อมูลการมาครั้งใหม่ - อาการต่างจากครั้งก่อน
    "symptoms": "ท้องเสีย ปวดท้อง",
    "symptom_history": "เริ่มตอนเย็นเมื่อวาน หลังทานอาหาร",
    "symptom_note": "ถ่ายเหลว 3-4 ครั้ง",
    "prescribed_drugs": [
      {
        "drugId": "drug_loperamide",
        "quantity": 1
      },
      {
        "drugId": "drug_ors",
        "quantity": 5
      }
    ],
    "customer_name": "นาย ทดสอบ ระบบ",
    "customer_phone": "0812345678",
    "assigned_at": "2024-12-24T14:15:00Z"
  },
  
  "staff_work_status": {
    "received": true,
    "received_at": "2024-12-24T14:20:00Z",
    "prepared": true,
    "prepared_at": "2024-12-24T14:30:00Z",
    "batches_selected": {
      "drug_loperamide": "batch_102",
      "drug_ors": "batch_205"
    }
  }
}
```

---

## 💻 วิธีใช้งานในโค้ด

### 1. สร้าง Visit ใหม่ (เภสัชกร)

เมื่อลูกค้ามาใหม่ ให้ไปที่หน้า Customer Detail และกรอกอาการ + ยา ตามปกติ:

```javascript
// ใน detail_customer.js
const handleAssignToStaff = async (staffDocumentId) => {
  // ระบบจะสร้าง notification ใหม่เสมอ
  // แม้จะเป็นลูกค้าคนเดียวกัน
  const notificationData = {
    data: {
      type: 'customer_assignment', // ครั้งแรก
      customer_profile: customer.documentId,
      drug_store: pharmacy.documentId,
      staff_profile: staffDocumentId,
      data: {
        symptoms: customer.Customers_symptoms,
        symptom_history: customer.symptom_history,
        symptom_note: customer.symptom_note,
        prescribed_drugs: customer.prescribed_drugs,
        // ... ข้อมูลการมาครั้งนี้
      }
    }
  };
  
  // POST สร้าง notification/visit ใหม่
  await fetch(API.notifications.create(), {
    method: 'POST',
    body: JSON.stringify(notificationData)
  });
};
```

### 2. ดูประวัติทั้งหมด (เภสัชกร/Staff)

```javascript
// ดึงประวัติการมาทั้งหมดของลูกค้าคนนี้
const loadVisitHistory = async (customerDocumentId, pharmacyId) => {
  const response = await fetch(
    API.notifications.list(
      `filters[customer_profile][documentId][$eq]=${customerDocumentId}` +
      `&filters[drug_store][documentId][$eq]=${pharmacyId}` +
      `&filters[type][$in][0]=customer_assignment` +
      `&filters[type][$in][1]=customer_assignment_update` +
      `&populate=*` +
      `&sort[0]=createdAt:desc` // เรียงจากใหม่ไปเก่า
    )
  );
  
  const data = await response.json();
  const visits = data.data; // Array ของการมาทั้งหมด
  
  return visits;
};

// ตัวอย่างการแสดงผล
visits.map((visit, index) => {
  const visitNumber = visits.length - index; // ครั้งที่ 1, 2, 3...
  const symptoms = visit.data?.symptoms;
  const drugs = visit.data?.prescribed_drugs;
  const date = visit.createdAt;
  const status = visit.staff_work_status?.prepared ? 'เสร็จสิ้น' : 'รอดำเนินการ';
  
  return (
    <div key={visit.id}>
      <h4>ครั้งที่ {visitNumber} - {formatDate(date)}</h4>
      <p>อาการ: {symptoms}</p>
      <p>จำนวนยา: {drugs.length} รายการ</p>
      <p>สถานะ: {status}</p>
    </div>
  );
});
```

### 3. แก้ไขข้อมูลถาวร (ยาแพ้, โรคประจำตัว)

```javascript
// แก้ไขข้อมูลที่อยู่ใน Customer Profile เท่านั้น
// ส่งผลกับทุก visit
const updateCustomerProfile = async () => {
  await fetch(API.customerProfiles.update(customer.documentId), {
    method: 'PUT',
    body: JSON.stringify({
      data: {
        Allergic_drugs: [
          { drug: "Aspirin", symptoms: "คลื่นไส้", date: "2024-01-15" },
          { drug: "Penicillin", symptoms: "ผื่น", date: "2024-12-24" } // เพิ่มใหม่
        ],
        congenital_disease: "เบาหวาน, ความดันสูง" // อัพเดต
      }
    })
  });
};
```

---

## 🎯 ตัวอย่าง User Flow

### สถานการณ์: ลูกค้ามาครั้งที่ 2

1. **เภสัชกรค้นหาลูกค้า**
   ```
   ค้นหาด้วย: เบอร์โทร "0812345678"
   → พบ "นาย ทดสอบ ระบบ"
   ```

2. **เภสัชกรกดปุ่ม "ดูประวัติการมา"**
   ```
   แสดง Timeline:
   ├── ครั้งที่ 2 (24 ธ.ค. 67) - อาการ: ท้องเสีย ✅ เสร็จสิ้น
   └── ครั้งที่ 1 (23 ธ.ค. 67) - อาการ: ปวดหัว ✅ เสร็จสิ้น
   ```

3. **เภสัชกรกดปุ่ม "บันทึกการมาใหม่"**
   ```
   → ไปที่หน้า Customer Detail
   → ข้อมูลพื้นฐาน (ชื่อ, เบอร์, ยาแพ้) โหลดมาให้
   → อาการและยา เป็นฟอร์มว่างให้กรอกใหม่
   ```

4. **กรอกอาการใหม่**
   ```
   อาการ: "คัดจมูก น้ำมูกไหล"
   ยา: ��ลือก "ยาแก้แพ้" และ "ยาลดน้ำมูก"
   ```

5. **Assign ให้ Staff**
   ```
   → สร้าง notification/visit ใหม่ (ครั้งที่ 3)
   → ข้อมูลครั้งที่ 1 และ 2 ยังอยู่ในฐานข้อมูล
   ```

---

## ✅ ข้อดีของวิธีนี้

| ข้อดี | คำอธิบาย |
|-------|----------|
| 🗂️ **เก็บประวัติสมบูรณ์** | ดูย้อนหลังได้ว่าลูกค้าเคยมาด้วยอาการอะไร ให้ยาอะไร |
| 📊 **วิเคราะห์ได้** | ดูว่าลูกค้ามีปัญหาซ้ำหรือไม่ เช่น ปวดหัวบ่อย |
| 🔒 **ข้อมูลปลอดภัย** | ไม่มีการลบ/ทับข้อมูลเก่า |
| 👥 **Multi-staff Support** | แต่ละครั้งอาจ assign คนละ staff ได้ |
| 📝 **Audit Trail** | ตรวจสอบได้ว่าใครทำอะไร เมื่อไหร่ |

---

## 🔧 โค้ดที่สร้างเพิ่ม

### 1. หน้าดูประวัติ (VisitHistory.js)
ตำแหน่ง: `/web-client/src/js/pages/pharmacy/VisitHistory.js`

**ฟีเจอร์:**
- แสดง Timeline การมาทั้งหมด
- แสดงสถานะแต่ละครั้ง (รอดำเนินการ/เสร็จสิ้น/ยกเลิก)
- กดดูรายละเอียดแต่ละครั้งได้
- ปุ่ม "บันทึกการมาใหม่"

### 2. CSS สำหรับหน้าประวัติ
ตำแหน่ง: `/web-client/src/css/pages/pharmacy/VisitHistory.css`

**สไตล์:**
- Timeline แบบ Modern
- Responsive Design
- Animation Effects

### 3. ปุ่มในหน้า Customer Detail
แก้ไขไฟล์: `/web-client/src/js/pages/pharmacy/detail_customer.js`

เพิ่มปุ่ม "📋 ดูประวัติการมา" ที่ header

---

## 🚀 การใช้งาน

### เพิ่ม Route ใน App.js

```javascript
import VisitHistory from './pages/pharmacy/VisitHistory';

// ใน Routes
<Route 
  path="/drug_store_pharmacy/:pharmacyId/customer/:customerDocumentId/history" 
  element={<VisitHistory />} 
/>
```

### ทดสอบ

1. เข้าหน้า Customer Detail
2. กดปุ่ม "ดูประวัติการมา" ที่มุมขวาบน
3. ดู Timeline ประวัติทั้งหมด
4. กดปุ่ม "บันทึกการมาใหม่" เพื่อสร้าง visit ใหม่

---

## 📌 สรุป

**กลไกหลัก:**
1. **Customer Profile** = ข้อมูลที่ไม่เปลี่ยน (ชื่อ, ยาแพ้, โรคประจำตัว)
2. **Notification** = Visit Record แต่ละครั้ง (อาการ, ยา, วันที่, status)
3. **ประวัติ** = Query notifications ทั้งหมดของ customer คนนั้น

**ข้อควรระวัง:**
- ❌ **อย่า UPDATE** notification เดิมเมื่อลูกค้ามาใหม่
- ✅ **ให้ CREATE** notification ใหม่ทุกครั้ง
- ✅ **UPDATE** เฉพาะเมื่อเภสัชกรแก้ไขข้อมูลการมาครั้งเดียวกัน

นี่คือวิธีที่ถูกต้องในการจัดการลูกค้าที่มาหลายครั้งด้วยอาการต่างกัน! 🎉
