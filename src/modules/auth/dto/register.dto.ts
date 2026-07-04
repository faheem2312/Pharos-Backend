import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(72) // bcrypt silently truncates beyond 72 bytes — enforce it explicitly
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;
}
