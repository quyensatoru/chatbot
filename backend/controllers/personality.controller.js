import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROFILES_DIR = path.resolve(__dirname, '../../personality/output/profiles');

const PersonalityController = {
    list: async (req, res) => {
        try {
            if (!fs.existsSync(PROFILES_DIR)) {
                return res.json({ success: true, data: [] });
            }

            const indexPath = path.join(PROFILES_DIR, '_index.json');
            if (fs.existsSync(indexPath)) {
                const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
                return res.json({ success: true, data: index });
            }

            const files = fs.readdirSync(PROFILES_DIR).filter((f) => f.endsWith('.json') && f !== '_index.json');
            const profiles = files.map((f) => {
                const raw = JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, f), 'utf-8'));
                return {
                    id: raw.userId,
                    username: raw.username,
                    displayName: raw.displayName,
                    email: raw.email,
                    analyzedAt: raw.analyzedAt,
                };
            });
            res.json({ success: true, data: profiles });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    getOne: async (req, res) => {
        try {
            if (!fs.existsSync(PROFILES_DIR)) {
                return res.status(404).json({ success: false, error: 'Profile not found' });
            }

            const { username } = req.params;
            const files = fs.readdirSync(PROFILES_DIR).filter((f) => f.endsWith('.json') && f !== '_index.json');
            const match = files.find((f) => f.startsWith(username));
            if (!match) return res.status(404).json({ success: false, error: 'Profile not found' });

            const profile = JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, match), 'utf-8'));
            res.json({ success: true, data: profile });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },
};

export default PersonalityController;
