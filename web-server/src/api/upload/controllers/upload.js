module.exports = {
  // Custom controller สำหรับ serve image โดยตรง
  async serveFile(ctx) {
    const { documentId } = ctx.params;
    
    try {
      console.log('Attempting to serve file with documentId:', documentId);
      
      // ดึงข้อมูลไฟล์จาก database ด้วย documentId
      const files = await strapi.entityService.findMany('plugin::upload.file', {
        filters: {
          documentId: {
            $eq: documentId
          }
        }
      });
      
      // ดึงไฟล์ตัวแรกที่ตรง
      const file = files.length > 0 ? files[0] : null;
      
      if (!file) {
        console.log('File not found in database for documentId:', documentId);
        return ctx.notFound('File not found');
      }

      console.log('File found in database:', {
        id: file.id,
        name: file.name,
        hash: file.hash,
        ext: file.ext,
        provider: file.provider
      });

      // ถ้าเป็น local provider ให้หาไฟล์ที่มีอยู่จริง
      if (file.provider === 'local') {
        const path = require('path');
        const fs = require('fs');
        
        // หาไฟล์ที่มีอยู่จริงในระบบ
        const publicPath = path.join(strapi.dirs.public || process.cwd() + '/public', 'uploads');
        console.log('Looking in uploads directory:', publicPath);
        
        // หาไฟล์ที่มี hash คล้ายๆ กัน
        if (fs.existsSync(publicPath)) {
          const allFiles = fs.readdirSync(publicPath);
          console.log(`Found ${allFiles.length} files in uploads directory`);
          console.log('First 10 files:', allFiles.slice(0, 10));
          
          // ลองหา exact match ก่อน
          const exactMatch = file.hash + file.ext;
          console.log('Looking for exact match:', exactMatch);
          
          let matchingFile = null;
          
          if (allFiles.includes(exactMatch)) {
            matchingFile = exactMatch;
            console.log('Found exact match');
          } else {
            console.log('Exact match not found, searching with patterns...');
            // หาด้วยหลายๆ pattern
            matchingFile = allFiles.find(f => {
              const checks = [
                f.includes(file.name.split('.')[0]),
                f.includes(file.hash),
                f.startsWith(file.name.split('_')[0]),
                f.includes(file.id.toString())
              ];
              
              return checks.some(check => check);
            });
            
            if (matchingFile) {
              console.log('Found matching file using pattern:', matchingFile);
            }
          }
          
          if (matchingFile) {
            const filePath = path.join(publicPath, matchingFile);
            console.log('Serving file from:', filePath);
            
            // ตั้งค่า headers
            ctx.set('Content-Type', file.mime || 'application/octet-stream');
            ctx.set('Cache-Control', 'public, max-age=31536000'); // 1 year
            ctx.set('Content-Disposition', `inline; filename="${file.name}"`);
            
            // ส่งไฟล์
            ctx.body = fs.createReadStream(filePath);
            return;
          } else {
            console.log('No matching file found');
          }
        } else {
          console.log('Uploads directory does not exist:', publicPath);
        }
      }
      
      // ถ้าหาไม่เจอ ส่ง 404
      console.log('File not found on disk');
      return ctx.notFound('File not found on disk');
      
    } catch (error) {
      console.error('Error serving file:', error);
      strapi.log.error('Error serving file:', error);
      return ctx.badRequest('Error serving file');
    }
  }
};