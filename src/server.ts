import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'API Online 🚀' });
});

// Routes
app.use(routes);

app.listen(Number(port), '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});
