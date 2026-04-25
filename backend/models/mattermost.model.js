import mongoose from 'mongoose';

const MattermostMemorySchema = new mongoose.Schema(
    {
        rootId: { type: String, required: true },
        channelId: { type: String, required: true },
        threadId: { type: String },
        message: {
            role: { type: String },
            content: { type: String },
        },
        senderName: { type: String, required: true },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

MattermostMemorySchema.index({ channelId: 1, rootId: 1 });
MattermostMemorySchema.index({ threadId: 1 });

const MattermostMemoryModel = mongoose.model('MattermostMemory', MattermostMemorySchema);

export default MattermostMemoryModel;
