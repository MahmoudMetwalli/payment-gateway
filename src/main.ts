import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`Swagger documentation available at: http://localhost:${process.env.PORT ?? 3000}/api`);
}
bootstrap();
