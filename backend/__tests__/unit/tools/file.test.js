import { describe, test, expect, beforeAll, vi, afterEach } from 'vitest';
import path from 'path';

// Mock fs (sync) before tool import
vi.mock('fs', () => {
  const fsMock = {
    existsSync: vi.fn(),
    statSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    appendFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn(),
    rmdirSync: vi.fn(),
  };
  return { default: fsMock, ...fsMock };
});

let listFilesTool, searchFilesTool, readFileTool, createFileTool, writeFileTool, deleteFileTool;
let fs;

beforeAll(async () => {
  fs = (await import('fs')).default;
  const mod = await import('../../../tools/file.js');
  listFilesTool   = mod.listFilesTool;
  searchFilesTool = mod.searchFilesTool;
  readFileTool    = mod.readFileTool;
  createFileTool  = mod.createFileTool;
  writeFileTool   = mod.writeFileTool;
  deleteFileTool  = mod.deleteFileTool;
});

afterEach(() => { vi.clearAllMocks(); });

// Helper: make a fake stat object
const fakeFileStat = (size = 1024) => ({
  isDirectory: () => false,
  isFile: () => true,
  size,
  mtime: new Date('2026-04-20T00:00:00Z'),
});
const fakeDirStat = () => ({
  isDirectory: () => true,
  isFile: () => false,
  size: null,
  mtime: new Date('2026-04-20T00:00:00Z'),
});

// ─── list_files ───────────────────────────────────────────────────────────────
describe('list_files tool', () => {
  test('lists directory contents', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.statSync.mockReturnValue(fakeDirStat());
    fs.readdirSync.mockReturnValue([
      { name: 'readme.md', isDirectory: () => false, isFile: () => true },
      { name: 'src',       isDirectory: () => true,  isFile: () => false },
    ]);

    const result = JSON.parse(await listFilesTool.func({ dirPath: '.', showHidden: false }));
    expect(result.success).toBe(true);
    expect(result.data.count).toBe(2);
    expect(result.data.files[0].name).toBe('readme.md');
    expect(result.data.files[1].type).toBe('directory');
  });

  test('hides dot-files by default', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.statSync.mockReturnValue(fakeDirStat());
    fs.readdirSync.mockReturnValue([
      { name: '.env',    isDirectory: () => false, isFile: () => true },
      { name: 'app.js', isDirectory: () => false, isFile: () => true },
    ]);

    const result = JSON.parse(await listFilesTool.func({ dirPath: '.', showHidden: false }));
    expect(result.success).toBe(true);
    expect(result.data.count).toBe(1);
    expect(result.data.files[0].name).toBe('app.js');
  });

  test('showHidden=true includes dot-files', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.statSync.mockReturnValue(fakeDirStat());
    fs.readdirSync.mockReturnValue([
      { name: '.env', isDirectory: () => false, isFile: () => true },
    ]);

    const result = JSON.parse(await listFilesTool.func({ dirPath: '.', showHidden: true }));
    expect(result.data.count).toBe(1);
  });

  test('non-existent directory returns fail', async () => {
    fs.existsSync.mockReturnValue(false);
    const result = JSON.parse(await listFilesTool.func({ dirPath: 'missing' }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/không tồn tại/);
  });
});

// ─── read_file ───────────────────────────────────────────────────────────────
describe('read_file tool', () => {
  test('reads text file content', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.statSync.mockReturnValue(fakeFileStat(42));
    fs.readFileSync.mockReturnValue('Hello World');

    const result = JSON.parse(await readFileTool.func({ filePath: 'notes.txt' }));
    expect(result.success).toBe(true);
    expect(result.data.content).toBe('Hello World');
    expect(result.data.path).toBe('notes.txt');
    expect(result.data.size).toBe(42);
    expect(result.data.truncated).toBe(false);
  });

  test('truncates content when larger than maxChars', async () => {
    const longContent = 'A'.repeat(10000);
    fs.existsSync.mockReturnValue(true);
    fs.statSync.mockReturnValue(fakeFileStat(10000));
    fs.readFileSync.mockReturnValue(longContent);

    const result = JSON.parse(await readFileTool.func({ filePath: 'big.txt', maxChars: 100 }));
    expect(result.success).toBe(true);
    expect(result.data.content.length).toBe(100);
    expect(result.data.truncated).toBe(true);
  });

  test('non-existent file returns fail', async () => {
    fs.existsSync.mockReturnValue(false);
    const result = JSON.parse(await readFileTool.func({ filePath: 'missing.txt' }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/không tồn tại/);
  });

  test('reading a directory path returns fail', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.statSync.mockReturnValue(fakeDirStat());
    const result = JSON.parse(await readFileTool.func({ filePath: 'some_dir' }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/thư mục/);
  });

  // SECURITY TEST
  test('SECURITY: path traversal ../../ is blocked', async () => {
    const result = JSON.parse(await readFileTool.func({ filePath: '../../etc/passwd' }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Path traversal không được phép/);
  });

  test('SECURITY: absolute path outside workspace is blocked', async () => {
    const result = JSON.parse(await readFileTool.func({ filePath: '/etc/shadow' }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Path traversal không được phép/);
  });
});

// ─── create_file ─────────────────────────────────────────────────────────────
describe('create_file tool', () => {
  test('creates new file', async () => {
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockReturnValue(undefined);
    fs.writeFileSync.mockReturnValue(undefined);

    const result = JSON.parse(await createFileTool.func({
      filePath: 'output.txt',
      content: 'Hello World',
      overwrite: false,
    }));
    expect(result.success).toBe(true);
    expect(result.data.created).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.any(String), 'Hello World', 'utf-8'
    );
  });

  test('returns fail if file exists and overwrite=false', async () => {
    fs.existsSync.mockReturnValue(true);
    const result = JSON.parse(await createFileTool.func({
      filePath: 'existing.txt',
      content: 'new content',
      overwrite: false,
    }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ghi đè/);
  });

  test('overwrites file when overwrite=true', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockReturnValue(undefined);
    fs.writeFileSync.mockReturnValue(undefined);

    const result = JSON.parse(await createFileTool.func({
      filePath: 'existing.txt',
      content: 'updated',
      overwrite: true,
    }));
    expect(result.success).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  test('SECURITY: path traversal blocked on create', async () => {
    const result = JSON.parse(await createFileTool.func({
      filePath: '../../etc/evil.sh',
      content: 'rm -rf /',
      overwrite: false,
    }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Path traversal/);
  });
});

// ─── write_file ──────────────────────────────────────────────────────────────
describe('write_file tool', () => {
  test('overwrites existing file', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.writeFileSync.mockReturnValue(undefined);
    fs.statSync.mockReturnValue(fakeFileStat(7));

    const result = JSON.parse(await writeFileTool.func({
      filePath: 'notes.txt',
      content: 'Updated',
      mode: 'overwrite',
    }));
    expect(result.success).toBe(true);
    expect(result.data.mode).toBe('overwrite');
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  test('appends to existing file', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.appendFileSync.mockReturnValue(undefined);
    fs.statSync.mockReturnValue(fakeFileStat(20));

    const result = JSON.parse(await writeFileTool.func({
      filePath: 'log.txt',
      content: '\nNew line',
      mode: 'append',
    }));
    expect(result.success).toBe(true);
    expect(result.data.mode).toBe('append');
    expect(fs.appendFileSync).toHaveBeenCalled();
  });

  test('file not found returns fail', async () => {
    fs.existsSync.mockReturnValue(false);
    const result = JSON.parse(await writeFileTool.func({
      filePath: 'missing.txt', content: 'x', mode: 'overwrite',
    }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/không tồn tại/);
  });
});

// ─── delete_file ─────────────────────────────────────────────────────────────
describe('delete_file tool', () => {
  test('deletes a file', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.statSync.mockReturnValue(fakeFileStat());
    fs.unlinkSync.mockReturnValue(undefined);

    const result = JSON.parse(await deleteFileTool.func({ filePath: 'temp.txt' }));
    expect(result.success).toBe(true);
    expect(result.data.deleted).toBe(true);
    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  test('deletes an empty directory', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.statSync.mockReturnValue(fakeDirStat());
    fs.rmdirSync.mockReturnValue(undefined);

    const result = JSON.parse(await deleteFileTool.func({ filePath: 'empty_dir' }));
    expect(result.success).toBe(true);
    expect(fs.rmdirSync).toHaveBeenCalled();
  });

  test('non-existent target returns fail', async () => {
    fs.existsSync.mockReturnValue(false);
    const result = JSON.parse(await deleteFileTool.func({ filePath: 'ghost.txt' }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Không tìm thấy/);
  });

  test('SECURITY: path traversal blocked on delete', async () => {
    const result = JSON.parse(await deleteFileTool.func({ filePath: '../../important.cfg' }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Path traversal/);
  });
});
