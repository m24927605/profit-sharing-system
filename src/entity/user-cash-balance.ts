import {
  BaseEntity,
  Column,
  Entity,
  PrimaryColumn,
} from 'typeorm';

@Entity()
export class UserCashBalance extends BaseEntity {
  @PrimaryColumn({
    type: 'bigint'
  })
  userId: string;

  @Column({
    type: 'decimal',
    precision: 63,
    scale: 2,
    default: 0
  })
  balance: number;

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
