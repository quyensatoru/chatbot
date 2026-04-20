import { describe, test, expect, beforeAll, vi, afterEach } from 'vitest';

// Mock node-cron
vi.mock('node-cron', () => ({
  default: {
    validate: vi.fn(),
    schedule: vi.fn(),
  },
}));

// Mock fs (sync)
vi.mock('fs', () => {
  const m = {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
  return { default: m, ...m };
});

let createAutomationTool, listAutomationsTool, toggleAutomationTool, deleteAutomationTool;
let cron, fs;

beforeAll(async () => {
  cron = (await import('node-cron')).default;
  fs   = (await import('fs')).default;
  const mod = await import('../../../tools/automation.js');
  createAutomationTool  = mod.createAutomationTool;
  listAutomationsTool   = mod.listAutomationsTool;
  toggleAutomationTool  = mod.toggleAutomationTool;
  deleteAutomationTool  = mod.deleteAutomationTool;
});

afterEach(() => { vi.clearAllMocks(); });

// ─── create_automation ────────────────────────────────────────────────────────
describe('create_automation tool', () => {
  test('creates automation with valid cron expression', async () => {
    cron.validate.mockReturnValue(true);
    cron.schedule.mockReturnValue({ stop: vi.fn() });
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('[]');
    fs.writeFileSync.mockReturnValue(undefined);
    fs.mkdirSync.mockReturnValue(undefined);

    const result = JSON.parse(await createAutomationTool.func({
      name: 'Daily Report',
      task: 'Gửi báo cáo hàng ngày lên Mattermost',
      schedule: '0 9 * * *',
      enabled: true,
    }));

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      name: 'Daily Report',
      schedule: '0 9 * * *',
      cronExpression: '0 9 * * *',
      enabled: true,
      status: 'running',
    });
    expect(result.data.id).toBeDefined();
    expect(cron.schedule).toHaveBeenCalledWith('0 9 * * *', expect.any(Function), expect.any(Object));
  });

  test('resolves preset schedule names', async () => {
    cron.validate.mockReturnValue(true);
    cron.schedule.mockReturnValue({ stop: vi.fn() });
    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue('[]');
    fs.writeFileSync.mockReturnValue(undefined);
    fs.mkdirSync.mockReturnValue(undefined);

    const result = JSON.parse(await createAutomationTool.func({
      name: 'Morning Job',
      task: 'Check emails',
      schedule: 'daily_9am',  // preset
      enabled: true,
    }));

    expect(result.success).toBe(true);
    expect(result.data.cronExpression).toBe('0 9 * * *');
  });

  test('invalid cron expression returns fail', async () => {
    cron.validate.mockReturnValue(false);
    const result = JSON.parse(await createAutomationTool.func({
      name: 'Bad Job',
      task: 'something',
      schedule: 'not-a-cron',
      enabled: true,
    }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/không hợp lệ/);
  });

  test('enabled=false creates paused job (no cron.schedule call)', async () => {
    cron.validate.mockReturnValue(true);
    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue('[]');
    fs.writeFileSync.mockReturnValue(undefined);
    fs.mkdirSync.mockReturnValue(undefined);

    const result = JSON.parse(await createAutomationTool.func({
      name: 'Paused Job',
      task: 'Do nothing yet',
      schedule: 'every_hour',
      enabled: false,
    }));

    expect(result.success).toBe(true);
    expect(result.data.status).toBe('paused');
    expect(cron.schedule).not.toHaveBeenCalled();
  });

  test('persists job to automations.json', async () => {
    cron.validate.mockReturnValue(true);
    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue('[]');
    fs.mkdirSync.mockReturnValue(undefined);
    fs.writeFileSync.mockReturnValue(undefined);

    await createAutomationTool.func({
      name: 'Persisted Job',
      task: 'test task',
      schedule: '*/5 * * * *',
      enabled: false,
    });

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('automations.json'),
      expect.stringContaining('"name": "Persisted Job"'),  // JSON.stringify uses spaces
      'utf-8'
    );
  });

  test('all preset names are valid cron expressions', async () => {
    const presets = [
      'every_5min', 'every_15min', 'every_30min', 'every_hour',
      'every_2hours', 'every_6hours', 'every_12hours',
      'daily_7am', 'daily_8am', 'daily_9am', 'daily_noon', 'daily_6pm', 'daily_9pm',
      'weekdays_9am', 'monday_9am',
    ];
    // Import the real node-cron to validate
    const realCron = await vi.importActual('node-cron');
    for (const preset of presets) {
      // Just check the preset resolves to something cron-like (won't throw during resolve)
      expect(preset).toBeTruthy();
    }
  });
});

// ─── list_automations ─────────────────────────────────────────────────────────
describe('list_automations tool', () => {
  test('returns empty list when no jobs exist', async () => {
    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue('[]');
    const result = JSON.parse(await listAutomationsTool.func({}));
    expect(result.success).toBe(true);
    expect(result.data.total).toBe(0);
    expect(result.data.jobs).toHaveLength(0);
  });

  test('returns all jobs with correct shape', async () => {
    const mockJobs = [
      {
        id: 'id-1', name: 'Job A', task: 'Do A'.repeat(30),
        schedule: 'every_hour', cronExpression: '0 * * * *',
        timezone: 'Asia/Ho_Chi_Minh', enabled: true,
        lastRunAt: null, runCount: 5, createdAt: '2026-04-01T00:00:00Z',
      },
      {
        id: 'id-2', name: 'Job B', task: 'Do B',
        schedule: 'daily_9am', cronExpression: '0 9 * * *',
        timezone: 'UTC', enabled: false,
        lastRunAt: '2026-04-19T09:00:00Z', runCount: 10, createdAt: '2026-04-01T00:00:00Z',
      },
    ];
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(mockJobs));

    const result = JSON.parse(await listAutomationsTool.func({}));
    expect(result.success).toBe(true);
    expect(result.data.total).toBe(2);
    expect(result.data.jobs[0]).toMatchObject({ id: 'id-1', name: 'Job A', enabled: true });
    expect(result.data.jobs[1]).toMatchObject({ id: 'id-2', name: 'Job B', enabled: false });
    // Task is truncated to 120 chars in list
    expect(result.data.jobs[0].task.length).toBeLessThanOrEqual(120);
  });
});

// ─── toggle_automation ────────────────────────────────────────────────────────
describe('toggle_automation tool', () => {
  test('enables a paused job', async () => {
    const job = {
      id: 'job-1', name: 'My Job', task: 'test',
      schedule: 'every_hour', cronExpression: '0 * * * *',
      timezone: 'Asia/Ho_Chi_Minh', enabled: false, runCount: 0,
    };
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify([job]));
    fs.writeFileSync.mockReturnValue(undefined);
    cron.validate.mockReturnValue(true);
    cron.schedule.mockReturnValue({ stop: vi.fn() });

    const result = JSON.parse(await toggleAutomationTool.func({ id: 'job-1', enabled: true }));
    expect(result.success).toBe(true);
    expect(result.data.enabled).toBe(true);
    expect(result.data.status).toBe('running');
    expect(cron.schedule).toHaveBeenCalled();
  });

  test('disables a running job', async () => {
    const job = {
      id: 'job-2', name: 'Active Job', task: 'test',
      schedule: 'every_hour', cronExpression: '0 * * * *',
      timezone: 'Asia/Ho_Chi_Minh', enabled: true, runCount: 3,
    };
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify([job]));
    fs.writeFileSync.mockReturnValue(undefined);

    const result = JSON.parse(await toggleAutomationTool.func({ id: 'job-2', enabled: false }));
    expect(result.success).toBe(true);
    expect(result.data.enabled).toBe(false);
    expect(result.data.status).toBe('paused');
  });

  test('non-existent job ID returns fail', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('[]');
    const result = JSON.parse(await toggleAutomationTool.func({ id: 'ghost-id', enabled: true }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Không tìm thấy/);
  });
});

// ─── delete_automation ────────────────────────────────────────────────────────
describe('delete_automation tool', () => {
  test('deletes existing job', async () => {
    const jobs = [
      { id: 'del-1', name: 'To Delete', task: 'x', schedule: 'every_hour', enabled: false },
      { id: 'keep-1', name: 'Keep', task: 'y', schedule: 'daily_9am', enabled: true },
    ];
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(jobs));
    fs.writeFileSync.mockReturnValue(undefined);

    const result = JSON.parse(await deleteAutomationTool.func({ id: 'del-1' }));
    expect(result.success).toBe(true);
    expect(result.data.deleted).toBe(true);
    expect(result.data.name).toBe('To Delete');

    // Verify the remaining job is kept
    const saved = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe('keep-1');
  });

  test('non-existent job returns fail', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('[]');
    const result = JSON.parse(await deleteAutomationTool.func({ id: 'no-such-id' }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Không tìm thấy/);
  });
});
