import {
  BaseEntity,
  Column,
  Entity, PrimaryColumn,
  PrimaryGeneratedColumn
} from 'typeorm';

@Entity()
export class UserCashFlow extends BaseEntity {
  @PrimaryColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    type: 'bigint',
  })
  userId: string;

  @Column({
    type: 'decimal',
    precision: 63,
    scale: 2
  })
  deposit: number;

  @Column({
    type: 'decimal',
    precision: 63,
    scale: 2
  })
  withdraw: number;

  @Column({
    type: 'timestamp',
    readonly: true,
    default: () => 'CURRENT_TIMESTAMP'
  })
  updatedAt: number;

  @Column({
    type: 'timestamp',
    readonly: true,
    default: () => 'CURRENT_TIMESTAMP'
  })
  createdAt: number;
}
