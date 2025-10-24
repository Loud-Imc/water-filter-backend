import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
// import { join } from 'path';

async function bootstrap() {
  // ✅ DEBUG: Check paths
  console.log('📍 __dirname:', __dirname);
  console.log('📍 process.cwd():', process.cwd());
  const fs = require('fs');
  console.log('📁 Files in root:', fs.readdirSync(process.cwd()));
  console.log('📁 Uploads exists?', fs.existsSync('uploads'));
  console.log(
    '📁 Uploads path:',
    require('path').join(process.cwd(), 'uploads'),
  );
  const app = await NestFactory.create(AppModule); // ✅ Remove NestExpressApplication

  // Enable CORS
  app.enableCors({
    origin: 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ✅ Cookie parser
  const cookieParser = require('cookie-parser');
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Backend running on: http://localhost:${port}`);
  console.log(`📁 Static files: http://localhost:${port}/uploads/`);
  console.log(
    `🖼️  Test: http://localhost:${port}/uploads/work-media/7be87de4226967103c491a961b29a7358.jpg`,
  );
}

bootstrap();
