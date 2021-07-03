import dayjs from 'dayjs';
import {
  BaseEntity,
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  Index,
  PrimaryColumn
} from 'typeorm';

@Entity()
export class Manager extends BaseEntity {
  @PrimaryColumn({
    type: 'bigint',
    unsigned: true
  })
  id: number;

  @Column({
    type: 'varchar',
    nullable: false,
    unique: true,
    length: 50
  })
  @Index()
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
    type: 'bigint',
    unsigned: true,
    nullable: false,
    readonly: true,
    default: 0
  })
  updatedAt: number;

  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: false,
    readonly: true,
    default: 0
  })
  createdAt: number;

  @BeforeUpdate()
  updateDateUpdate() {
    this.updatedAt = dayjs().unix();
  }

  @BeforeInsert()
  updateDateCreation() {
    this.createdAt = dayjs().unix();
  }
}
