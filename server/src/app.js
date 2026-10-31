import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import './config/zod.js';
import { env, isProduction, isTest } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import routes from './routes/index.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.clientUrls }));
app.use(express.json({ limit: '100kb' }));
if (!isTest()) {
  app.use(morgan(isProduction() ? 'combined' : 'dev'));
}

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
