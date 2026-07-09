import { IsString, MaxLength, Matches } from 'class-validator';

export class CreateUploadUrlDto {
  @IsString()
  @MaxLength(255)
  filename!: string;

  @IsString()
  @Matches(/^(image\/(png|jpeg|jpg|gif|webp)|application\/pdf|text\/plain)$/, {
    message: 'Unsupported file type',
  })
  contentType!: string;
}