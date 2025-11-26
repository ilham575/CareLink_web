module.exports = {
  // Custom controller สำหรับ serve image โดยตรง
  async serveFile(ctx) {
    const { documentId, id } = ctx.params;
    const fileId = id || documentId;
    
    try {
      console.log('Attempting to serve file with ID:', fileId);
      
      if (!fileId || fileId === 'undefined' || fileId === 'null') {
        return ctx.badRequest('Invalid file ID');
      }
      
      // ดึงข้อมูลไฟล์จาก database
      let file;
      
      // ลองหาด้วย documentId ก่อน
      if (fileId.length > 5 && isNaN(fileId)) {
        file = await strapi.entityService.findMany('plugin::upload.file', {
          filters: {
            documentId: {
              $eq: fileId
            }
          }
        });
        file = file?.[0];
      } 
      
      // ถ้าหาไม่เจอ หรือไม่ใช่ documentId ให้หาด้วย ID
      if (!file && !isNaN(fileId)) {
        file = await strapi.entityService.findOne('plugin::upload.file', parseInt(fileId));
      }
      
      if (!file) {
        console.log('File not found in database for ID:', fileId);
        return ctx.notFound('File not found');
      }

      console.log('File found in database:', {
        id: file.id,
        name: file.name,
        hash: file.hash,
        ext: file.ext,
        provider: file.provider,
        mime: file.mime
      });

      // ถ้าเป็น local provider ให้หาไฟล์ที่มีอยู่จริง
      if (file.provider === 'local') {
        const path = require('path');
        const fs = require('fs');
        
        // หาไฟล์ที่มีอยู่จริงในระบบ
        const publicPath = path.join(strapi.dirs.public || process.cwd() + '/public', 'uploads');
        console.log('Looking in uploads directory:', publicPath);
        
        if (fs.existsSync(publicPath)) {
          const allFiles = fs.readdirSync(publicPath);
          console.log(`Found ${allFiles.length} files in uploads directory`);
          
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