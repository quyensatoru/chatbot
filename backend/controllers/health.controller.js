const HealthController = {
    health: async (req, res) => {
        return res.status(200).json({ success: true, message: 'Server is healthy' });
    },
};

export default HealthController;
