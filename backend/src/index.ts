import express from 'express'; // Types import kiye for strict typing
import type { Request, Response , Express } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
dotenv.config();
const app : Express = express();
// process.env.PORT check karega, nahi mila toh 5000 assign karega
const PORT = process.env.PORT || 5000; 

app.use(express.json());
app.use(cors());

app.use('/api/v1/auth',authRoutes);


app.listen(PORT, () => {
    console.log(`Server is running at PORT: ${PORT}`);
});

export default app;