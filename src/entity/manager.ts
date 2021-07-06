import {
  BaseEntity,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn
} from 'typeorm';

@Entity()
export class Manager extends BaseEntity {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true
  })
  id: number;

  @Column({
    type: 'varchar',
    length: 50
  })
  @Index({ unique: true })
  email: string;

  @Column({
    type: 'varchar',
    nullable: false,
    length: 200
  })
  password: string;

  @Column({
    type: 'varchar',
    length: 20
  })
  name: string;

  @Column({
    type: 'timestamp',
    readonly: true,
    default: () => 'CURRENT_TIMESTAMP'
  })
  updatedAt: Date;

  @Column({
    type: 'timestamp',
    readonly: true,
    default: () => 'CURRENT_TIMESTAMP'
  })
  createdAt: number;
}
