import 'dotenv/config';
import express from 'express'; // Types import kiye for strict typing
import type { Request, Response , Express } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import cropRoutes from './routes/crop.routes';
import orderRoutes from './routes/order.routes';

const app : Express = express();
// process.env.PORT check karega, nahi mila toh 5000 assign karega
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.use('/api/v1/auth',authRoutes);
app.use('/api/v1/user',userRoutes);
app.use('/api/v1/crops',cropRoutes);
app.use('/api/v1/order', orderRoutes);
app.listen(PORT, () => {
    console.log(`Server is running at PORT: ${PORT}`);
});

export default app;
