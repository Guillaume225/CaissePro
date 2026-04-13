import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ApprovalCircuitsService {
  constructor(private readonly dataSource: DataSource) {}

  private wrap(data: unknown) {
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  async findAll() {
    const circuits = await this.dataSource.query(`
      SELECT ac.id, ac.name, ac.min_amount AS minAmount, ac.max_amount AS maxAmount, ac.is_active AS isActive,
        (SELECT COUNT(*) FROM approval_circuit_steps WHERE circuit_id = ac.id) AS stepsCount
      FROM approval_circuits ac
      ORDER BY ac.name
    `);

    // Load steps for each circuit
    for (const circuit of circuits) {
      circuit.isActive = !!circuit.isActive;
      const steps = await this.dataSource.query(`
        SELECT s.id, s.level AS stepOrder, s.role AS roleName, s.approver_id AS approverId
        FROM approval_circuit_steps s
        WHERE s.circuit_id = @0
        ORDER BY s.level
      `, [circuit.id]);
      circuit.steps = steps;
    }
    return this.wrap(circuits);
  }

  async create(dto: { name: string; minAmount?: number; maxAmount?: number; steps?: { level?: number; role: string; approverId?: string }[] }) {
    const [circuit] = await this.dataSource.query(`
      INSERT INTO approval_circuits (id, name, min_amount, max_amount, is_active)
      OUTPUT INSERTED.*
      VALUES (NEWID(), @0, @1, @2, 1)
    `, [dto.name, dto.minAmount || 0, dto.maxAmount || null]);

    if (dto.steps?.length) {
      for (let i = 0; i < dto.steps.length; i++) {
        const step = dto.steps[i];
        await this.dataSource.query(`
          INSERT INTO approval_circuit_steps (id, circuit_id, level, role, approver_id)
          VALUES (NEWID(), @0, @1, @2, @3)
        `, [circuit.id, step.level ?? i + 1, step.role, step.approverId || null]);
      }
    }
    return this.wrap(circuit);
  }

  async update(id: string, dto: { name?: string; minAmount?: number; maxAmount?: number; isActive?: boolean; steps?: { level?: number; role: string; approverId?: string }[] }) {
    const [existing] = await this.dataSource.query(
      'SELECT id FROM approval_circuits WHERE id = @0', [id],
    );
    if (!existing) throw new NotFoundException('Circuit not found');

    const sets: string[] = [];
    const params: unknown[] = [id];
    let idx = 1;
    if (dto.name !== undefined) { sets.push(`name = @${idx}`); params.push(dto.name); idx++; }
    if (dto.minAmount !== undefined) { sets.push(`min_amount = @${idx}`); params.push(dto.minAmount); idx++; }
    if (dto.maxAmount !== undefined) { sets.push(`max_amount = @${idx}`); params.push(dto.maxAmount); idx++; }
    if (dto.isActive !== undefined) { sets.push(`is_active = @${idx}`); params.push(dto.isActive ? 1 : 0); idx++; }

    if (sets.length) {
      await this.dataSource.query(
        `UPDATE approval_circuits SET ${sets.join(', ')} WHERE id = @0`, params,
      );
    }

    if (dto.steps) {
      await this.dataSource.query('DELETE FROM approval_circuit_steps WHERE circuit_id = @0', [id]);
      for (let i = 0; i < dto.steps.length; i++) {
        const step = dto.steps[i];
        await this.dataSource.query(`
          INSERT INTO approval_circuit_steps (id, circuit_id, level, role, approver_id)
          VALUES (NEWID(), @0, @1, @2, @3)
        `, [id, step.level ?? i + 1, step.role, step.approverId || null]);
      }
    }

    return this.findAll();
  }

  async remove(id: string) {
    await this.dataSource.query('DELETE FROM approval_circuit_steps WHERE circuit_id = @0', [id]);
    await this.dataSource.query('DELETE FROM approval_circuits WHERE id = @0', [id]);
    return this.wrap(null);
  }
}
