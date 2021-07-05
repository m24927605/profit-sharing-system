import {
  BaseEntity,
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
  invest: string;

  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: false
  })
  withdraw: string;

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
