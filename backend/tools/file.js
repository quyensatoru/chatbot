import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { config, logger, withRetry, ok, fail } from "../config/tool.config.js";

function getAuth() {
    const auth = new google.auth.OAuth2(
        config.google.clientId,
        config.google.clientSecret,
        config.google.redirectUri
    );
    auth.setCredentials({ refresh_token: config.google.refreshToken });
    return auth;
}

function getDrive() {
    return google.drive({ version: "v3", auth: getAuth() });
}

function getDocs() {
    return google.docs({ version: "v1", auth: getAuth() });
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export const listFilesTool = new DynamicStructuredTool({
    name: "list_files",
    description:
        "Liệt kê file trong Google Drive. Dùng khi người dùng muốn xem danh sách tài liệu của mình.",
    schema: z.object({
        folderId: z
            .string()
            .optional()
            .describe("ID thư mục (để trống để xem root)"),
        query: z.string().optional().describe("Từ khóa tìm kiếm tên file"),
        mimeType: z
            .string()
            .optional()
            .describe(
                "Loại file: application/vnd.google-apps.document, application/pdf..."
            ),
        maxResults: z.number().int().min(1).max(50).default(10),
    }),
    func: async ({ folderId, query, mimeType, maxResults }) => {
        logger.info("Tool: list_files", { folderId, query });
        try {
            const drive = getDrive();
            const qParts = [];

            if (folderId) qParts.push(`'${folderId}' in parents`);
            if (query) qParts.push(`name contains '${query}'`);
            if (mimeType) qParts.push(`mimeType = '${mimeType}'`);
            qParts.push("trashed = false");

            const res = await withRetry(() =>
                drive.files.list({
                    q: qParts.join(" and "),
                    pageSize: maxResults,
                    fields: "files(id, name, mimeType, size, modifiedTime, webViewLink, parents)",
                    orderBy: "modifiedTime desc",
                })
            );

            return ok(res.data.files || []);
        } catch (err) {
            logger.error("list_files error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const searchDriveTool = new DynamicStructuredTool({
    name: "search_drive",
    description: "Tìm kiếm file trong Google Drive theo tên hoặc nội dung.",
    schema: z.object({
        keyword: z.string().describe("Từ khóa tìm kiếm"),
        fileType: z
            .enum(["document", "spreadsheet", "presentation", "pdf", "any"])
            .default("any"),
        maxResults: z.number().int().default(5),
    }),
    func: async ({ keyword, fileType, maxResults }) => {
        logger.info("Tool: search_drive", { keyword });
        try {
            const drive = getDrive();
            const mimeMap = {
                document: "application/vnd.google-apps.document",
                spreadsheet: "application/vnd.google-apps.spreadsheet",
                presentation: "application/vnd.google-apps.presentation",
                pdf: "application/pdf",
            };

            const qParts = [`fullText contains '${keyword}'`, "trashed = false"];
            if (fileType !== "any" && mimeMap[fileType]) {
                qParts.push(`mimeType = '${mimeMap[fileType]}'`);
            }

            const res = await withRetry(() =>
                drive.files.list({
                    q: qParts.join(" and "),
                    pageSize: maxResults,
                    fields: "files(id, name, mimeType, modifiedTime, webViewLink)",
                })
            );

            return ok(res.data.files || []);
        } catch (err) {
            logger.error("search_drive error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const createDocumentTool = new DynamicStructuredTool({
    name: "create_document",
    description:
        "Tạo tài liệu Google Docs mới với nội dung cho trước.",
    schema: z.object({
        title: z.string().describe("Tiêu đề tài liệu"),
        content: z.string().describe("Nội dung ban đầu của tài liệu"),
        folderId: z.string().optional().describe("ID thư mục lưu tài liệu"),
    }),
    func: async ({ title, content, folderId }) => {
        logger.info("Tool: create_document", { title });
        try {
            const docs = getDocs();
            const drive = getDrive();

            // Create doc
            const docRes = await withRetry(() =>
                docs.documents.create({ resource: { title } })
            );
            const docId = docRes.data.documentId;

            // Insert content
            if (content) {
                await withRetry(() =>
                    docs.documents.batchUpdate({
                        documentId: docId,
                        resource: {
                            requests: [
                                {
                                    insertText: { location: { index: 1 }, text: content },
                                },
                            ],
                        },
                    })
                );
            }

            // Move to folder if specified
            if (folderId) {
                const fileRes = await drive.files.get({
                    fileId: docId,
                    fields: "parents",
                });
                const prevParents = fileRes.data.parents.join(",");
                await withRetry(() =>
                    drive.files.update({
                        fileId: docId,
                        addParents: folderId,
                        removeParents: prevParents,
                        fields: "id, parents",
                    })
                );
            }

            return ok({
                docId,
                title,
                url: `https://docs.google.com/document/d/${docId}/edit`,
            });
        } catch (err) {
            logger.error("create_document error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const uploadFileTool = new DynamicStructuredTool({
    name: "upload_file",
    description: "Tải file từ máy tính lên Google Drive.",
    schema: z.object({
        localPath: z.string().describe("Đường dẫn file cục bộ cần upload"),
        driveFolderId: z.string().optional().describe("ID thư mục trên Drive để upload vào"),
        fileName: z.string().optional().describe("Tên file trên Drive (mặc định: tên file gốc)"),
    }),
    func: async ({ localPath, driveFolderId, fileName }) => {
        logger.info("Tool: upload_file", { localPath });
        try {
            if (!fs.existsSync(localPath)) {
                return fail(`File không tồn tại: ${localPath}`);
            }

            const drive = getDrive();
            const name = fileName || path.basename(localPath);
            const fileSize = fs.statSync(localPath).size;

            const metadata = {
                name,
                parents: driveFolderId ? [driveFolderId] : undefined,
            };

            const media = {
                body: fs.createReadStream(localPath),
            };

            const res = await withRetry(() =>
                drive.files.create({
                    resource: metadata,
                    media,
                    fields: "id, name, webViewLink, size",
                })
            );

            return ok({
                fileId: res.data.id,
                name: res.data.name,
                url: res.data.webViewLink,
                size: fileSize,
            });
        } catch (err) {
            logger.error("upload_file error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const downloadFileTool = new DynamicStructuredTool({
    name: "download_file",
    description: "Tải file từ Google Drive về máy tính.",
    schema: z.object({
        fileId: z.string().describe("ID của file trên Google Drive"),
        localPath: z.string().describe("Đường dẫn lưu file (ví dụ: ./downloads/file.pdf)"),
    }),
    func: async ({ fileId, localPath }) => {
        logger.info("Tool: download_file", { fileId, localPath });
        try {
            const drive = getDrive();
            fs.mkdirSync(path.dirname(localPath), { recursive: true });

            const res = await withRetry(() =>
                drive.files.get({ fileId, alt: "media" }, { responseType: "stream" })
            );

            await new Promise((resolve, reject) => {
                const dest = fs.createWriteStream(localPath);
                res.data.pipe(dest);
                dest.on("finish", resolve);
                dest.on("error", reject);
            });

            const stats = fs.statSync(localPath);
            return ok({ downloaded: true, localPath, size: stats.size });
        } catch (err) {
            logger.error("download_file error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const fileTools = [
    listFilesTool,
    searchDriveTool,
    createDocumentTool,
    uploadFileTool,
    downloadFileTool,
];