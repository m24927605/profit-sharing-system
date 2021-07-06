import {
  BaseEntity,
  Column,
  Entity,
  PrimaryColumn
} from 'typeorm';

@Entity()
export class User extends BaseEntity {
  @PrimaryColumn({
    type: 'bigint',
  })
  id: string;

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
