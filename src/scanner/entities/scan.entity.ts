import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('scans')
export class Scan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  target: string; // Original input (URL, domain, or IP)

  @Column({ nullable: true })
  resolvedIp: string;

  @Column({ type: 'text', nullable: true })
  ports: string; // JSON array of scan results stored as text

  @Column({
    type: 'text',
    default: 'pending',
  })
  status: 'pending' | 'processing' | 'completed' | 'failed';

  @Column({ type: 'text', nullable: true })
  error: string; // Error message if scan failed

  @Column({ type: 'text', nullable: true })
  vulnerabilities: string; // JSON array of Nikto vulnerability findings

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;
}
