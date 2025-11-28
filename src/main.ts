import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    const { method, url, ip } = req;

    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      logger.log(`${method} ${url} ${statusCode} ${duration}ms - ${ip}`);
    });

    next();
  });
  app.useLogger(logger);

  // Enable static file serving for Swagger custom scripts
  // In production, __dirname points to dist/, so public should be at root level
  const publicPath =
    process.env.NODE_ENV === 'production'
      ? join(__dirname, '..', 'public')
      : join(process.cwd(), 'public');
  app.useStaticAssets(publicPath, {
    prefix: '/',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Note: ThrottlerGuard is automatically applied via APP_GUARD in ThrottlerModule
  // No need to manually add it here

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Payment Gateway API')
    .setDescription(
      'A PCI-DSS compliant payment gateway with HMAC authentication, tokenization, and async transaction processing',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token for merchant authentication',
      },
      'JWT-auth',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token for admin authentication',
      },
      'Admin-JWT-auth',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
        description: 'API Key for HMAC authentication',
      },
      'HMAC-API-Key',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Signature',
        in: 'header',
        description: 'HMAC signature of the request',
      },
      'HMAC-Signature',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Timestamp',
        in: 'header',
        description: 'Request timestamp for replay attack prevention',
      },
      'HMAC-Timestamp',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Custom Swagger UI setup with HMAC helper
  SwaggerModule.setup('api', app, document, {
    customJs: '/hmac-helper.js',
    customSiteTitle: 'Payment Gateway API - HMAC Enabled',
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 20px 0; }
      /* Hide HMAC header inputs and show auto-generated notice */
      .swagger-ui .parameters-container tr:has(label[for*="X-API-Key"]),
      .swagger-ui .parameters-container tr:has(label[for*="X-Signature"]),
      .swagger-ui .parameters-container tr:has(label[for*="X-Timestamp"]) {
        position: relative;
      }
      .swagger-ui .parameters-container tr:has(label[for*="X-API-Key"]) input,
      .swagger-ui .parameters-container tr:has(label[for*="X-Signature"]) input,
      .swagger-ui .parameters-container tr:has(label[for*="X-Timestamp"]) input {
        background-color: #f0f8f0;
        border-color: #4CAF50;
      }
      .swagger-ui .parameters-container tr:has(label[for*="X-API-Key"])::after,
      .swagger-ui .parameters-container tr:has(label[for*="X-Signature"])::after,
      .swagger-ui .parameters-container tr:has(label[for*="X-Timestamp"])::after {
        content: " (Auto-filled by HMAC Helper)";
        font-size: 11px;
        color: #4CAF50;
        font-style: italic;
        margin-left: 5px;
      }
    `,
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `Application is running on: http://localhost:${process.env.PORT ?? 3000}`,
  );
  console.log(
    `Swagger documentation available at: http://localhost:${process.env.PORT ?? 3000}/api`,
  );
}
bootstrap();
