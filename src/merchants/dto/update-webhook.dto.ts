import { IsArray, IsUrl, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWebhookDto {
  @ApiProperty({
    description: 'List of webhook URLs',
    example: ['https://example.com/webhook'],
    required: true,
    type: [String],
  })
  @IsArray()
  @IsNotEmpty()
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  webhook: string[];
}
