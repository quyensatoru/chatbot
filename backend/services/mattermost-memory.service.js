import MattermostMemoryModel from "../models/mattermost.model.js"

const MattermostMemoryService = {
    create: (doc) => {
        return MattermostMemoryModel.create(doc)
    },
    findOne: (filter) => {
        return MattermostMemoryModel.findOne(filter)
    },
    findByThreadId: ({ threadId, channelId, limit = 20 }) => {
        return MattermostMemoryModel.find({
            threadId,
            channelId
        }).sort({ createdAt: -1 }).limit(limit).lean().exec()
    },
    findByChannelId: ({ channelId, limit = 20 }) => {
        return MattermostMemoryModel.find({
            channelId,
        }).sort({ createdAt: -1 }).limit(limit).lean().exec()
    }
}

export default MattermostMemoryService