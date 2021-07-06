import {
  BaseEntity,
  Column,
  Entity,
  PrimaryColumn,
} from 'typeorm';

@Entity()
export class CompanySharedProfitBalance extends BaseEntity {
  @PrimaryColumn({
    type: 'int'
  })
  id: number;

  @Column({
    type: 'decimal',
    precision: 63,
    scale: 2,
    default: '0.00'
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
