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
export class User extends BaseEntity {
  @PrimaryColumn({
    type: 'bigint',
    unsigned: true
  })
  id: bigint;

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
