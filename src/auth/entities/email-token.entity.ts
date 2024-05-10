import { User } from 'src/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('email_token')
export class EmailToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  token: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToOne(() => User, (user) => user.id)
  user: User;
}