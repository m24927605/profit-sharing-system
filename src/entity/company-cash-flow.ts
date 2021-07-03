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
export class CompanyCashFlow extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'decimal',
    precision: 63,
    scale: 2
  })
  income: number;

  @Column({
    type: 'decimal',
    precision: 63,
    scale: 2
  })
  outcome: number;

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
