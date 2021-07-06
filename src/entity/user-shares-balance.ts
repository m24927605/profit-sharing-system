import {
  BaseEntity,
  Column,
  Entity,
  PrimaryColumn
} from 'typeorm';

@Entity()
export class UserSharesBalance extends BaseEntity {
  @PrimaryColumn({
    type: 'bigint'
  })
  userId: string;

  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: false
  })
  balance: string;

  @Column({
    type: 'int',
    unsigned: true,
    nullable: false,
    default: 0
  })
  proportion: number;

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
