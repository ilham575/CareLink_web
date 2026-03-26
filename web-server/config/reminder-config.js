module.exports = {
  REMIND_HOUR: "09", 
  REMIND_MINUTE: "17", 
  DRUG_NAME: "Paracetamol",
  CHAT_IDS: [8528639609], // เพิ่ม chat id ที่ต้องการแจ้งเตือน

  // ตารางเวลามาตรฐานสำหรับการทานยา
  TIMES: {
    BEFORE_MEAL: {
      MORNING: '07:00:00',
      LUNCH: '11:30:00',
      EVENING: '17:30:00'
    },
    AFTER_MEAL: {
      MORNING: '08:30:00',
      LUNCH: '12:30:00',
      EVENING: '18:30:00'
    },
    BEFORE_BED: '21:00:00'
  }
};
