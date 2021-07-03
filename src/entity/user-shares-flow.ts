import dayjs from 'dayjs';
import {
  BaseEntity,
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  PrimaryGeneratedColumn
} from 'typeorm';

@Entity()
export class UserSharesFlow extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: false
  })
  invest: number;

  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: false
  })
  withdraw: number;

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
