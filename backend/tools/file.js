import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { config, logger, ok, fail } from '../config/tool.config.js';

function safePath(filePath) {
    const base = path.resolve(config.file.baseDir);
    const resolved = path.resolve(base, filePath);
    if (!resolved.startsWith(base + path.sep) && resolved !== base) {
        throw new Error('Path traversal không được phép');
    }
    return resolved;
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export const listFilesTool = new DynamicStructuredTool({
    name: 'list_files',
    description: 'Liệt kê file và thư mục trong workspace cục bộ.',
    schema: z
        .object({
            dirPath: z.string().default('.').describe('Đường dẫn thư mục trong workspace (mặc định: gốc)'),
            showHidden: z.boolean().default(false).describe('Hiển thị file ẩn bắt đầu bằng dấu chấm'),
        })
        .strict(),
    func: async ({ dirPath, showHidden }) => {
        logger.info('Tool: list_files', { dirPath });
        try {
            const fullPath = safePath(dirPath);
            if (!fs.existsSync(fullPath)) return fail(`Thư mục không tồn tại: ${dirPath}`);
            if (!fs.statSync(fullPath).isDirectory()) return fail(`Không phải thư mục: ${dirPath}`);

            const entries = fs.readdirSync(fullPath, { withFileTypes: true });
            const files = entries
                .filter((e) => showHidden || !e.name.startsWith('.'))
                .map((e) => {
                    const stat = fs.statSync(path.join(fullPath, e.name));
                    return {
                        name: e.name,
                        type: e.isDirectory() ? 'directory' : 'file',
                        size: e.isFile() ? stat.size : null,
                        modifiedAt: stat.mtime.toISOString(),
                    };
                });

            return ok({ path: dirPath, count: files.length, files });
        } catch (err) {
            logger.error('list_files error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const searchFilesTool = new DynamicStructuredTool({
    name: 'search_files',
    description: 'Tìm kiếm file theo tên hoặc nội dung trong workspace.',
    schema: z
        .object({
            keyword: z.string().describe('Từ khóa cần tìm'),
            searchIn: z
                .enum(['name', 'content', 'both'])
                .default('both')
                .describe('Tìm trong tên file, nội dung, hoặc cả hai'),
            dirPath: z.string().default('.').describe('Thư mục gốc để tìm kiếm'),
            maxResults: z.number().int().min(1).max(50).default(10),
        })
        .strict(),
    func: async ({ keyword, searchIn, dirPath, maxResults }) => {
        logger.info('Tool: search_files', { keyword, searchIn });
        try {
            const fullPath = safePath(dirPath);
            if (!fs.existsSync(fullPath)) return fail(`Thư mục không tồn tại: ${dirPath}`);

            const results = [];
            const lowerKw = keyword.toLowerCase();

            function searchDir(dir) {
                if (results.length >= maxResults) return;
                let entries;
                try {
                    entries = fs.readdirSync(dir, { withFileTypes: true });
                } catch {
                    return;
                }
                for (const entry of entries) {
                    if (results.length >= maxResults) break;
                    const entryPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        searchDir(entryPath);
                    } else {
                        const nameMatch =
                            (searchIn === 'name' || searchIn === 'both') && entry.name.toLowerCase().includes(lowerKw);
                        let contentMatch = false;
                        if (!nameMatch && (searchIn === 'content' || searchIn === 'both')) {
                            try {
                                const content = fs.readFileSync(entryPath, 'utf-8');
                                contentMatch = content.toLowerCase().includes(lowerKw);
                            } catch {
                                /* skip binary files */
                            }
                        }
                        if (nameMatch || contentMatch) {
                            const stat = fs.statSync(entryPath);
                            results.push({
                                path: path.relative(fullPath, entryPath),
                                name: entry.name,
                                matchType: nameMatch ? 'name' : 'content',
                                size: stat.size,
                                modifiedAt: stat.mtime.toISOString(),
                            });
                        }
                    }
                }
            }

            searchDir(fullPath);
            return ok({ keyword, found: results.length, files: results });
        } catch (err) {
            logger.error('search_files error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const readFileTool = new DynamicStructuredTool({
    name: 'read_file',
    description: 'Đọc nội dung file văn bản trong workspace (txt, md, json, js, py, csv...).',
    schema: z
        .object({
            filePath: z.string().describe('Đường dẫn file trong workspace'),
            maxChars: z.number().int().min(100).max(50000).default(5000).describe('Số ký tự tối đa trả về'),
        })
        .strict(),
    func: async ({ filePath, maxChars }) => {
        logger.info('Tool: read_file', { filePath });
        try {
            const fullPath = safePath(filePath);
            if (!fs.existsSync(fullPath)) return fail(`File không tồn tại: ${filePath}`);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) return fail(`Đây là thư mục, không phải file: ${filePath}`);

            const content = fs.readFileSync(fullPath, 'utf-8');
            return ok({
                path: filePath,
                size: stat.size,
                modifiedAt: stat.mtime.toISOString(),
                content: content.slice(0, maxChars),
                truncated: content.length > maxChars,
            });
        } catch (err) {
            logger.error('read_file error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const createFileTool = new DynamicStructuredTool({
    name: 'create_file',
    description: 'Tạo file mới trong workspace với nội dung cho trước. Tự tạo thư mục nếu chưa có.',
    schema: z
        .object({
            filePath: z.string().describe('Đường dẫn file cần tạo'),
            content: z.string().describe('Nội dung file'),
            overwrite: z.boolean().default(false).describe('Cho phép ghi đè nếu file đã tồn tại'),
        })
        .strict(),
    func: async ({ filePath, content, overwrite }) => {
        logger.info('Tool: create_file', { filePath });
        try {
            const fullPath = safePath(filePath);
            if (!overwrite && fs.existsSync(fullPath)) {
                return fail(`File đã tồn tại: ${filePath}. Dùng overwrite: true để ghi đè.`);
            }
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, content, 'utf-8');
            return ok({ created: true, path: filePath, size: Buffer.byteLength(content, 'utf-8') });
        } catch (err) {
            logger.error('create_file error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const writeFileTool = new DynamicStructuredTool({
    name: 'write_file',
    description: 'Ghi hoặc nối thêm nội dung vào file đã có trong workspace.',
    schema: z
        .object({
            filePath: z.string().describe('Đường dẫn file cần ghi'),
            content: z.string().describe('Nội dung cần ghi'),
            mode: z
                .enum(['overwrite', 'append'])
                .default('overwrite')
                .describe('overwrite=ghi đè toàn bộ, append=nối thêm vào cuối'),
        })
        .strict(),
    func: async ({ filePath, content, mode }) => {
        logger.info('Tool: write_file', { filePath, mode });
        try {
            const fullPath = safePath(filePath);
            if (!fs.existsSync(fullPath)) return fail(`File không tồn tại: ${filePath}`);
            if (mode === 'append') {
                fs.appendFileSync(fullPath, content, 'utf-8');
            } else {
                fs.writeFileSync(fullPath, content, 'utf-8');
            }
            const stat = fs.statSync(fullPath);
            return ok({ written: true, path: filePath, size: stat.size, mode });
        } catch (err) {
            logger.error('write_file error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const deleteFileTool = new DynamicStructuredTool({
    name: 'delete_file',
    description: 'Xóa file hoặc thư mục rỗng khỏi workspace.',
    schema: z
        .object({
            filePath: z.string().describe('Đường dẫn file hoặc thư mục cần xóa'),
        })
        .strict(),
    func: async ({ filePath }) => {
        logger.info('Tool: delete_file', { filePath });
        try {
            const fullPath = safePath(filePath);
            if (!fs.existsSync(fullPath)) return fail(`Không tìm thấy: ${filePath}`);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                fs.rmdirSync(fullPath);
            } else {
                fs.unlinkSync(fullPath);
            }
            return ok({ deleted: true, path: filePath });
        } catch (err) {
            logger.error('delete_file error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const fileTools = [listFilesTool, searchFilesTool, readFileTool, createFileTool, writeFileTool, deleteFileTool];
