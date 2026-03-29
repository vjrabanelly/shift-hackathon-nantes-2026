import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTextAnalysisDto {
  @IsString()
  @IsNotEmpty({ message: 'Le contenu du message ne peut pas être vide.' })
  @MaxLength(5000, { message: 'Le message ne peut pas dépasser 5000 caractères.' })
  content!: string;
}
